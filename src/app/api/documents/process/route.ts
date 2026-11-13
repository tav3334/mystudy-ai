import { NextRequest, NextResponse } from "next/server";
import { apiUser, failure } from "@/lib/api";
import { scheduleIndexing } from "@/lib/document-processing/automatic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "automatic-indexing", 20);
    scheduleIndexing(user.id, true);
    return NextResponse.json(
      { automatic: true, queued: true },
      { status: 202 },
    );
  } catch (e) {
    return failure(e);
  }
}
