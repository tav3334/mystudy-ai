import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser, admin, checked } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { QuizPlayer } from "@/components/quiz/player";
export default async function SavedResult({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasSupabase() || !z.uuid().safeParse(id).success) notFound();
  const { db, user } = await requireUser();
  const attempt = checked(
    await db
      .from("exam_attempts")
      .select("*")
      .eq("id", id)
      .not("submitted_at", "is", null)
      .maybeSingle(),
  );
  if (!attempt) notFound();
  const quiz = checked(
    await db.from("quizzes").select("*").eq("id", attempt.quiz_id).single(),
  );
  if (!quiz) notFound();
  const result = checked(
    await admin().rpc("submit_attempt", {
      p_user: user.id,
      p_attempt: id,
      p_answers: {},
    }),
  );
  return (
    <QuizPlayer
      quizId={quiz.id}
      initialReview={{ game: { quiz, attempt, questions: [] }, result }}
    />
  );
}
