import { NextRequest, NextResponse } from "next/server";
import { apiUser, readJson, failure } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { answerSchema } from "@/lib/validation/answers";
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "submit", 10);
    const input = await readJson(request, answerSchema);
    return NextResponse.json(
      checked(
        await admin().rpc("submit_attempt", {
          p_user: user.id,
          p_attempt: input.attemptId,
          p_answers: input.answers,
        }),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
