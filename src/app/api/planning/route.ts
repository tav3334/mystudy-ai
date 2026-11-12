import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
const isoDate = z.iso.date();
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "plan", 30);
    const input = await readJson(
      request,
      z.object({
        title: z.string().trim().min(3).max(300),
        scheduledDate: isoDate,
        duration: z.number().int().min(5).max(480),
        moduleId: z.uuid().optional(),
        examDate: isoDate.optional(),
      }),
    );
    checked(
      await admin()
        .from("study_tasks")
        .insert({
          user_id: user.id,
          title: input.title,
          scheduled_date: input.scheduledDate,
          duration_minutes: input.duration,
          module_id: input.moduleId ?? null,
          exam_date: input.examDate ?? null,
        }),
    );
    return NextResponse.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "plan-edit", 60);
    const input = await readJson(
      request,
      z.object({
        id: z.uuid(),
        completed: z.boolean().optional(),
        title: z.string().trim().min(3).max(300).optional(),
        scheduled_date: isoDate.optional(),
        duration_minutes: z.number().int().min(5).max(480).optional(),
      }),
    );
    const { id, ...changes } = input;
    checked(
      await admin()
        .from("study_tasks")
        .update(changes)
        .eq("user_id", user.id)
        .eq("id", id),
    );
    return NextResponse.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "plan-delete", 30);
    const { id } = await readJson(request, z.object({ id: z.uuid() }));
    checked(
      await admin()
        .from("study_tasks")
        .delete()
        .eq("user_id", user.id)
        .eq("id", id),
    );
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
