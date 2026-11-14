import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn(), verify: vi.fn() }));
vi.mock("../src/lib/ai/provider", () => ({
  ai: { generate: mocks.generate },
  groundingSystem: "Ground only in sources",
}));
vi.mock("../src/lib/ai/verify", () => ({ verifyQuestions: mocks.verify }));
vi.mock("../src/lib/rag/retrieve", () => ({
  context: (chunks: unknown) => JSON.stringify(chunks),
}));
import { generateQuestionBatches } from "../src/lib/ai/question-batches";
import {
  generationSchema,
  type Question,
  type SourceChunk,
} from "../src/lib/ai/schemas";
import { AIProviderError } from "../src/lib/ai/errors";
import { spreadAcross, interleave } from "../src/lib/rag/spread";
const chunks: SourceChunk[] = Array.from({ length: 96 }, (_, i) => ({
  id: "a226f211-c5e2-4c60-a6ab-" + String(i).padStart(12, "0"),
  document_id: "d226f211-c5e2-4c60-a6ab-c1407d35485e",
  content: "Docker permet de créer des conteneurs isolés sur le système hôte.",
  section: "Section " + i,
  page: i + 1,
  document_name: "Docker.pdf",
  source_url: "https://drive.google.com/file/d/course/view",
}));
let serial = 0;
function question(source = chunks[0]): Question {
  return {
    statement:
      "Quel mécanisme correspond à la notion numéro " + ++serial + " ?",
    options: ["Le mécanisme décrit", "Un mécanisme différent"],
    correctIndices: [0],
    explanation: "Le mécanisme est justifié par le passage sélectionné.",
    difficulty: "Facile",
    topic: "Docker",
    source: { chunkId: source.id, quote: source.content },
  };
}
function input(count = 30, kind: "quiz" | "exam" = "quiz") {
  return generationSchema.parse({
    documentIds: [chunks[0].document_id],
    count,
    kind,
  });
}
beforeEach(() => {
  serial = 0;
  vi.clearAllMocks();
  mocks.verify.mockImplementation(async (_user, qs) => qs);
  mocks.generate.mockImplementation(async (_user, _system, prompt: string) => {
    const count = Number(prompt.match(/^Generate (\d+)/)?.[1]);
    const batch = JSON.parse(
      prompt.split(". UNTRUSTED_EXCERPTS: ")[1],
    ) as SourceChunk[];
    return JSON.stringify({
      questions: Array.from({ length: count }, () => question(batch[0])),
    });
  });
});
afterEach(() => vi.restoreAllMocks());
describe("bounded verified question batches", () => {
  it.each(["quiz", "exam"] as const)(
    "reaches 30 for %s despite an initial short batch",
    async (kind) => {
      mocks.generate.mockImplementationOnce(async () =>
        JSON.stringify({
          questions: Array.from({ length: 6 }, () => question()),
        }),
      );
      const result = await generateQuestionBatches(
        "owner",
        input(30, kind),
        chunks,
      );
      expect(result.questions).toHaveLength(30);
      expect(result.reason).toBe("target");
      expect(mocks.generate).toHaveBeenCalledTimes(4);
      expect(mocks.verify).toHaveBeenCalledTimes(4);
      expect(mocks.generate.mock.calls[1][2]).toContain(chunks[12].id);
      expect(mocks.generate.mock.calls[1][2]).toContain(
        result.questions[0].statement,
      );
    },
  );
  it("compensates for questions rejected by the source audit", async () => {
    mocks.verify.mockImplementationOnce(async (_u, qs: Question[]) =>
      qs.slice(0, 3),
    );
    expect(
      (await generateQuestionBatches("owner", input(16), chunks)).questions,
    ).toHaveLength(16);
    expect(mocks.generate).toHaveBeenCalledTimes(3);
  });
  it("caps the final batch and never exceeds the requested number", async () => {
    const result = await generateQuestionBatches("owner", input(50), chunks);
    expect(result.questions).toHaveLength(50);
    expect(mocks.generate).toHaveBeenCalledTimes(7);
    expect(mocks.generate.mock.calls[6][2]).toMatch(/^Generate 2 /);
  });
  it("retains validated questions when a later Google quota is reached", async () => {
    mocks.generate
      .mockImplementationOnce(async () =>
        JSON.stringify({ questions: [question()] }),
      )
      .mockRejectedValueOnce(new AIProviderError("AI_QUOTA", 429));
    const result = await generateQuestionBatches("owner", input(), chunks);
    expect(result.questions).toHaveLength(1);
    expect(result.reason).toBe("quota");
  });
  it("does not hide provider errors when no verified question exists", async () => {
    mocks.generate.mockRejectedValueOnce(
      new AIProviderError("AI_KEY_INVALID", 401),
    );
    await expect(
      generateQuestionBatches("owner", input(), chunks),
    ).rejects.toMatchObject({ code: "AI_KEY_INVALID" });
  });
  it("removes repetitions, invented quotes and invalid answers before auditing", async () => {
    const q = question();
    mocks.generate.mockResolvedValue(
      JSON.stringify({
        questions: [
          q,
          q,
          {
            ...question(),
            source: {
              ...q.source,
              quote:
                "Un extrait totalement inventé qui ne figure pas dans ce cours.",
            },
          },
          { ...question(), correctIndices: [7] },
        ],
      }),
    );
    const result = await generateQuestionBatches(
      "owner",
      input(8),
      chunks.slice(0, 1),
    );
    expect(result.questions).toHaveLength(1);
    expect(result.reason).toBe("sources");
    expect(mocks.generate).toHaveBeenCalledTimes(4);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });
  it("requires the requested single-answer or boolean format", async () => {
    mocks.generate.mockResolvedValue(
      JSON.stringify({
        questions: [{ ...question(), options: ["A", "B", "C"] }],
      }),
    );
    const result = await generateQuestionBatches(
      "owner",
      { ...input(), questionType: "boolean" },
      chunks,
    );
    expect(result.questions).toHaveLength(0);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.generate).toHaveBeenCalledTimes(3);
  });
  it("continues after malformed output instead of losing subsequent valid batches", async () => {
    mocks.generate.mockResolvedValueOnce("invalid JSON");
    expect(
      (await generateQuestionBatches("owner", input(8), chunks)).questions,
    ).toHaveLength(8);
  });
  it("stops within the bounded budget and keeps verified results", async () => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.verify.mockImplementation(async (_u, qs) => {
      now += 240000;
      return qs;
    });
    const result = await generateQuestionBatches("owner", input(30), chunks);
    expect(result.questions).toHaveLength(8);
    expect(result.reason).toBe("time");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
});
describe("coverage across course passages", () => {
  it("covers beginning and end without duplicates", () => {
    const selected = spreadAcross(
      Array.from({ length: 150 }, (_, i) => i),
      12,
    );
    expect(selected).toHaveLength(12);
    expect(selected[0]).toBe(0);
    expect(selected[11]).toBe(149);
    expect(new Set(selected).size).toBe(12);
  });
  it("interleaves documents so early batches include every selected course", () => {
    expect(interleave([["a1", "a2"], ["b1"], ["c1", "c2"]])).toEqual([
      "a1",
      "b1",
      "c1",
      "a2",
      "c2",
    ]);
    expect(spreadAcross([], 8)).toEqual([]);
  });
});
