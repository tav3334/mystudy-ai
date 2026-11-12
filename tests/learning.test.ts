import { describe, it, expect } from "vitest";
import {
  questionSchema,
  validateGrounding,
  deduplicateQuestions,
  scoreQuestions,
  type SourceChunk,
} from "../src/lib/ai/schemas";
import { sm2 } from "../src/lib/learning/sm2";
import {
  classifyFolder,
  fileVersion,
  reconcileFiles,
} from "../src/lib/google-drive/reconcile";
import { chunkSections } from "../src/lib/document-processing/chunk";
const chunk: SourceChunk = {
  id: "a226f211-c5e2-4c60-a6ab-c1407d35485e",
  document_id: "d226f211-c5e2-4c60-a6ab-c1407d35485e",
  content:
    "Docker permet de créer des conteneurs isolés sur un même système hôte.",
  section: "Conteneurs",
  page: 3,
  document_name: "Cours Docker",
  source_url: "https://drive.google.com/file/d/test/view",
};
const question = {
  statement: "Que permet Docker dans ce cours ?",
  options: ["Créer des conteneurs", "Supprimer Linux"],
  correctIndices: [0],
  explanation: "Docker permet de créer des conteneurs isolés.",
  difficulty: "Facile" as const,
  topic: "Docker",
  source: {
    chunkId: chunk.id,
    quote: "Docker permet de créer des conteneurs isolés",
  },
};
describe("AI validation and grading", () => {
  it("rejects answer indices outside options", () => {
    expect(
      questionSchema.safeParse({ ...question, correctIndices: [8] }).success,
    ).toBe(false);
  });
  it("rejects malformed or duplicated options", () => {
    expect(
      questionSchema.safeParse({ ...question, options: ["Docker", "docker"] })
        .success,
    ).toBe(false);
  });
  it("rejects invented evidence and citations", () => {
    expect(validateGrounding([question], [chunk])).toHaveLength(1);
    expect(
      validateGrounding(
        [
          {
            ...question,
            source: {
              ...question.source,
              quote: "Kubernetes orchestre les clusters",
            },
          },
        ],
        [chunk],
      ),
    ).toHaveLength(0);
    expect(
      validateGrounding(
        [{ ...question, source: { ...question.source, chunkId: "unknown" } }],
        [chunk],
      ),
    ).toHaveLength(0);
  });
  it("removes repeated questions", () => {
    expect(
      deduplicateQuestions([
        question,
        { ...question, statement: "  QUE permet Docker dans ce cours?" },
      ]),
    ).toHaveLength(1);
  });
  it("requires all and only correct selections", () => {
    const questions = [
      { id: "q1", payload: { ...question, correctIndices: [0, 1] } },
    ];
    expect(scoreQuestions(questions, { q1: [1, 0] })[0].correct).toBe(true);
    expect(scoreQuestions(questions, { q1: [0] })[0].correct).toBe(false);
    expect(scoreQuestions(questions, { q1: [0, 1, 1] })[0].correct).toBe(false);
    expect(scoreQuestions(questions, {})[0].correct).toBe(false);
  });
});
describe("Drive reconciliation", () => {
  it("detects new, modified, restored, and removed files by Drive ID", () => {
    const result = reconcileFiles(
      [
        { drive_id: "a", version: "1", active: true },
        { drive_id: "b", version: "1", active: true },
        { drive_id: "gone", version: "1", active: true },
        { drive_id: "restored", version: "1", active: false },
      ],
      [
        { id: "a", version: "1" },
        { id: "b", version: "2" },
        { id: "new", version: "1" },
        { id: "restored", version: "1" },
      ],
    );
    expect(result).toEqual({
      added: ["new"],
      updated: ["b", "restored"],
      removed: ["gone"],
    });
  });
  it("does not reprocess unchanged content on metadata rename", () => {
    expect(
      fileVersion({ md5Checksum: "same", version: "2", modifiedTime: "new" }),
    ).toBe(
      fileVersion({ md5Checksum: "same", version: "1", modifiedTime: "old" }),
    );
  });
  it("inherits categories through nested folders", () => {
    expect(classifyFolder("TD")).toBe("TD");
    expect(classifyFolder("Chapitre 1", "TP")).toBe("TP");
    expect(classifyFolder("Annales")).toBe("Examens");
  });
});
describe("chunking", () => {
  it("retains source pages and headings with stable bounded chunks", () => {
    const s = [
      {
        content:
          "# Chapitre 1\n\n" +
          "Un conteneur partage le noyau du système. ".repeat(180),
        page: 7,
        section: null,
      },
    ];
    const a = chunkSections(s);
    expect(a.length).toBeGreaterThan(1);
    expect(
      a.every(
        (c) =>
          c.page === 7 &&
          c.section === "Chapitre 1" &&
          c.content.length <= 2400,
      ),
    ).toBe(true);
    expect(a).toEqual(chunkSections(s));
  });
  it("does not duplicate identical page content", () => {
    const p = {
      content: "Les conteneurs sont des processus isolés.",
      page: 1,
      section: null,
    };
    expect(chunkSections([p, p])).toHaveLength(1);
  });
});
describe("SM-2", () => {
  it("uses 1 day, 6 days, then ease-based intervals", () => {
    let s = { repetitions: 0, intervalDays: 0, ease: 2.5 };
    s = sm2(s, 4);
    expect(s.intervalDays).toBe(1);
    s = sm2(s, 4);
    expect(s.intervalDays).toBe(6);
    s = sm2(s, 4);
    expect(s.intervalDays).toBe(15);
  });
  it("resets forgotten cards and clamps ease", () => {
    const s = sm2({ repetitions: 4, intervalDays: 90, ease: 1.3 }, 0);
    expect(s).toEqual({ repetitions: 0, intervalDays: 1, ease: 1.3 });
    expect(() => sm2(s, 6)).toThrow();
  });
});
