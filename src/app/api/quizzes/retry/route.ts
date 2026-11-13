import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { missedQuestions } from "@/lib/learning/retry";
export async function POST(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "retry-quiz", 10);
    const { attemptId } = await readJson(
      request,
      z.object({ attemptId: z.uuid() }),
    );
    const attempt = checked(
      await db
        .from("exam_attempts")
        .select("id,quiz_id,answers,submitted_at")
        .eq("id", attemptId)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!attempt) throw new HttpError(404, "Résultat introuvable.");
    if (!attempt.submitted_at)
      throw new HttpError(409, "Terminez le QCM avant de revoir vos erreurs.");
    const original = checked(
      await db
        .from("quizzes")
        .select("title,module_id")
        .eq("id", attempt.quiz_id)
        .eq("user_id", user.id)
        .single(),
    );
    if (!original) throw new HttpError(404, "QCM introuvable.");
    const questions =
      checked(
        await db
          .from("questions")
          .select("id,payload")
          .eq("quiz_id", attempt.quiz_id)
          .eq("user_id", user.id)
          .order("ordinal"),
      ) ?? [];
    const missed = missedQuestions(questions, attempt.answers);
    if (!missed.length)
      throw new HttpError(
        422,
        "Bravo, aucune erreur à retravailler dans cette tentative.",
      );
    const writer = admin();
    const quiz = checked(
      await writer
        .from("quizzes")
        .insert({
          user_id: user.id,
          title:
            "Mes erreurs · " +
            original.title.replace(/^Mes erreurs · /, "").slice(0, 240),
          module_id: original.module_id,
          kind: "quiz",
          duration_minutes: null,
          cache_key: "retry:" + attempt.id + ":" + crypto.randomUUID(),
        })
        .select("id")
        .single(),
    )!;
    const inserted = await writer
      .from("questions")
      .insert(
        missed.map((q, ordinal) => ({
          user_id: user.id,
          quiz_id: quiz.id,
          ordinal,
          payload: q.payload,
        })),
      );
    if (inserted.error) {
      await writer
        .from("quizzes")
        .delete()
        .eq("id", quiz.id)
        .eq("user_id", user.id);
      throw inserted.error;
    }
    return NextResponse.json(
      { id: quiz.id, count: missed.length },
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
