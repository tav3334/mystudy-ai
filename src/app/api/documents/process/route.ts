import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await apiUser(request, "process", 10);
    const { documentId } = await readJson(
      request,
      z.object({ documentId: z.uuid() }),
    );
    const doc = checked(
      await db
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .eq("active", true)
        .single(),
    );
    checked(
      await admin().from("document_processing_jobs").upsert(
        {
          user_id: user.id,
          document_id: doc.id,
          version: doc.version,
          status: "pending",
          attempts: 0,
          error: null,
        },
        { onConflict: "document_id,version" },
      ),
    );
    checked(
      await admin()
        .from("documents")
        .update({ status: "queued", processing_error: null })
        .eq("id", doc.id)
        .neq("status", "processing"),
    );
    return NextResponse.json({ queued: true });
  } catch (e) {
    return failure(e);
  }
}
