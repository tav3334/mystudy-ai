import { diagnoseGeneration } from "@/lib/ai/provider";
import { indexingState } from "@/lib/document-processing/queue";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import {
  scheduleIndexing,
  connectedIndexingUsers,
} from "@/lib/document-processing/automatic";
import { synchronize } from "@/lib/google-drive/sync";
import { failure, readJson } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 300;
function authorized(request: NextRequest) {
  const actual = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return (
    !!process.env.CRON_SECRET &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
export async function GET(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const users = await connectedIndexingUsers();
    if (request.nextUrl.searchParams.get("mode") === "ai-check") {
      if (!users.length)
        return NextResponse.json(
          { ok: false, code: "NO_CONNECTED_ACCOUNT" },
          { status: 409 },
        );
      return NextResponse.json(await diagnoseGeneration(users[0].user_id));
    }
    if (request.nextUrl.searchParams.get("mode") === "status")
      return NextResponse.json({
        automatic: true,
        states: await Promise.all(
          users.map(async ({ user_id }) => ({
            userId: user_id,
            ...(await indexingState(user_id)),
          })),
        ),
      });
    if (request.nextUrl.searchParams.get("mode") === "sync") {
      after(async () => {
        for (const { user_id } of users) {
          try {
            await synchronize(user_id);
            scheduleIndexing(user_id, true);
          } catch {
            console.error("scheduled_drive_sync_failed", { userId: user_id });
          }
        }
      });
    } else for (const { user_id } of users) scheduleIndexing(user_id);
    return NextResponse.json(
      { automatic: true, accepted: true },
      { status: 202 },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { userId } = await readJson(request, z.object({ userId: z.uuid() }));
    scheduleIndexing(userId);
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
