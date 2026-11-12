import "server-only";
import { admin, checked } from "@/lib/supabase/server";
import { decrypt, encrypt } from "./crypto";
import { required } from "@/lib/env";
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime: string;
  createdTime: string;
  version?: string;
  md5Checksum?: string;
  webViewLink?: string;
  size?: string;
  trashed?: boolean;
};
export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};
export async function accessToken(userId: string) {
  const db = admin();
  const c = checked(
    await db
      .from("drive_connections")
      .select("*")
      .eq("user_id", userId)
      .single(),
  );
  const tokens = decrypt<Tokens>(c.encrypted_tokens);
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("Google account reconnection required");
  const next = await r.json();
  checked(
    await db
      .from("drive_connections")
      .update({
        encrypted_tokens: encrypt({
          ...tokens,
          access_token: next.access_token,
          expires_at: Date.now() + next.expires_in * 1000,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId),
  );
  return next.access_token as string;
}
export async function driveFetch(
  token: string,
  path: string,
  query: Record<string, string> = {},
) {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(
      `https://www.googleapis.com/drive/v3/${path}?${new URLSearchParams(query)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (response.ok) return response;
    if (![429, 500, 502, 503, 504].includes(response.status)) break;
    await new Promise((r) =>
      setTimeout(r, Math.min(8000, 500 * 2 ** attempt + Math.random() * 300)),
    );
  }
  throw new Error(`Drive request failed (${response?.status})`);
}
export const fileFields =
  "id,name,mimeType,parents,modifiedTime,createdTime,version,md5Checksum,webViewLink,size,trashed";
export async function listChildren(token: string, parent: string) {
  const files: DriveFile[] = [];
  let pageToken = "";
  do {
    const r = await driveFetch(token, "files", {
      q: `'${parent.replaceAll("'", "\\'")}' in parents and trashed = false`,
      fields: `nextPageToken,files(${fileFields})`,
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const d = await r.json();
    files.push(...d.files);
    pageToken = d.nextPageToken ?? "";
  } while (pageToken);
  return files;
}
