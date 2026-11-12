import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
export async function POST(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "start", 15);
    const { quizId } = await readJson(request, z.object({ quizId: z.uuid() }));
    const quiz = checked(
      await db.from("quizzes").select("*").eq("id", quizId).single(),
    );
    const questions =
      checked(
        await db
          .from("questions")
          .select("id,payload")
          .eq("quiz_id", quiz.id)
          .order("ordinal"),
      ) ?? [];
    let attempt = checked(
      await db
        .from("exam_attempts")
        .select("*")
        .eq("quiz_id", quiz.id)
        .is("submitted_at", null)
        .maybeSingle(),
    );
    if (!attempt) {
      const insert = await admin()
        .from("exam_attempts")
        .insert({ user_id: user.id, quiz_id: quiz.id })
        .select("*")
        .single();
      if (insert.error?.code === "23505")
        attempt = checked(
          await db
            .from("exam_attempts")
            .select("*")
            .eq("quiz_id", quiz.id)
            .is("submitted_at", null)
            .single(),
        );
      else attempt = checked(insert);
    }
    return NextResponse.json({
      quiz,
      attempt,
      questions: questions.map((q) => ({
        id: q.id,
        statement: q.payload.statement,
        options: q.payload.options,
        multiple: q.payload.correctIndices.length > 1,
        topic: q.payload.topic,
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
