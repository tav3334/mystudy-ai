export function resumeQuestionIndex(
  questions: { id: string }[],
  answers: Record<string, number[]>,
) {
  const next = questions.findIndex((q) => !answers[q.id]?.length);
  return next < 0 ? Math.max(0, questions.length - 1) : next;
}
