import { describe, it, expect } from "vitest";
import { rankSourceChunks } from "../src/lib/rag/keyword";
import type { SourceChunk } from "../src/lib/ai/schemas";
const base = {
  document_id: "doc",
  section: null,
  page: 1,
  document_name: "Cours",
  source_url: "https://drive.google.com/file/d/test/view",
};
const sources: SourceChunk[] = [
  {
    ...base,
    id: "docker",
    content:
      "Docker isole les processus dans des conteneurs. Les images Docker sont immuables.",
  },
  {
    ...base,
    id: "git",
    content: "Git conserve les versions du code et les commits.",
  },
  {
    ...base,
    id: "network",
    page: 9,
    section: "Réseaux Docker",
    content: "Les réseaux Docker permettent la communication entre conteneurs.",
  },
];
describe("local keyword retrieval without AI", () => {
  it("finds a chapter in the full text and retains source metadata", () => {
    const result = rankSourceChunks(sources, "reseaux Docker");
    expect(result[0].id).toBe("network");
    expect(result[0].page).toBe(9);
    expect(result[0].source_url).toContain("drive.google.com");
  });
  it("normalizes accents, punctuation and case", () => {
    expect(rankSourceChunks(sources, "RÉSEAUX, docker!")).toEqual(
      rankSourceChunks(sources, "reseaux Docker"),
    );
  });
  it("does not invent relevant passages for absent terms", () => {
    expect(rankSourceChunks(sources, "astronomie quantique")).toHaveLength(0);
  });
  it("ignores common French filler words", () => {
    expect(rankSourceChunks(sources, "les et dans")).toHaveLength(0);
    expect(rankSourceChunks(sources, "les commits de Git")[0].id).toBe("git");
  });
  it("returns a stable, bounded ordering", () => {
    expect(rankSourceChunks(sources, "Docker", 1)).toHaveLength(1);
    expect(rankSourceChunks(sources, "Docker")).toEqual(
      rankSourceChunks(sources, "Docker"),
    );
  });
});
