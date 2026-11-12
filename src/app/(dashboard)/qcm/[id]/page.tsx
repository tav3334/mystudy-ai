import { notFound } from "next/navigation";
import { z } from "zod";
import { QuizPlayer } from "@/components/quiz/player";
export default async function Quiz({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <QuizPlayer quizId={id} />;
}
