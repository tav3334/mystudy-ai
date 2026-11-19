import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), configured: vi.fn() }));
vi.mock("../src/lib/env", () => ({ hasSupabase: mocks.configured }));
vi.mock("../src/lib/supabase/server", () => ({
  supabase: async () => ({ from: mocks.from }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  },
}));
import { renderToStaticMarkup } from "react-dom/server";
import { QuizLibrary } from "../src/components/quiz/library";
import { resumeQuestionIndex } from "../src/lib/learning/resume";
function query(data: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    is: vi.fn(),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  for (const f of [q.select, q.eq, q.order, q.limit, q.is])
    f.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
});
describe("saved questionnaire library", () => {
  it("shows active sessions before saved questionnaires without duplicating them", async () => {
    const saved = query([
      {
        id: "active",
        title: "Docker actif",
        questions: [{ count: 28 }],
        created_at: "2026-11-14",
      },
      {
        id: "new",
        title: "Git sauvegardé",
        questions: [{ count: 30 }],
        created_at: "2026-11-14",
      },
    ]);
    const active = query([
      {
        id: "attempt",
        quiz_id: "active",
        answers: { q1: [0], q2: [] },
        started_at: "2026-11-14",
        quizzes: {
          id: "active",
          title: "Docker actif",
          kind: "quiz",
          duration_minutes: null,
        },
      },
    ]);
    mocks.from.mockImplementation((t) =>
      t === "modules" ? query([]) : t === "quizzes" ? saved : active,
    );
    const html = renderToStaticMarkup(await QuizLibrary({}));
    expect(html.indexOf("À reprendre")).toBeLessThan(
      html.indexOf("Mes QCM enregistrés"),
    );
    expect(html.match(/Docker actif/g)).toHaveLength(1);
    expect(html).toContain('href="/qcm/active"');
    expect(html).toContain("1 réponse enregistrée");
    expect(html).toContain("30 questions");
    expect(html).toContain('href="/qcm/new"');
    expect(saved.eq).toHaveBeenCalledWith("kind", "quiz");
    expect(active.eq).toHaveBeenCalledWith("quizzes.kind", "quiz");
    expect(active.is).toHaveBeenCalledWith("submitted_at", null);
  });
  it("makes expired exams accessible while honestly keeping their timer", async () => {
    const saved = query([]);
    const active = query([
      {
        id: "attempt",
        quiz_id: "exam",
        answers: {},
        started_at: "2020-01-01",
        quizzes: [{ title: "Examen Docker", duration_minutes: 30 }],
      },
    ]);
    mocks.from.mockImplementation((t) =>
      t === "modules" ? query([]) : t === "quizzes" ? saved : active,
    );
    const html = renderToStaticMarkup(await QuizLibrary({ exam: true }));
    expect(html).toContain("Le chronomètre continue pendant votre absence");
    expect(html).toContain('href="/qcm/exam"');
    expect(active.eq).toHaveBeenCalledWith("quizzes.kind", "exam");
  });
  it("does not query without a configured session database", async () => {
    mocks.configured.mockReturnValue(false);
    expect(await QuizLibrary({})).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
describe("resume position", () => {
  it("resumes at the first unanswered question", () => {
    expect(
      resumeQuestionIndex([{ id: "a" }, { id: "b" }, { id: "c" }], {
        a: [1],
        b: [],
        c: [0],
      }),
    ).toBe(1);
  });
  it("returns the last question when all are answered, ready to submit", () => {
    expect(
      resumeQuestionIndex([{ id: "a" }, { id: "b" }], { a: [0], b: [1] }),
    ).toBe(1);
    expect(resumeQuestionIndex([], {})).toBe(0);
  });
});
