import { NextRequest, NextResponse } from "next/server";
import { apiUser, failure } from "@/lib/api";
import { synchronize } from "@/lib/google-drive/sync";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "sync", 2);
    return NextResponse.json(await synchronize(user.id));
  } catch (e) {
    return failure(e);
  }
}
