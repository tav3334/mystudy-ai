import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, admin, checked } from "@/lib/supabase/server";
import { appUrl, required } from "@/lib/env";
import { encrypt } from "@/lib/google-drive/crypto";
export async function GET(request: NextRequest) {
  const store = await cookies();
  const raw = store.get("drive_oauth")?.value;
  store.delete({ name: "drive_oauth", path: "/api/drive" });
  try {
    const { user } = await requireUser();
    if (!raw) throw new Error("Missing OAuth state");
    const saved = JSON.parse(raw);
    const state = request.nextUrl.searchParams.get("state") ?? "";
    if (
      saved.userId !== user.id ||
      Buffer.byteLength(state) !== Buffer.byteLength(saved.state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))
    )
      throw new Error("Invalid OAuth state");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Missing OAuth code");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        redirect_uri: `${appUrl()}/api/drive/callback`,
        code,
        code_verifier: saved.verifier,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error("OAuth exchange failed");
    const tokens = await r.json();
    if (
      !tokens.refresh_token ||
      !String(tokens.scope)
        .split(" ")
        .includes("https://www.googleapis.com/auth/drive.readonly")
    )
      throw new Error("Read-only offline access not granted");
    checked(
      await admin()
        .from("drive_connections")
        .upsert({
          user_id: user.id,
          root_id:
            process.env.GOOGLE_DRIVE_ROOT_ID ??
            "1rqYB2_0rdDhoWJbqzPNOhFtNedQZgERn",
          encrypted_tokens: encrypt({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + tokens.expires_in * 1000,
          }),
          updated_at: new Date().toISOString(),
        }),
    );
    return NextResponse.redirect(`${appUrl()}/parametres?drive=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl()}/parametres?drive=error`);
  }
}
