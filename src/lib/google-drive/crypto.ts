import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { required } from "@/lib/env";
function key() {
  const value = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "base64");
  if (value.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return value;
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decrypt<T>(value: string): T {
  const raw = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  cipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
