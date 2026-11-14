import "server-only";
import { z } from "zod";
import { ai, groundingSystem, type GenerationOptions } from "./provider";
import { AIProviderError } from "./errors";
import { verifyQuestions } from "./verify";
import {
  questionSchema,
  validateGrounding,
  deduplicateQuestions,
  type Question,
  type SourceChunk,
  generationSchema,
} from "./schemas";
import { context } from "@/lib/rag/retrieve";
type Input = z.infer<typeof generationSchema>;
export type BatchStop =
  "target" | "sources" | "quota" | "service" | "time" | "limit";
export async function generateQuestionBatches(
  userId: string,
  input: Input,
  chunks: SourceChunk[],
) {
  let questions: Question[] = [];
  let reason: BatchStop = "limit";
  let stalls = 0;
  const deadline = Date.now() + 240000;
  const rounds = Math.min(10, Math.ceil(input.count / 8) + 3);
  for (
    let round = 0;
    round < rounds && questions.length < input.count;
    round++
  ) {
    const budget = (): GenerationOptions => ({
      timeoutMs: Math.min(45000, Math.max(1, deadline - Date.now() - 10000)),
    });
    if (deadline - Date.now() < 15000) {
      reason = "time";
      break;
    }
    const start = (round * 12) % Math.max(1, chunks.length);
    const batch = [...chunks.slice(start), ...chunks.slice(0, start)].slice(
      0,
      12,
    );
    if (!batch.length) {
      reason = "sources";
      break;
    }
    const needed = Math.min(8, input.count - questions.length);
    try {
      const raw = await ai.generate(
        userId,
        groundingSystem,
        "Generate " +
          needed +
          " distinct " +
          (input.questionType === "boolean"
            ? "true/false questions with exactly two options"
            : input.questionType === "multiple"
              ? "multiple-answer questions"
              : "single-answer MCQ questions with exactly one correct index") +
          " supported by excerpts. Cover different facts, sections and pages. Return fewer ONLY when evidence is insufficient. Never repeat an existing question or simply rephrase it. Difficulty:" +
          input.difficulty +
          "; language:" +
          input.language +
          '. Each question needs a verbatim evidence quote. JSON: {questions:[{statement,options:string[],correctIndices:number[],explanation,difficulty:"Facile"|"Moyen"|"Difficile",topic,source:{chunkId,quote}}]}. EXISTING_QUESTIONS_UNTRUSTED: ' +
          JSON.stringify(questions.map((q) => q.statement)) +
          ". UNTRUSTED_EXCERPTS: " +
          context(batch),
        budget(),
      );
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new AIProviderError("AI_OUTPUT_INVALID");
      }
      const envelope = z
        .object({ questions: z.array(z.unknown()).max(50) })
        .safeParse(data);
      if (!envelope.success) throw new AIProviderError("AI_OUTPUT_INVALID");
      const valid = envelope.data.questions.flatMap((value) => {
        const parsed = questionSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      });
      const candidates = deduplicateQuestions([
        ...questions,
        ...validateGrounding(valid, batch),
      ])
        .slice(questions.length)
        .filter(
          (q) =>
            input.questionType === "multiple" || q.correctIndices.length === 1,
        )
        .filter(
          (q) => input.questionType !== "boolean" || q.options.length === 2,
        )
        .slice(0, needed);
      const verified = candidates.length
        ? await verifyQuestions(userId, candidates, batch, budget())
        : [];
      questions = deduplicateQuestions([...questions, ...verified]).slice(
        0,
        input.count,
      );
      stalls = verified.length ? 0 : stalls + 1;
      if (stalls >= 3) {
        reason = "sources";
        break;
      }
    } catch (error) {
      if (
        error instanceof AIProviderError &&
        ["AI_OUTPUT_INVALID", "AI_INCOMPLETE"].includes(error.code)
      ) {
        if (++stalls >= 3) {
          if (!questions.length) throw error;
          reason = "service";
          break;
        }
        continue;
      }
      if (!questions.length) throw error;
      reason =
        (error instanceof AIProviderError && error.code === "AI_QUOTA") ||
        (error instanceof Error && error.message.includes("DAILY_AI_LIMIT"))
          ? "quota"
          : "service";
      break;
    }
  }
  if (questions.length === input.count) reason = "target";
  return { questions, reason };
}
