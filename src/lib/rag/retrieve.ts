import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import type { SourceChunk } from "@/lib/ai/schemas";
import { rankSourceChunks } from "./keyword";
import { spreadAcross, interleave } from "./spread";
export async function selectedChunks(
  userId: string,
  ids: string[],
  chapter: string,
  limit = 24,
): Promise<SourceChunk[]> {
  const db = admin();
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 8)
    throw new Error("Choose one to eight documents");
  const docs =
    checked(
      await db
        .from("documents")
        .select("id,name,source_url,version")
        .eq("user_id", userId)
        .eq("active", true)
        .eq("status", "ready")
        .in("id", unique)
        .order("id"),
    ) ?? [];
  if (docs.length !== unique.length)
    throw new Error("Documents must be prepared and owned");
  const groups: SourceChunk[][] = [];
  for (const doc of docs) {
    const query = () =>
      db
        .from("document_chunks")
        .select("id,document_id,content,section,page", { count: "exact" })
        .eq("user_id", userId)
        .eq("document_id", doc.id)
        .eq("version", doc.version)
        .order("ordinal");
    const first = await query().limit(150);
    const rows = checked(first) ?? [];
    // Also inspect the middle and end of long courses, not just their first pages.
    if (limit > 24 && (first.count ?? 0) > 150) {
      const total = first.count!;
      const middle = Math.max(150, Math.floor(total / 2) - 37);
      for (const offset of [...new Set([middle, Math.max(150, total - 75)])]) {
        rows.push(
          ...(checked(
            await query().range(offset, Math.min(total - 1, offset + 74)),
          ) ?? []),
        );
      }
    }
    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    const chosen = chapter.trim()
      ? uniqueRows
      : spreadAcross(uniqueRows, Math.max(1, Math.floor(limit / docs.length)));
    groups.push(
      chosen.map((c) => ({
        ...c,
        document_name: doc.name,
        source_url: doc.source_url,
      })),
    );
  }
  const result = interleave(groups);
  return chapter.trim()
    ? rankSourceChunks(result, chapter, limit)
    : result.slice(0, limit);
}
export function context(chunks: SourceChunk[]) {
  return JSON.stringify(
    chunks.map((c) => ({
      id: c.id,
      document: c.document_name,
      section: c.section,
      page: c.page,
      text: c.content,
    })),
  );
}
