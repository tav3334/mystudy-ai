import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import { ai } from "@/lib/ai/provider";
import type { SourceChunk } from "@/lib/ai/schemas";
export async function retrieve(
  userId: string,
  query: string,
  documentIds?: string[],
  moduleId?: string,
): Promise<SourceChunk[]> {
  const embedding = await ai.embed(userId, query, "RETRIEVAL_QUERY");
  return (
    checked(
      await admin().rpc("match_chunks", {
        p_user: userId,
        p_embedding: JSON.stringify(embedding),
        p_query: query,
        p_documents: documentIds ?? null,
        p_module: moduleId ?? null,
      }),
    ) ?? []
  );
}
export async function selectedChunks(
  userId: string,
  ids: string[],
  chapter: string,
): Promise<SourceChunk[]> {
  if (chapter) return retrieve(userId, chapter, ids);
  const db = admin();
  const docs =
    checked(
      await db
        .from("documents")
        .select("id,name,source_url,version")
        .eq("user_id", userId)
        .eq("active", true)
        .eq("status", "ready")
        .in("id", ids),
    ) ?? [];
  if (docs.length !== ids.length)
    throw new Error("Documents must be indexed and owned");
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
          .limit(Math.max(1, Math.floor(24 / docs.length))),
      ) ?? [];
    result.push(
      ...rows.map((c) => ({
        ...c,
        document_name: doc.name,
        source_url: doc.source_url,
      })),
    );
  }
  return result;
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
