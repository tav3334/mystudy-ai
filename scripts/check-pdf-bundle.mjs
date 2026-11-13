import { readFile } from "node:fs/promises";
const trace = JSON.parse(
  await readFile(".next/server/app/api/jobs/route.js.nft.json", "utf8"),
);
const files = trace.files.map((p) => p.replaceAll("\\", "/"));
for (const [label, pattern] of [
  ["PDF worker module", /pdf-parse\/dist\/worker\/(esm|cjs)\/index\./],
  ["PDF worker asset", /pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs/],
  ["Canvas runtime", /@napi-rs\/canvas\//],
]) {
  if (!files.some((p) => pattern.test(p)))
    throw new Error(`${label} missing from production trace`);
  console.log(`${label}: included`);
}
