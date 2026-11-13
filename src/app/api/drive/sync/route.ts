import { scheduleIndexing } from "@/lib/document-processing/automatic";
import { NextRequest, NextResponse } from "next/server";
import { apiUser, failure } from "@/lib/api";
import { synchronize } from "@/lib/google-drive/sync";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "sync", 2);
    const result = await synchronize(user.id);
    scheduleIndexing(user.id, true);
    return NextResponse.json({ ...result, indexing: "automatic" });
  } catch (e) {
    return failure(e);
  }
}
