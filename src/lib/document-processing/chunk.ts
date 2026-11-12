import { createHash } from "node:crypto";
import type { ExtractedSection } from "./extract";
export function chunkSections(sections: ExtractedSection[], maxChars = 2400) {
  const output: {
    ordinal: number;
    content: string;
    page: number | null;
    section: string | null;
    content_hash: string;
  }[] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    const clean = s.content.replace(/\r/g, "").replace(/\0/g, "").trim();
    let heading = s.section;
    for (const paragraph of clean.split(/\n\s*\n/)) {
      if (/^#{1,6}\s/.test(paragraph))
        heading = paragraph.split("\n")[0].replace(/^#+\s*/, "");
      for (let start = 0; start < paragraph.length;) {
        let end = Math.min(start + maxChars, paragraph.length);
        if (end < paragraph.length) {
          const boundary = paragraph.lastIndexOf(" ", end);
          if (boundary > start + maxChars / 2) end = boundary;
        }
        const content = paragraph.slice(start, end).trim();
        if (content.length >= 30) {
          const hash = createHash("sha256")
            .update(`${s.page ?? ""}:${content}`)
            .digest("hex");
          if (!seen.has(hash)) {
            seen.add(hash);
            output.push({
              ordinal: output.length,
              content,
              page: s.page,
              section: heading,
              content_hash: hash,
            });
          }
        }
        if (end === paragraph.length) break;
        start = Math.max(start + 1, end - 200);
      }
    }
  }
  return output;
}
