import { NextRequest, NextResponse } from "next/server";
import { apiUser, failure } from "@/lib/api";
import { checked } from "@/lib/supabase/server";
import { indexingState } from "@/lib/document-processing/queue";
import { scheduleIndexing } from "@/lib/document-processing/automatic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await apiUser(request, "automatic-indexing", 20);
    const connection = checked(
      await db.from("drive_connections").select("user_id").maybeSingle(),
    );
    if (!connection) return NextResponse.json({ connected: false });
    const state = await indexingState(user.id);
    scheduleIndexing(user.id);
    return NextResponse.json({ connected: true, ...state });
  } catch (e) {
    return failure(e);
  }
}
