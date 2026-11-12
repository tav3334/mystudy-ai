export type ReviewState = {
  repetitions: number;
  intervalDays: number;
  ease: number;
};
export function sm2(state: ReviewState, rating: number): ReviewState {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5)
    throw new Error("Rating must be 0–5");
  const repetitions = rating < 3 ? 0 : state.repetitions + 1;
  const ease = Math.max(
    1.3,
    state.ease + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02),
  );
  const intervalDays =
    rating < 3
      ? 1
      : repetitions === 1
        ? 1
        : repetitions === 2
          ? 6
          : Math.round(state.intervalDays * state.ease);
  return { repetitions, intervalDays, ease };
}
