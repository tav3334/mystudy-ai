import { verifyAnswer } from "@/lib/ai/verify";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { apiUser, readJson, failure } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { ai, groundingSystem } from "@/lib/ai/provider";
import { retrieve, context } from "@/lib/rag/retrieve";
import { sourceSchema, validateGrounding } from "@/lib/ai/schemas";
const schema = z.object({
  question: z.string().min(3).max(3000),
  language: z.enum(["Français", "Darija", "العربية", "English"]),
  moduleId: z.uuid().optional(),
  supplement: z.boolean().default(false),
});
const output = z.object({
  answer: z.string().min(1).max(20000),
  citations: z.array(sourceSchema).max(12),
  generalKnowledge: z.string().max(10000).optional(),
});
export async function POST(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "tutor", 8);
    const input = await readJson(request, schema);
    const chunks = await retrieve(
      user.id,
      input.question,
      undefined,
      input.moduleId,
    );
    if (!chunks.length && !input.supplement)
      return NextResponse.json({
        answer:
          "Cette information n’a pas été trouvée dans vos documents indexés. Connectez vos cours ou activez le complément de connaissances générales.",
        sources: [],
      });
    const key = createHash("sha256")
      .update(
        JSON.stringify({ input, chunks, model: process.env.GEMINI_MODEL }),
      )
      .digest("hex");
    const db = admin();
    const cached = checked(
      await db
        .from("ai_cache")
        .select("payload")
        .eq("user_id", user.id)
        .eq("cache_key", key)
        .maybeSingle(),
    );
    if (cached) return NextResponse.json(cached.payload);
    const result = output.parse(
      JSON.parse(
        await ai.generate(
          user.id,
          groundingSystem,
          `Answer the question using excerpts. JSON shape: {answer:string,citations:[{chunkId,quote}],generalKnowledge?:string}. Every grounded claim must be supported by a citation. ${input.supplement ? "Optional general explanations must appear ONLY in generalKnowledge." : "Do not add general knowledge."} Language: ${input.language}. Question: ${JSON.stringify(input.question)}. UNTRUSTED_EXCERPTS: ${context(chunks)}`,
        ),
      ),
    );
    const verified = validateGrounding(
      result.citations.map((source) => ({ source })),
      chunks,
    );
    if (result.citations.length !== verified.length)
      throw new Error("Unverified citations");
    const supported =
      verified.length > 0 &&
      (await verifyAnswer(
        user.id,
        result.answer,
        verified.map(
          ({ source }) => chunks.find((c) => c.id === source.chunkId)!.content,
        ),
      ));
    const payload = {
      answer: supported
        ? result.answer
        : "Cette information n’a pas été trouvée de façon suffisamment fiable dans vos documents.",
      generalKnowledge: input.supplement ? result.generalKnowledge : undefined,
      sources: (supported ? verified : []).map(({ source }) => ({
        ...chunks.find((c) => c.id === source.chunkId)!,
        quote: source.quote,
      })),
    };
    checked(
      await db
        .from("ai_cache")
        .upsert(
          { user_id: user.id, cache_key: key, payload },
          { onConflict: "user_id,cache_key" },
        ),
    );
    return NextResponse.json(payload);
  } catch (e) {
    return failure(e);
  }
}
