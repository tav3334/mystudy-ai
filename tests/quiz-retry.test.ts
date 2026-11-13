import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  apiUser: vi.fn(),
  from: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/api")>()),
  apiUser: mocks.apiUser,
}));
vi.mock("../src/lib/supabase/server", () => ({
  admin: () => ({ from: mocks.write }),
  requireUser: vi.fn(),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  },
}));
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/quizzes/retry/route";
import { missedQuestions } from "../src/lib/learning/retry";
const attemptId = "a226f211-c5e2-4c60-a6ab-c1407d35485e";
const payload = {
  statement: "Que permet Docker dans le cours ?",
  options: ["Isoler les processus", "Effacer le système"],
  correctIndices: [0],
  explanation: "Docker isole les processus dans des conteneurs.",
  difficulty: "Facile" as const,
  topic: "Docker",
  source: {
    chunkId: attemptId,
    quote: "Docker isole les processus dans des conteneurs.",
    document_name: "Docker.pdf",
    source_url: "https://drive.google.com/file/d/course/view",
    page: 3,
    section: "Isolation",
  },
};
function builder(data: unknown, error: unknown = null) {
  const b = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  for (const method of [
    b.select,
    b.eq,
    b.maybeSingle,
    b.single,
    b.order,
    b.insert,
    b.delete,
  ])
    method.mockReturnValue(b);
  return b;
}
function request(body: unknown = { attemptId }) {
  return new NextRequest(
    "https://mystudy-ai-two.vercel.app/api/quizzes/retry",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiUser.mockResolvedValue({
    user: { id: "owner" },
    db: { from: mocks.from },
  });
});
describe("targeted revision", () => {
  it("includes unanswered and partially correct answers, with source snapshots intact", () => {
    const qs = [
      { id: "correct", payload },
      { id: "partial", payload: { ...payload, correctIndices: [0, 1] } },
      { id: "empty", payload },
    ];
    const missed = missedQuestions(qs, { correct: [0], partial: [0] });
    expect(missed.map((q) => q.id)).toEqual(["partial", "empty"]);
    expect(missed[1].payload.source).toBe(payload.source);
  });
  it("uses only the authenticated account and submitted answers, never client-supplied questions", async () => {
    const attempt = builder({
      id: attemptId,
      quiz_id: "original",
      submitted_at: "2026-11-13",
      answers: { right: [0], wrong: [1] },
    });
    const original = builder({ title: "QCM Docker", module_id: null });
    const questions = builder([
      { id: "right", payload },
      { id: "wrong", payload },
    ]);
    mocks.from.mockImplementation(
      (t) =>
        ({ exam_attempts: attempt, quizzes: original, questions })[
          t as "questions"
        ],
    );
    const quiz = builder({ id: "retry-id" });
    const insert = builder(null);
    mocks.write.mockImplementation((t) => (t === "quizzes" ? quiz : insert));
    const response = await POST(
      request({
        attemptId,
        answers: { wrong: [0] },
        questions: ["injected"],
        userId: "other",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "retry-id", count: 1 });
    for (const q of [attempt, original, questions])
      expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(quiz.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner",
        kind: "quiz",
        duration_minutes: null,
      }),
    );
    expect(insert.insert).toHaveBeenCalledWith([
      { user_id: "owner", quiz_id: "retry-id", ordinal: 0, payload },
    ]);
  });
  it("rejects inaccessible attempts before any administrative write", async () => {
    mocks.from.mockReturnValue(builder(null));
    expect((await POST(request())).status).toBe(404);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects unfinished attempts without revealing answers", async () => {
    mocks.from.mockReturnValue(builder({ submitted_at: null }));
    expect((await POST(request())).status).toBe(409);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("creates nothing when every answer is correct", async () => {
    mocks.from.mockImplementation((t) =>
      builder(
        t === "exam_attempts"
          ? {
              id: attemptId,
              quiz_id: "q",
              submitted_at: "date",
              answers: { right: [0] },
            }
          : t === "quizzes"
            ? { title: "q" }
            : [{ id: "right", payload }],
      ),
    );
    expect((await POST(request())).status).toBe(422);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("cleans up a new quiz if saving its questions fails", async () => {
    mocks.from.mockImplementation((t) =>
      builder(
        t === "exam_attempts"
          ? { id: attemptId, quiz_id: "q", submitted_at: "date", answers: {} }
          : t === "quizzes"
            ? { title: "q" }
            : [{ id: "wrong", payload }],
      ),
    );
    const quiz = builder({ id: "retry-id" });
    mocks.write.mockImplementation((t) =>
      t === "quizzes" ? quiz : builder(null, new Error("storage unavailable")),
    );
    expect((await POST(request())).status).toBe(500);
    expect(quiz.delete).toHaveBeenCalledOnce();
    expect(quiz.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("requires authentication and valid attempt identifiers", async () => {
    mocks.apiUser.mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ attemptId: "invalid" }))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
