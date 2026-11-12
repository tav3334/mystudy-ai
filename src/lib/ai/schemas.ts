import { z } from "zod";
export const sourceSchema = z.object({
  chunkId: z.uuid(),
  quote: z.string().min(20).max(800),
});
export const questionSchema = z
  .object({
    statement: z.string().min(10).max(3000),
    options: z.array(z.string().min(1).max(1000)).min(2).max(8),
    correctIndices: z.array(z.number().int().min(0)).min(1).max(8),
    explanation: z.string().min(10).max(4000),
    difficulty: z.enum(["Facile", "Moyen", "Difficile"]),
    topic: z.string().min(1).max(200),
    source: sourceSchema,
  })
  .superRefine((q, ctx) => {
    if (
      q.correctIndices.some((i) => i >= q.options.length) ||
      new Set(q.correctIndices).size !== q.correctIndices.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid answer indices" });
    if (
      new Set(q.options.map((s) => s.trim().toLowerCase())).size !==
      q.options.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate options" });
  });
export type Question = z.infer<typeof questionSchema>;
export type SourceChunk = {
  id: string;
  document_id: string;
  content: string;
  section: string | null;
  page: number | null;
  document_name: string;
  source_url: string;
};
function normalize(t: string) {
  return t.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}
export function validateGrounding<
  T extends { source: { chunkId: string; quote: string } },
>(items: T[], chunks: SourceChunk[]) {
  return items.filter((item) => {
    const source = chunks.find((c) => c.id === item.source.chunkId);
    return (
      source && normalize(source.content).includes(normalize(item.source.quote))
    );
  });
}
export function deduplicateQuestions(items: Question[]) {
  const seen = new Set<string>();
  return items.filter((q) => {
    const key = normalize(q.statement).replace(/[^\p{L}\p{N}]/gu, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function scoreQuestions(
  questions: { id: string; payload: Question }[],
  answers: Record<string, number[]>,
) {
  return questions.map((q) => {
    const selected = answers[q.id] ?? [];
    const correct =
      selected.length === q.payload.correctIndices.length &&
      new Set(selected).size === selected.length &&
      q.payload.correctIndices.every((i) => selected.includes(i));
    return { questionId: q.id, correct, selected, ...q.payload };
  });
}
export const generationSchema = z.object({
  documentIds: z.array(z.uuid()).min(1).max(8),
  moduleId: z.uuid().optional(),
  chapter: z.string().max(300).default(""),
  count: z.number().int().min(1).max(50).default(10),
  difficulty: z
    .enum(["Facile", "Moyen", "Difficile", "Mixte"])
    .default("Mixte"),
  language: z
    .enum(["Français", "Darija", "العربية", "English"])
    .default("Français"),
  questionType: z.enum(["single", "multiple", "boolean"]).default("single"),
  kind: z.enum(["quiz", "exam"]).default("quiz"),
  duration: z.number().int().min(1).max(300).default(30),
});
