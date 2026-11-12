import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { ai, groundingSystem } from "@/lib/ai/provider";
import { selectedChunks, context } from "@/lib/rag/retrieve";
import { sourceSchema, validateGrounding } from "@/lib/ai/schemas";
const card = z.object({
  question: z.string().min(5).max(2000),
  answer: z.string().min(3).max(4000),
  explanation: z.string().max(4000),
  difficulty: z.enum(["Facile", "Moyen", "Difficile"]),
  source: sourceSchema,
});
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "flashcard-generate", 4);
    const { documentId } = await readJson(
      request,
      z.object({ documentId: z.uuid() }),
    );
    const chunks = await selectedChunks(user.id, [documentId], "");
    if (!chunks.length)
      throw new HttpError(
        422,
        "Indexez ce document avant de générer des cartes.",
      );
    const db = admin();
    const key = createHash("sha256")
      .update(
        `flashcards:${JSON.stringify(chunks)}:${process.env.GEMINI_MODEL}`,
      )
      .digest("hex");
    const cached = checked(
      await db
        .from("ai_cache")
        .select("id")
        .eq("user_id", user.id)
        .eq("cache_key", key)
        .maybeSingle(),
    );
    if (cached) return NextResponse.json({ cached: true });
    const raw = await ai.generate(
      user.id,
      groundingSystem,
      `Create up to 10 French flashcards. JSON {cards:[{question,answer,explanation,difficulty:"Facile"|"Moyen"|"Difficile",source:{chunkId,quote}}]}. UNTRUSTED_EXCERPTS:${context(chunks)}`,
    );
    const parsed = z
      .object({ cards: z.array(card).max(10) })
      .parse(JSON.parse(raw));
    const seen = new Set<string>();
    const cards = validateGrounding(parsed.cards, chunks).filter((c) => {
      const k = c.question.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (!cards.length)
      throw new HttpError(
        422,
        "Pas assez de contenu pour créer des cartes sourcées.",
      );
    checked(
      await db.from("flashcards").insert(
        cards.map((c) => ({
          ...c,
          user_id: user.id,
          document_id: documentId,
          source: {
            ...c.source,
            ...chunks.find((s) => s.id === c.source.chunkId),
            content: undefined,
          },
        })),
      ),
    );
    checked(
      await db.from("ai_cache").upsert(
        {
          user_id: user.id,
          cache_key: key,
          payload: { generated: cards.length },
        },
        { onConflict: "user_id,cache_key" },
      ),
    );
    return NextResponse.json({ generated: cards.length });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "review-card", 60);
    const { cardId, rating } = await readJson(
      request,
      z.object({ cardId: z.uuid(), rating: z.number().int().min(0).max(5) }),
    );
    checked(
      await admin().rpc("review_card", {
        p_user: user.id,
        p_card: cardId,
        p_rating: rating,
      }),
    );
    return NextResponse.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
