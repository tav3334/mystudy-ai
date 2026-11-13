import { scoreQuestions, type Question } from "@/lib/ai/schemas";
export function missedQuestions<T extends { id: string; payload: Question }>(
  questions: T[],
  answers: Record<string, number[]>,
) {
  const missed = new Set(
    scoreQuestions(questions, answers)
      .filter((q) => !q.correct)
      .map((q) => q.questionId),
  );
  return questions.filter((q) => missed.has(q.id));
}
