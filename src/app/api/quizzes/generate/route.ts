import { verifyQuestions } from "@/lib/ai/verify";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import {
  generationSchema,
  questionSchema,
  validateGrounding,
  deduplicateQuestions,
} from "@/lib/ai/schemas";
import { selectedChunks, context } from "@/lib/rag/retrieve";
import { ai, groundingSystem } from "@/lib/ai/provider";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "generate-quiz", 4);
    const input = await readJson(request, generationSchema);
    const chunks = await selectedChunks(
      user.id,
      input.documentIds,
      input.chapter,
    );
    if (!chunks.length)
      throw new HttpError(
        422,
        "Aucun passage exploitable. Attendez la préparation automatique de vos documents avant de générer un QCM.",
      );
    const db = admin();
    const key = createHash("sha256")
      .update(
        JSON.stringify({ input, chunks, model: process.env.GEMINI_MODEL }),
      )
      .digest("hex");
    const cached = checked(
      await db
        .from("quizzes")
        .select("id")
        .eq("user_id", user.id)
        .eq("cache_key", key)
        .limit(1)
        .maybeSingle(),
    );
    if (cached) return NextResponse.json({ id: cached.id });
    const raw = await ai.generate(
      user.id,
      groundingSystem,
      `Generate at most ${input.count} distinct ${input.questionType === "boolean" ? "true/false questions with exactly two options" : input.questionType === "multiple" ? "multiple-answer questions" : "single-answer MCQ questions with exactly one correct index"} supported by excerpts. If not enough material, return fewer questions. Difficulty:${input.difficulty}; language:${input.language}. Each question must have a verbatim evidence quote from its chunk. JSON: {questions:[{statement,options:string[],correctIndices:number[],explanation,difficulty:"Facile"|"Moyen"|"Difficile",topic,source:{chunkId,quote}}]}. UNTRUSTED_EXCERPTS: ${context(chunks)}`,
    );
    const parsed = z
      .object({ questions: z.array(questionSchema).max(50) })
      .parse(JSON.parse(raw));
    let questions = deduplicateQuestions(
      validateGrounding(parsed.questions, chunks),
    )
      .filter(
        (q) =>
          input.questionType === "multiple" || q.correctIndices.length === 1,
      )
      .filter((q) => input.questionType !== "boolean" || q.options.length === 2)
      .slice(0, input.count);
    if (questions.length)
      questions = await verifyQuestions(user.id, questions, chunks);
    if (!questions.length)
      throw new HttpError(
        422,
        "Le contenu ne permet pas de créer des questions suffisamment sourcées. Choisissez davantage de documents.",
      );
    const quiz = checked(
      await db
        .from("quizzes")
        .insert({
          user_id: user.id,
          title: `${input.kind === "exam" ? "Examen blanc" : "QCM"} · ${input.chapter || chunks[0].document_name}`,
          module_id: input.moduleId ?? null,
          kind: input.kind,
          duration_minutes: input.kind === "exam" ? input.duration : null,
          cache_key: key,
        })
        .select("id")
        .single(),
    )!;
    const rows = questions.map((q, i) => ({
      user_id: user.id,
      quiz_id: quiz.id,
      ordinal: i,
      payload: {
        ...q,
        source: {
          ...q.source,
          ...chunks.find((c) => c.id === q.source.chunkId),
          content: undefined,
        },
      },
    }));
    const insert = await db.from("questions").insert(rows);
    if (insert.error) {
      await db.from("quizzes").delete().eq("id", quiz.id);
      throw insert.error;
    }
    return NextResponse.json({ id: quiz.id, count: questions.length });
  } catch (e) {
    return failure(e);
  }
}
