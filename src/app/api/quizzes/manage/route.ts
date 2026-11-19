import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
const idSchema = z.object({ quizId: z.uuid() });
export async function PATCH(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "manage-quiz", 20);
    const input = await readJson(
      request,
      idSchema.extend({
        title: z.string().trim().min(1).max(250),
        moduleId: z.uuid().nullable(),
      }),
    );
    const quiz = checked(
      await db
        .from("quizzes")
        .select("id")
        .eq("id", input.quizId)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!quiz) throw new HttpError(404, "Questionnaire introuvable.");
    if (input.moduleId) {
      const ownedModule = checked(
        await db
          .from("modules")
          .select("id")
          .eq("id", input.moduleId)
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (!ownedModule) throw new HttpError(404, "Module introuvable.");
    }
    checked(
      await admin()
        .from("quizzes")
        .update({ title: input.title, module_id: input.moduleId })
        .eq("id", input.quizId)
        .eq("user_id", user.id),
    );
    return NextResponse.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "delete-quiz", 10);
    const input = await readJson(request, idSchema);
    const quiz = checked(
      await db
        .from("quizzes")
        .select("id")
        .eq("id", input.quizId)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!quiz) throw new HttpError(404, "Questionnaire introuvable.");
    const writer = admin();
    // Results reference runs; remove them first. Their answer rows cascade.
    checked(
      await writer
        .from("quiz_attempts")
        .delete()
        .eq("quiz_id", input.quizId)
        .eq("user_id", user.id),
    );
    checked(
      await writer
        .from("exam_attempts")
        .delete()
        .eq("quiz_id", input.quizId)
        .eq("user_id", user.id),
    );
    checked(
      await writer
        .from("quizzes")
        .delete()
        .eq("id", input.quizId)
        .eq("user_id", user.id),
    );
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
