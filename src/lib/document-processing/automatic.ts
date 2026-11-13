import "server-only";
import { after } from "next/server";
import { admin, checked } from "@/lib/supabase/server";
import { appUrl, required } from "@/lib/env";
import { processNext } from "./worker";
import { runIndexingBatch } from "./batch";
import {
  acquireIndexingLease,
  releaseIndexingLease,
  indexingState,
  repairIndexingQueue,
} from "./queue";
async function continueOnServer(userId: string) {
  // Each invocation is bounded and owns a database lease. No browser or desktop worker is required.
  const response = await fetch(`${appUrl()}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${required("CRON_SECRET")}`,
    },
    body: JSON.stringify({ userId }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Indexing continuation not accepted");
}
export function scheduleIndexing(userId: string, resetFailures = false) {
  after(async () => {
    try {
      await runIndexingBatch(
        userId,
        {
          acquire: acquireIndexingLease,
          release: releaseIndexingLease,
          repair: repairIndexingQueue,
          state: indexingState,
          process: (owner, deadline) =>
            processNext({ userId: owner, deadline }),
          continue: continueOnServer,
          now: Date.now,
        },
        { resetFailures },
      );
    } catch {
      console.error("automatic_indexing_interrupted", { userId });
    }
  });
}
export async function connectedIndexingUsers() {
  return (
    checked(await admin().from("drive_connections").select("user_id")) ?? []
  );
}
