import { generateQuestionBatches } from "@/lib/ai/question-batches";
import { generationModel } from "@/lib/ai/errors";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { generationSchema } from "@/lib/ai/schemas";
import { selectedChunks } from "@/lib/rag/retrieve";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "generate-quiz", 4);
    const input = await readJson(request, generationSchema);
    const chunks = await selectedChunks(
      user.id,
      input.documentIds,
      input.chapter,
      96,
    );
    if (!chunks.length)
      throw new HttpError(
        422,
        "Aucun passage exploitable. Attendez la préparation automatique de vos documents avant de générer un QCM.",
      );
    const db = admin();
    const key = createHash("sha256")
      .update(
        JSON.stringify({
          version: "batches-v1",
          input,
          chunks,
          model: generationModel(process.env.GEMINI_MODEL),
        }),
      )
      .digest("hex");
    const cached = checked(
      await db
        .from("quizzes")
        .select("id")
        .eq("user_id", user.id)
        .eq("cache_key", key)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (cached) {
      const saved = await db
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", cached.id)
        .eq("user_id", user.id);
      if (saved.error) throw saved.error;
      if (saved.count === input.count)
        return NextResponse.json({
          id: cached.id,
          count: saved.count,
          requested: input.count,
          reason: "target",
        });
    }
    const { questions, reason } = await generateQuestionBatches(
      user.id,
      input,
      chunks,
    );
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
    return NextResponse.json({
      id: quiz.id,
      count: questions.length,
      requested: input.count,
      reason,
    });
  } catch (e) {
    return failure(e);
  }
}
