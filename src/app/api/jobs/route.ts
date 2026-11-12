import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processNext } from "@/lib/document-processing/worker";
import { synchronize } from "@/lib/google-drive/sync";
import { admin, checked } from "@/lib/supabase/server";
import { failure } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const actual = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (
    !process.env.CRON_SECRET ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (request.nextUrl.searchParams.get("mode") === "sync") {
      const connections = checked(
        await admin().from("drive_connections").select("user_id"),
      );
      const result = [];
      for (const c of connections ?? [])
        result.push(await synchronize(c.user_id));
      return NextResponse.json({ runs: result.length });
    }
    return NextResponse.json(await processNext());
  } catch (e) {
    return failure(e);
  }
}
