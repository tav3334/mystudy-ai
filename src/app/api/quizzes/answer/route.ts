import { NextRequest, NextResponse } from "next/server";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { answerSchema } from "@/lib/validation/answers";
export async function PUT(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "answers", 120);
    const input = await readJson(request, answerSchema);
    const saved = checked(
      await admin().rpc("save_answers", {
        p_user: user.id,
        p_attempt: input.attemptId,
        p_answers: input.answers,
      }),
    );
    if (!saved)
      throw new HttpError(
        409,
        "Cette tentative est terminée ou le temps est écoulé.",
      );
    return NextResponse.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
