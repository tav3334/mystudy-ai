import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import {
  dailyLimit,
  indexingLimit,
  nextQuotaReset,
  recoverableFailure,
  providerCooldownUntil,
} from "./policy";
const leaseBucket = "automatic-indexing-lease";
export async function acquireIndexingLease(userId: string) {
  const db = admin();
  const token = new Date().toISOString();
  const inserted = await db.from("api_rate_limits").insert({
    user_id: userId,
    bucket: leaseBucket,
    window_start: token,
    requests: 1,
  });
  if (!inserted.error) return token;
  if (inserted.error.code !== "23505")
    throw new Error("Cannot acquire indexing lease");
  const row = checked(
    await db
      .from("api_rate_limits")
      .update({ window_start: token, requests: 1 })
      .eq("user_id", userId)
      .eq("bucket", leaseBucket)
      .lt("window_start", new Date(Date.now() - 300000).toISOString())
      .select("user_id")
      .maybeSingle(),
  );
  return row ? token : null;
}
export async function releaseIndexingLease(userId: string, token: string) {
  checked(
    await admin()
      .from("api_rate_limits")
      .delete()
      .eq("user_id", userId)
      .eq("bucket", leaseBucket)
      .eq("window_start", token),
  );
}
export async function indexingState(userId: string) {
  const db = admin();
  const day = new Date().toISOString().slice(0, 10);
  const [docs, usage, jobs, cooldown] = await Promise.all([
    db
      .from("documents")
      .select("status")
      .eq("user_id", userId)
      .eq("active", true),
    db
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", day),
    db
      .from("document_processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .lt("attempts", 3)
      .or(
        `locked_at.is.null,locked_at.lt.${new Date(Date.now() - 60000).toISOString()}`,
      ),
    db
      .from("api_rate_limits")
      .select("window_start")
      .eq("user_id", userId)
      .eq("bucket", "indexing-provider-cooldown")
      .maybeSingle(),
  ]);
  const rows = checked(docs) ?? [];
  const providerRetry = providerCooldownUntil(checked(cooldown)?.window_start);
  if (usage.error) throw new Error("Cannot read indexing quota");
  if (jobs.error) throw new Error("Cannot read indexing queue");
  const used = usage.count ?? 0;
  const limit = dailyLimit();
  const budget = indexingLimit(limit);
  return {
    total: rows.length,
    ready: rows.filter((d) => d.status === "ready").length,
    pending: rows.filter((d) => ["pending", "queued"].includes(d.status))
      .length,
    processing: rows.filter((d) => d.status === "processing").length,
    failed: rows.filter((d) => d.status === "failed").length,
    used,
    limit,
    reserved: limit - budget,
    paused: used >= budget || !!providerRetry,
    pauseReason: providerRetry ? "provider" : "daily",
    retryAt: providerRetry ?? nextQuotaReset(),
    runnable: jobs.count ?? 0,
  };
}
export async function repairIndexingQueue(
  userId: string,
  resetFailures = false,
) {
  const db = admin();
  // A killed invocation releases its document job after ten minutes; only the owner is inspected.
  checked(
    await db
      .from("document_processing_jobs")
      .update({ status: "pending", locked_at: null, attempts: 0 })
      .eq("user_id", userId)
      .eq("status", "processing")
      .lt("locked_at", new Date(Date.now() - 600000).toISOString()),
  );
  const failed =
    checked(
      await db
        .from("document_processing_jobs")
        .select(
          "id,document_id,version,attempts,error,locked_at,documents!inner(version,active,status)",
        )
        .eq("user_id", userId)
        .eq("status", "failed")
        .limit(200),
    ) ?? [];
  for (const job of failed) {
    const doc = Array.isArray(job.documents) ? job.documents[0] : job.documents;
    if (
      !doc?.active ||
      doc.version !== job.version ||
      doc.status === "ready" ||
      !recoverableFailure(job.error)
    )
      continue;
    const yesterday =
      job.locked_at &&
      Date.now() - new Date(job.locked_at).getTime() > 86400000;
    if (job.attempts >= 3 && !resetFailures && !yesterday) continue;
    const queued = checked(
      await db
        .from("document_processing_jobs")
        .update({
          status: "pending",
          locked_at: null,
          error: null,
          ...(resetFailures || yesterday ? { attempts: 0 } : {}),
        })
        .eq("id", job.id)
        .eq("user_id", userId)
        .eq("status", "failed")
        .select("id")
        .maybeSingle(),
    );
    if (queued)
      checked(
        await db
          .from("documents")
          .update({ status: "queued", processing_error: null })
          .eq("id", job.document_id)
          .eq("user_id", userId)
          .eq("version", job.version)
          .neq("status", "ready"),
      );
  }
  // Documents from a pre-queue installation are enrolled automatically as well.
  const missing =
    checked(
      await db
        .from("documents")
        .select("id,version")
        .eq("user_id", userId)
        .eq("active", true)
        .eq("status", "pending")
        .limit(200),
    ) ?? [];
  for (const doc of missing)
    checked(
      await db
        .from("document_processing_jobs")
        .upsert(
          { user_id: userId, document_id: doc.id, version: doc.version },
          { onConflict: "document_id,version", ignoreDuplicates: true },
        ),
    );
}
export async function claimIndexingJob(userId?: string) {
  const db = admin();
  let query = db
    .from("document_processing_jobs")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .or(
      `locked_at.is.null,locked_at.lt.${new Date(Date.now() - 60000).toISOString()}`,
    )
    .order("created_at")
    .limit(1);
  if (userId) query = query.eq("user_id", userId);
  const candidate = checked(await query.maybeSingle());
  if (!candidate) return null;
  return checked(
    await db
      .from("document_processing_jobs")
      .update({
        status: "processing",
        locked_at: new Date().toISOString(),
        attempts: candidate.attempts + 1,
      })
      .eq("id", candidate.id)
      .eq("user_id", candidate.user_id)
      .eq("status", "pending")
      .eq("attempts", candidate.attempts)
      .select("*")
      .maybeSingle(),
  );
}
