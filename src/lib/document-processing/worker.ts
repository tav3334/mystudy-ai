import { claimIndexingJob } from "./queue";
import { ProcessingYield } from "./policy";
import { processingFailure, type ProcessingStage } from "./errors";
import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import { accessToken, driveFetch } from "@/lib/google-drive/client";
import { extract } from "./extract";
import { chunkSections } from "./chunk";
export async function processNext(
  options: { userId?: string; deadline?: number } = {},
) {
  const db = admin();
  const job = await claimIndexingJob(options.userId);
  if (!job) return { processed: false };
  let stage: ProcessingStage = "load_document";
  try {
    const doc = checked(
      await db
        .from("documents")
        .select("*")
        .eq("id", job.document_id)
        .eq("user_id", job.user_id)
        .single(),
    );
    if (!doc.active || doc.version !== job.version) {
      checked(
        await db
          .from("document_processing_jobs")
          .update({ status: "done", error: "Version superseded" })
          .eq("id", job.id),
      );
      return { processed: true };
    }
    checked(
      await db
        .from("documents")
        .update({ status: "processing" })
        .eq("id", doc.id),
    );
    if (doc.size_bytes > 20 * 1024 * 1024)
      throw new Error("Document trop volumineux (20 Mo maximum).");
    stage = "drive_auth";
    const token = await accessToken(job.user_id);
    stage = "download";
    let mime = doc.mime_type;
    let name = doc.name;
    let response: Response;
    if (mime === "application/vnd.google-apps.document") {
      mime = "text/plain";
      response = await driveFetch(
        token,
        `files/${encodeURIComponent(doc.drive_id)}/export`,
        { mimeType: mime },
      );
    } else if (mime === "application/vnd.google-apps.presentation") {
      mime =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      name += ".pptx";
      response = await driveFetch(
        token,
        `files/${encodeURIComponent(doc.drive_id)}/export`,
        { mimeType: mime },
      );
    } else
      response = await driveFetch(
        token,
        `files/${encodeURIComponent(doc.drive_id)}`,
        { alt: "media" },
      );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Document vide.");
    let size = 0;
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Document trop volumineux (20 Mo maximum).");
      }
      parts.push(value);
    }
    stage = "extract";
    const sections = await extract(Buffer.concat(parts), mime, name);
    stage = "chunk";
    const chunks = chunkSections(sections);
    if (!chunks.length)
      throw new Error("Aucun texte exploitable dans ce document.");
    if (chunks.length > 150)
      throw new Error(
        "Document trop long : séparez-le en chapitres (150 chunks maximum).",
      );
    if (options.deadline && Date.now() > options.deadline - 15000)
      throw new ProcessingYield();
    const rows = chunks.map((chunk) => ({ ...chunk, embedding: null }));
    stage = "save";
    checked(
      await db.rpc("finish_document", {
        p_job: job.id,
        p_user: job.user_id,
        p_document: doc.id,
        p_version: job.version,
        p_chunks: rows,
      }),
    );
    return { processed: true, documentId: doc.id };
  } catch (e) {
    const yielded = e instanceof ProcessingYield;
    if (yielded && job.attempts < 3) {
      checked(
        await db
          .from("document_processing_jobs")
          .update({ status: "pending", locked_at: null, error: null })
          .eq("id", job.id)
          .eq("user_id", job.user_id),
      );
      checked(
        await db
          .from("documents")
          .update({ status: "queued", processing_error: null })
          .eq("id", job.document_id)
          .eq("user_id", job.user_id)
          .eq("version", job.version),
      );
      return { processed: false, yielded: true };
    }
    const problem = yielded
      ? {
          code: "INDEXING_STALLED",
          message:
            "Document trop long à préparer automatiquement. Séparez-le en chapitres plus courts puis synchronisez Google Drive.",
          stage,
        }
      : processingFailure(e, stage);
    const safe = problem.message;
    console.error("document_processing_failed", {
      jobId: job.id,
      documentId: job.document_id,
      code: problem.code,
      stage,
    });
    await db
      .from("document_processing_jobs")
      .update({ status: "failed", error: safe })
      .eq("id", job.id);
    await db
      .from("documents")
      .update({ status: "failed", processing_error: safe })
      .eq("id", job.document_id)
      .eq("version", job.version);
    return {
      processed: true,
      failed: true,
      documentId: job.document_id,
      error: safe,
      errorCode: problem.code,
      stage,
    };
  }
}
