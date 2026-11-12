import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import {
  accessToken,
  driveFetch,
  listChildren,
  type DriveFile,
} from "./client";
import { classifyFolder, fileVersion, reconcileFiles } from "./reconcile";
const folderMime = "application/vnd.google-apps.folder";
export async function synchronize(userId: string) {
  const db = admin();
  const connection = checked(
    await db
      .from("drive_connections")
      .select("*")
      .eq("user_id", userId)
      .single(),
  )!;
  // A crashed process must not permanently block future synchronization.
  checked(
    await db
      .from("sync_runs")
      .update({
        status: "failed",
        error: "Synchronisation interrompue",
        finished_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - 15 * 60000).toISOString()),
  );
  const run = checked(
    await db
      .from("sync_runs")
      .insert({ user_id: userId })
      .select("id")
      .single(),
  )!;
  try {
    const token = await accessToken(userId);
    let nextCursor = connection.page_token as string | null;
    let changed = !nextCursor;
    if (nextCursor) {
      try {
        let cursor = nextCursor;
        do {
          const r = await driveFetch(token, "changes", {
            pageToken: cursor,
            fields: "nextPageToken,newStartPageToken,changes(fileId,removed)",
            pageSize: "1000",
            includeRemoved: "true",
          });
          const d = await r.json();
          if (d.changes?.length) changed = true;
          nextCursor = d.newStartPageToken ?? nextCursor;
          cursor = d.nextPageToken ?? "";
        } while (cursor);
      } catch {
        changed = true;
        nextCursor = null;
      }
    }
    if (!nextCursor) {
      const r = await driveFetch(token, "changes/startPageToken");
      nextCursor = (await r.json()).startPageToken;
    }
    if (!changed) {
      checked(
        await db
          .from("sync_runs")
          .update({
            status: "completed",
            finished_at: new Date().toISOString(),
          })
          .eq("id", run.id),
      );
      return { added: 0, updated: 0, removed: 0 };
    }
    // A change feed is account-wide. Reconcile the configured tree on changes so moved folders, descendants, and permission losses are handled together.
    await driveFetch(token, `files/${encodeURIComponent(connection.root_id)}`, {
      fields: "id,mimeType",
    });
    const old =
      checked(await db.from("documents").select("*").eq("user_id", userId)) ??
      [];
    const oldMap = new Map(old.map((d) => [d.drive_id, d]));
    const files: {
      file: DriveFile;
      moduleId: string | null;
      category: string;
    }[] = [];
    const moduleIds: string[] = [];
    const folderIds: string[] = [];
    const visited = new Set<string>();
    async function walk(
      parent: string,
      moduleId: string | null,
      category: string,
      depth: number,
    ) {
      if (depth > 30 || visited.size > 3000)
        throw new Error("Drive tree exceeds scan safety limit");
      if (visited.has(parent)) return;
      visited.add(parent);
      for (const file of await listChildren(token, parent)) {
        if (file.mimeType === folderMime) {
          let nextModule = moduleId;
          if (depth === 0) {
            const m = checked(
              await db
                .from("modules")
                .upsert(
                  {
                    user_id: userId,
                    drive_id: file.id,
                    name: file.name,
                    active: true,
                  },
                  { onConflict: "user_id,drive_id" },
                )
                .select("id")
                .single(),
            )!;
            nextModule = m.id;
            moduleIds.push(m.id);
          }
          const cat = classifyFolder(file.name, category);
          const f = checked(
            await db
              .from("folders")
              .upsert(
                {
                  user_id: userId,
                  drive_id: file.id,
                  parent_drive_id: parent,
                  name: file.name,
                  module_id: nextModule,
                  category: cat,
                  active: true,
                },
                { onConflict: "user_id,drive_id" },
              )
              .select("id")
              .single(),
          )!;
          folderIds.push(f.id);
          await walk(file.id, nextModule, cat, depth + 1);
        } else files.push({ file, moduleId, category });
      }
    }
    await walk(connection.root_id, null, "Autre", 0);
    const diff = reconcileFiles(
      old,
      files.map(({ file }) => ({ id: file.id, version: fileVersion(file) })),
    );
    const now = new Date().toISOString();
    for (const { file, moduleId, category } of files) {
      const previous = oldMap.get(file.id);
      const version = fileVersion(file);
      const changed =
        !previous || previous.version !== version || !previous.active;
      const doc = checked(
        await db
          .from("documents")
          .upsert(
            {
              user_id: userId,
              drive_id: file.id,
              parent_drive_id: file.parents?.[0] ?? null,
              name: file.name,
              mime_type: file.mimeType,
              module_id: moduleId,
              category,
              created_at: file.createdTime,
              modified_at: file.modifiedTime,
              version,
              source_url: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
              size_bytes: file.size ? Number(file.size) : null,
              active: true,
              last_synced_at: now,
              status: changed ? "queued" : previous.status,
              processing_error: changed ? null : previous.processing_error,
            },
            { onConflict: "user_id,drive_id" },
          )
          .select("id")
          .single(),
      )!;
      if (changed)
        checked(
          await db.from("document_processing_jobs").upsert(
            {
              user_id: userId,
              document_id: doc.id,
              version,
              status: "pending",
              attempts: 0,
              error: null,
            },
            { onConflict: "document_id,version" },
          ),
        );
    }
    // Only retire unseen records after the entire scan succeeded. Preserve attempts and learning history.
    for (const id of diff.removed)
      checked(
        await db
          .from("documents")
          .update({ active: false })
          .eq("user_id", userId)
          .eq("drive_id", id),
      );
    const allModules =
      checked(await db.from("modules").select("id").eq("user_id", userId)) ??
      [];
    for (const m of allModules)
      if (!moduleIds.includes(m.id))
        checked(
          await db.from("modules").update({ active: false }).eq("id", m.id),
        );
    const allFolders =
      checked(await db.from("folders").select("id").eq("user_id", userId)) ??
      [];
    for (const f of allFolders)
      if (!folderIds.includes(f.id))
        checked(
          await db.from("folders").update({ active: false }).eq("id", f.id),
        );
    checked(
      await db
        .from("drive_connections")
        .update({ page_token: nextCursor, updated_at: now })
        .eq("user_id", userId),
    );
    const result = {
      added: diff.added.length,
      updated: diff.updated.length,
      removed: diff.removed.length,
    };
    checked(
      await db
        .from("sync_runs")
        .update({
          ...result,
          status: "completed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id),
    );
    return result;
  } catch (error) {
    await db
      .from("sync_runs")
      .update({
        status: "failed",
        error:
          "Synchronisation interrompue. Vérifiez les autorisations Drive et réessayez.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    throw error;
  }
}
