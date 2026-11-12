import { z } from "zod";
export const answerSchema = z.object({
  attemptId: z.uuid(),
  answers: z.record(z.uuid(), z.array(z.number().int().min(0).max(7)).max(8)),
});
