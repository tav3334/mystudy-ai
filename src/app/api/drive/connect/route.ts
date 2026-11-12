import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiUser, failure } from "@/lib/api";
import { appUrl, required } from "@/lib/env";
export async function GET(request: NextRequest) {
  try {
    const { user } = await apiUser(request, "drive-connect", 5);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const store = await cookies();
    const opts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/api/drive",
      maxAge: 600,
    };
    store.set(
      "drive_oauth",
      JSON.stringify({ state, verifier, userId: user.id }),
      opts,
    );
    const query = new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      redirect_uri: `${appUrl()}/api/drive/callback`,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
    );
  } catch (e) {
    return failure(e);
  }
}
