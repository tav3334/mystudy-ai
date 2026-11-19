import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  apiUser: mocks.auth,
}));
vi.mock("../src/lib/supabase/server", () => ({
  requireUser: vi.fn(),
  admin: () => ({ from: mocks.write }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  },
}));
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../src/app/api/quizzes/manage/route";
import { POST } from "../src/app/api/quizzes/feedback/route";
const quizId = "a226f211-c5e2-4c60-a6ab-c1407d35485e",
  attemptId = "b226f211-c5e2-4c60-a6ab-c1407d35485e",
  questionId = "c226f211-c5e2-4c60-a6ab-c1407d35485e",
  moduleId = "d226f211-c5e2-4c60-a6ab-c1407d35485e";
function query(data: unknown, error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  for (const fn of [
    q.select,
    q.eq,
    q.maybeSingle,
    q.single,
    q.update,
    q.delete,
  ])
    fn.mockReturnValue(q);
  return q;
}
function request(method: string, body: unknown) {
  return new NextRequest(
    "https://mystudy-ai-two.vercel.app/api/quizzes/manage",
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "owner" },
    db: { from: mocks.from },
  });
});
describe("questionnaire management", () => {
  it("renames and classifies only into an owned module", async () => {
    const read = query({ id: quizId });
    const ownedModule = query({ id: moduleId });
    const write = query(null);
    mocks.from.mockImplementation((t) =>
      t === "modules" ? ownedModule : read,
    );
    mocks.write.mockReturnValue(write);
    expect(
      (
        await PATCH(
          request("PATCH", {
            quizId,
            title: "  Docker révision  ",
            moduleId,
            userId: "foreign",
          }),
        )
      ).status,
    ).toBe(200);
    expect(read.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(ownedModule.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(write.update).toHaveBeenCalledWith({
      title: "Docker révision",
      module_id: moduleId,
    });
    expect(write.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("rejects another account's module", async () => {
    mocks.from.mockImplementation((t) =>
      query(t === "modules" ? null : { id: quizId }),
    );
    expect(
      (await PATCH(request("PATCH", { quizId, title: "Docker", moduleId })))
        .status,
    ).toBe(404);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each(["PATCH", "DELETE"])(
    "rejects inaccessible quizzes for %s before any writes",
    async (method) => {
      mocks.from.mockReturnValue(query(null));
      const handler = method === "PATCH" ? PATCH : DELETE;
      expect(
        (
          await handler(
            request(method, { quizId, title: "Docker", moduleId: null }),
          )
        ).status,
      ).toBe(404);
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );
  it("removes answer history and runs in dependency order with account constraints", async () => {
    mocks.from.mockReturnValue(query({ id: quizId }));
    const writes: ReturnType<typeof query>[] = [];
    mocks.write.mockImplementation(() => {
      const q = query(null);
      writes.push(q);
      return q;
    });
    expect((await DELETE(request("DELETE", { quizId }))).status).toBe(200);
    expect(mocks.write.mock.calls.map((c) => c[0])).toEqual([
      "quiz_attempts",
      "exam_attempts",
      "quizzes",
    ]);
    for (const q of writes) {
      expect(q.delete).toHaveBeenCalledOnce();
      expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
    }
    expect(writes[2].eq).toHaveBeenCalledWith("id", quizId);
  });
  it("rejects blank titles and unauthenticated deletion", async () => {
    expect(
      (await PATCH(request("PATCH", { quizId, title: " ", moduleId: null })))
        .status,
    ).toBe(400);
    mocks.auth.mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    expect((await DELETE(request("DELETE", { quizId }))).status).toBe(401);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
describe("training feedback", () => {
  const payload = {
    statement: "Que permet Docker dans le cours ?",
    options: ["Isoler", "Effacer"],
    correctIndices: [0],
    explanation: "Docker isole les processus.",
    difficulty: "Facile",
    topic: "Docker",
    source: {
      quote: "Docker permet de créer des conteneurs isolés.",
      chunkId: questionId,
      document_name: "Docker.pdf",
    },
  };
  function fixtures({
    kind = "quiz",
    answers = { [questionId]: [1] },
    submitted = null,
    found = true,
  }: {
    kind?: string;
    answers?: Record<string, number[]>;
    submitted?: string | null;
    found?: boolean;
  } = {}) {
    const queries: ReturnType<typeof query>[] = [];
    mocks.from.mockImplementation((t) => {
      const q = query(
        t === "exam_attempts"
          ? { quiz_id: quizId, answers, submitted_at: submitted }
          : t === "quizzes"
            ? { kind }
            : found
              ? { id: questionId, payload }
              : null,
      );
      queries.push(q);
      return q;
    });
    return queries;
  }
  it("returns only the saved question correction without an AI call or writes", async () => {
    const queries = fixtures();
    const result = await POST(
      request("POST", {
        attemptId,
        questionId,
        answers: { [questionId]: [0] },
      }),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      correct: false,
      correctIndices: [0],
      explanation: payload.explanation,
      source: payload.source,
    });
    for (const q of queries)
      expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(queries[2].eq).toHaveBeenCalledWith("quiz_id", quizId);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("never reveals an exam's answers before submission", async () => {
    fixtures({ kind: "exam" });
    expect(
      (await POST(request("POST", { attemptId, questionId }))).status,
    ).toBe(403);
    expect(mocks.from).not.toHaveBeenCalledWith("questions");
  });
  it("requires a saved answer and a matching question", async () => {
    fixtures({ answers: {} });
    expect(
      (await POST(request("POST", { attemptId, questionId }))).status,
    ).toBe(422);
    fixtures({ found: false });
    expect(
      (await POST(request("POST", { attemptId, questionId }))).status,
    ).toBe(404);
  });
  it("rejects missing and completed sessions", async () => {
    mocks.from.mockReturnValue(query(null));
    expect(
      (await POST(request("POST", { attemptId, questionId }))).status,
    ).toBe(404);
    fixtures({ submitted: "2026-11-19" });
    expect(
      (await POST(request("POST", { attemptId, questionId }))).status,
    ).toBe(409);
  });
});
