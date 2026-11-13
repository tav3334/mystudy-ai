import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import type { SourceChunk } from "@/lib/ai/schemas";
import { rankSourceChunks } from "./keyword";
export async function selectedChunks(
  userId: string,
  ids: string[],
  chapter: string,
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
  const result: SourceChunk[] = [];
  for (const doc of docs) {
    const rows =
      checked(
        await db
          .from("document_chunks")
          .select("id,document_id,content,section,page")
          .eq("user_id", userId)
          .eq("document_id", doc.id)
          .eq("version", doc.version)
          .order("ordinal")
          .limit(
            chapter.trim() ? 150 : Math.max(1, Math.floor(24 / docs.length)),
          ),
      ) ?? [];
    result.push(
      ...rows.map((c) => ({
        ...c,
        document_name: doc.name,
        source_url: doc.source_url,
      })),
    );
  }
  return chapter.trim() ? rankSourceChunks(result, chapter) : result;
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
