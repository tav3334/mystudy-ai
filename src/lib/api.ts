import { AIProviderError } from "@/lib/ai/errors";
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { admin, requireUser } from "@/lib/supabase/server";
import { isTrustedBrowserRequest } from "@/lib/validation/origin";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function apiUser(
  request: NextRequest,
  bucket: string,
  limit = 20,
) {
  if (
    request.method !== "GET" &&
    !isTrustedBrowserRequest(
      {
        url: request.url,
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        fetchSite: request.headers.get("sec-fetch-site"),
      },
      {
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        deploymentHost: process.env.VERCEL_URL,
        branchHost: process.env.VERCEL_BRANCH_URL,
        productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
        development: process.env.NODE_ENV === "development",
      },
    )
  )
    throw new HttpError(403, "Origine de la requête non autorisée.");
  const auth = await requireUser();
  const { data, error } = await admin().rpc("check_rate_limit", {
    p_user: auth.user.id,
    p_bucket: bucket,
    p_limit: limit,
    p_seconds: 60,
  });
  if (error) throw error;
  if (!data)
    throw new HttpError(429, "Trop de requêtes. Réessayez dans une minute.");
  return auth;
}
export async function readJson<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
): Promise<z.infer<T>> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Corps de requête manquant.");
  const parts: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 200000) {
      await reader.cancel();
      throw new HttpError(413, "Requête trop volumineuse.");
    }
    parts.push(value);
  }
  const raw = Buffer.concat(parts).toString("utf8");
  return schema.parse(JSON.parse(raw));
}
export function failure(error: unknown) {
  if (error instanceof AIProviderError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Données invalides. Vérifiez les champs de votre demande." },
      { status: 400 },
    );
  if (error instanceof Error && error.message === "AUTH_REQUIRED")
    return NextResponse.json(
      { error: "Connectez-vous pour continuer." },
      { status: 401 },
    );
  if (error instanceof Error && error.message.includes("DAILY_AI_LIMIT"))
    return NextResponse.json(
      { error: "Votre limite quotidienne AI est atteinte." },
      { status: 429 },
    );
  if (error instanceof Error && error.message === "AI provider failed (429)")
    return NextResponse.json(
      {
        error:
          "Le quota Gemini de votre projet Google est atteint. La préparation des documents reste disponible ; réessayez la génération lorsque le quota du fournisseur est renouvelé.",
      },
      { status: 429 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "Unknown",
  );
  return NextResponse.json(
    {
      error:
        "Opération impossible. Vérifiez la configuration et les quotas des services.",
    },
    { status: 500 },
  );
}
