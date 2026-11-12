import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile, readdir } from "node:fs/promises";
import { sm2 } from "../src/lib/learning/sm2";
const pg = new PGlite({ extensions: { vector } });
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const moduleId = "33333333-3333-4333-8333-333333333333";
const docId = "44444444-4444-4444-8444-444444444444";
const quizId = "55555555-5555-4555-8555-555555555555";
const qId = "66666666-6666-4666-8666-666666666666";
const runId = "77777777-7777-4777-8777-777777777777";
beforeAll(async () => {
  await pg.exec(
    `create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated;`,
  );
  for (const file of (await readdir("supabase/migrations")).sort())
    await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await pg.exec(
    `grant select on all tables in schema public to authenticated;revoke all on drive_connections from authenticated;grant select(user_id,root_id,updated_at) on drive_connections to authenticated;grant all on all tables in schema public to service_role;insert into auth.users values('${alice}'),('${bob}');insert into modules(id,user_id,drive_id,name) values('${moduleId}','${alice}','root-module','Docker');insert into documents(id,user_id,drive_id,name,mime_type,module_id,created_at,modified_at,version,source_url) values('${docId}','${alice}','drive-pdf','Docker.pdf','application/pdf','${moduleId}',now(),now(),'v1','https://drive.google.com/file/d/test/view');insert into drive_connections(user_id,encrypted_tokens,root_id) values('${alice}','encrypted-not-a-token','root');`,
  );
}, 60000);
afterAll(async () => {
  await pg.close();
});
async function asUser(id: string, fn: () => Promise<void>) {
  await pg.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
  try {
    await fn();
  } finally {
    await pg.exec("reset role");
  }
}
describe("PostgreSQL migrations and account isolation", () => {
  it("applies all migrations and creates profiles", async () => {
    const r = await pg.query("select * from profiles");
    expect(r.rows).toHaveLength(2);
  });
  it("allows only the owner to read academic data", async () => {
    await asUser(alice, async () => {
      expect((await pg.query("select id from documents")).rows).toHaveLength(1);
    });
    await asUser(bob, async () => {
      expect((await pg.query("select id from documents")).rows).toHaveLength(0);
      expect((await pg.query("select id from modules")).rows).toHaveLength(0);
    });
  });
  it("denies anonymous document access", async () => {
    await pg.exec("set role anon");
    try {
      await expect(pg.query("select * from documents")).rejects.toThrow();
    } finally {
      await pg.exec("reset role");
    }
  });
  it("never exposes encrypted OAuth credentials even to the owner", async () => {
    await asUser(alice, async () => {
      expect(
        (await pg.query("select user_id from drive_connections")).rows,
      ).toHaveLength(1);
      await expect(
        pg.query("select encrypted_tokens from drive_connections"),
      ).rejects.toThrow();
    });
  });
  it("denies user access to privileged RPCs and forged results", async () => {
    await asUser(bob, async () => {
      await expect(
        pg.query("select reserve_ai_call($1,100,$2,$3)", [
          alice,
          "generate",
          "test",
        ]),
      ).rejects.toThrow();
      await expect(
        pg.query(
          `insert into quiz_attempts(user_id,quiz_id,score,total) values($1,$2,10,10)`,
          [bob, quizId],
        ),
      ).rejects.toThrow();
    });
  });
  it("rejects cross-account foreign-key associations", async () => {
    await expect(
      pg.query(
        `insert into documents(user_id,drive_id,name,mime_type,module_id,created_at,modified_at,version,source_url) values($1,'bad','bad','text/plain',$2,now(),now(),'1','x')`,
        [bob, moduleId],
      ),
    ).rejects.toThrow();
  });
  it("enforces daily quotas and API rate limits", async () => {
    await pg.query("select reserve_ai_call($1,1,$2,$3)", [
      alice,
      "generate",
      "test",
    ]);
    await expect(
      pg.query("select reserve_ai_call($1,1,$2,$3)", [
        alice,
        "generate",
        "test",
      ]),
    ).rejects.toThrow("DAILY_AI_LIMIT");
    const a = await pg.query<{ check_rate_limit: boolean }>(
      "select check_rate_limit($1,$2,1,60)",
      [alice, "test"],
    );
    const b = await pg.query<{ check_rate_limit: boolean }>(
      "select check_rate_limit($1,$2,1,60)",
      [alice, "test"],
    );
    expect(a.rows[0].check_rate_limit).toBe(true);
    expect(b.rows[0].check_rate_limit).toBe(false);
  });
});
describe("persisted scoring and review", () => {
  beforeAll(async () => {
    await pg.query(
      `insert into quizzes(id,user_id,title,module_id,kind,duration_minutes,cache_key) values($1,$2,'Exam',$3,'exam',1,'test')`,
      [quizId, alice, moduleId],
    );
    await pg.query(
      `insert into questions(id,user_id,quiz_id,ordinal,payload) values($1,$2,$3,0,$4)`,
      [
        qId,
        alice,
        quizId,
        JSON.stringify({
          statement: "Question test",
          options: ["A", "B"],
          correctIndices: [0],
          topic: "Containers",
        }),
      ],
    );
    await pg.query(
      `insert into exam_attempts(id,user_id,quiz_id) values($1,$2,$3)`,
      [runId, alice, quizId],
    );
  });
  it("scores and persists answers atomically and idempotently", async () => {
    const answers = JSON.stringify({ [qId]: [0] });
    const r = await pg.query<{
      result: { score: number; total: number; grade20: number };
    }>("select submit_attempt($1,$2,$3) as result", [alice, runId, answers]);
    expect(r.rows[0].result.score).toBe(1);
    expect(r.rows[0].result.grade20).toBe(20);
    await pg.query("select submit_attempt($1,$2,$3)", [
      alice,
      runId,
      JSON.stringify({ [qId]: [1] }),
    ]);
    const attempts = await pg.query("select * from quiz_attempts");
    expect(attempts.rows).toHaveLength(1);
    const progress = await pg.query<{ correct: number; total: number }>(
      "select correct,total from learning_progress",
    );
    expect(progress.rows[0]).toEqual({ correct: 1, total: 1 });
    expect((await pg.query("select * from quiz_answers")).rows).toHaveLength(1);
  });
  it("does not allow another account to submit an attempt", async () => {
    await expect(
      pg.query("select submit_attempt($1,$2,$3)", [bob, runId, "{}"]),
    ).rejects.toThrow();
  });
  it("uses saved answers after an exam expires", async () => {
    const r = await pg.query<{ id: string }>(
      `insert into exam_attempts(user_id,quiz_id,started_at,answers) values($1,$2,now()-interval '2 minutes',$3) returning id`,
      [alice, quizId, JSON.stringify({ [qId]: [1] })],
    );
    const done = await pg.query<{ result: { score: number } }>(
      "select submit_attempt($1,$2,$3) as result",
      [alice, r.rows[0].id, JSON.stringify({ [qId]: [0] })],
    );
    expect(done.rows[0].result.score).toBe(0);
  });
  it("keeps review scheduling consistent with SM-2", async () => {
    const card = await pg.query<{ id: string }>(
      `insert into flashcards(user_id,document_id,question,answer,source) values($1,$2,'Question','Answer','{}') returning id`,
      [alice, docId],
    );
    await pg.query("select review_card($1,$2,4)", [alice, card.rows[0].id]);
    const state = await pg.query<{
      repetitions: number;
      interval_days: number;
      ease: string;
    }>("select repetitions,interval_days,ease from flashcards where id=$1", [
      card.rows[0].id,
    ]);
    const expected = sm2({ repetitions: 0, intervalDays: 0, ease: 2.5 }, 4);
    expect(state.rows[0].repetitions).toBe(expected.repetitions);
    expect(state.rows[0].interval_days).toBe(expected.intervalDays);
    expect(Number(state.rows[0].ease)).toBeCloseTo(expected.ease);
  });
});

describe("job and exam safeguards", () => {
  it("rejects late autosaves atomically", async () => {
    const run = await pg.query<{ id: string }>(
      `insert into exam_attempts(user_id,quiz_id,started_at) values($1,$2,now()-interval '3 minutes') returning id`,
      [alice, quizId],
    );
    const saved = await pg.query<{ saved: boolean }>(
      "select save_answers($1,$2,$3) as saved",
      [alice, run.rows[0].id, JSON.stringify({ [qId]: [0] })],
    );
    expect(saved.rows[0].saved).toBe(false);
    await pg.query("select submit_attempt($1,$2,$3)", [
      alice,
      run.rows[0].id,
      "{}",
    ]);
  });
  it("does not publish chunks from an obsolete document version", async () => {
    const job = await pg.query<{ id: string }>(
      `insert into document_processing_jobs(user_id,document_id,version) values($1,$2,'old-version') returning id`,
      [alice, docId],
    );
    const r = await pg.query<{ finished: boolean }>(
      "select finish_document($1,$2,$3,$4,$5) as finished",
      [job.rows[0].id, alice, docId, "old-version", "[]"],
    );
    expect(r.rows[0].finished).toBe(false);
    expect(
      (
        await pg.query("select id from document_chunks where document_id=$1", [
          docId,
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
