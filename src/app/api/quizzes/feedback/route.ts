import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { checked } from "@/lib/supabase/server";
import { scoreQuestions } from "@/lib/ai/schemas";
export async function POST(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "training-feedback", 90);
    const input = await readJson(
      request,
      z.object({ attemptId: z.uuid(), questionId: z.uuid() }),
    );
    const attempt = checked(
      await db
        .from("exam_attempts")
        .select("quiz_id,answers,submitted_at")
        .eq("id", input.attemptId)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!attempt) throw new HttpError(404, "Session introuvable.");
    if (attempt.submitted_at)
      throw new HttpError(
        409,
        "Cette session est terminée. Consultez sa correction.",
      );
    const quiz = checked(
      await db
        .from("quizzes")
        .select("kind")
        .eq("id", attempt.quiz_id)
        .eq("user_id", user.id)
        .single(),
    );
    if (quiz?.kind !== "quiz")
      throw new HttpError(
        403,
        "La correction des examens est disponible uniquement à la fin.",
      );
    const question = checked(
      await db
        .from("questions")
        .select("id,payload")
        .eq("id", input.questionId)
        .eq("quiz_id", attempt.quiz_id)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!question) throw new HttpError(404, "Question introuvable.");
    if (!attempt.answers?.[question.id]?.length)
      throw new HttpError(
        422,
        "Enregistrez votre réponse avant de la vérifier.",
      );
    const feedback = scoreQuestions([question], attempt.answers)[0];
    return NextResponse.json({
      correct: feedback.correct,
      correctIndices: feedback.correctIndices,
      explanation: feedback.explanation,
      source: feedback.source,
    });
  } catch (e) {
    return failure(e);
  }
}
