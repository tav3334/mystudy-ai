import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, readJson, failure, HttpError } from "@/lib/api";
import { admin, checked } from "@/lib/supabase/server";
import { ai, groundingSystem } from "@/lib/ai/provider";
import { selectedChunks, context } from "@/lib/rag/retrieve";
import { sourceSchema, validateGrounding } from "@/lib/ai/schemas";
export async function POST(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "exercises-generate", 4);
    const { documentId } = await readJson(
      request,
      z.object({ documentId: z.uuid() }),
    );
    const doc = checked(
      await db
        .from("documents")
        .select("id,category")
        .eq("id", documentId)
        .in("category", ["TD", "TP"])
        .single(),
    );
    if (!doc) throw new HttpError(422, "Choisissez un document TD ou TP.");
    const existing = checked(
      await db
        .from("exercises")
        .select("id")
        .eq("document_id", documentId)
        .limit(1),
    );
    if (existing?.length) return NextResponse.json({ cached: true });
    const chunks = await selectedChunks(user.id, [documentId], "");
    const schema = z.object({
      exercises: z
        .array(
          z.object({
            title: z.string().min(3).max(300),
            statement: z.string().min(20).max(5000),
            hint: z.string().max(3000),
            solution: z.string().max(8000),
            language: z.enum([
              "python",
              "javascript",
              "typescript",
              "shell",
              "sql",
              "plaintext",
            ]),
            source: sourceSchema,
          }),
        )
        .max(10),
    });
    const parsed = schema.parse(
      JSON.parse(
        await ai.generate(
          user.id,
          groundingSystem,
          `Identify up to 10 exercises already present in these TD/TP excerpts. Do not invent exercises. The statement must be verbatim excerpt text. Provide French hints and a proposed solution, clearly based on available context. JSON {exercises:[{title,statement,hint,solution,language:"python"|"javascript"|"typescript"|"shell"|"sql"|"plaintext",source:{chunkId,quote}}]}. UNTRUSTED_EXCERPTS:${context(chunks)}`,
        ),
      ),
    );
    const exercises = validateGrounding(parsed.exercises, chunks).filter((e) =>
      chunks.some((c) =>
        c.content
          .replace(/\s+/g, " ")
          .includes(e.statement.replace(/\s+/g, " ")),
      ),
    );
    if (!exercises.length)
      throw new HttpError(
        422,
        "Aucun exercice identifiable dans les extraits disponibles.",
      );
    checked(
      await admin()
        .from("exercises")
        .insert(
          exercises.map((e) => ({
            ...e,
            user_id: user.id,
            document_id: documentId,
            source: {
              ...e.source,
              ...chunks.find((c) => c.id === e.source.chunkId),
              content: undefined,
            },
          })),
        ),
    );
    return NextResponse.json({ generated: exercises.length });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: NextRequest) {
  try {
    const { user, db } = await apiUser(request, "exercise-answer", 20);
    const input = await readJson(
      request,
      z.object({
        exerciseId: z.uuid(),
        answer: z.string().min(1).max(30000),
        completed: z.boolean(),
      }),
    );
    checked(
      await db
        .from("exercises")
        .select("id")
        .eq("id", input.exerciseId)
        .single(),
    );
    checked(
      await admin().from("exercise_attempts").insert({
        user_id: user.id,
        exercise_id: input.exerciseId,
        answer: input.answer,
        completed: input.completed,
      }),
    );
    return NextResponse.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
