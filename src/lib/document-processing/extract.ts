import { validateOfficeZip } from "./zip-safety";
import mammoth from "mammoth";
import JSZip from "jszip";
export type ExtractedSection = {
  content: string;
  page: number | null;
  section: string | null;
};
export function xmlText(xml: string) {
  return [...xml.matchAll(/<(?:a|w):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:a|w):t>/g)]
    .map((m) =>
      m[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&"),
    )
    .join(" ");
}
export async function extract(
  buffer: Buffer,
  mime: string,
  name: string,
): Promise<ExtractedSection[]> {
  if (buffer.length > 20 * 1024 * 1024)
    throw new Error("Document trop volumineux (20 Mo maximum).");
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    const { getData, CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    PDFParse.setWorker(getData());
    const parser = new PDFParse({
      data: buffer,
      isEvalSupported: false,
      CanvasFactory,
    });
    try {
      const result = await parser.getText();
      const pages = result.pages.map((p) => ({
        content: p.text,
        page: p.num,
        section: null,
      }));
      if (pages.reduce((n, p) => n + p.content.trim().length, 0) < 60)
        throw new Error(
          "PDF sans texte lisible. OCR requis : exportez une version OCR puis resynchronisez.",
        );
      return pages;
    } finally {
      await parser.destroy();
    }
  }
  if (/wordprocessingml/.test(mime) || /\.docx$/i.test(name)) {
    validateOfficeZip(buffer);
    const r = await mammoth.extractRawText({ buffer });
    return [{ content: r.value, page: null, section: null }];
  }
  if (/presentationml/.test(mime) || /\.pptx$/i.test(name)) {
    validateOfficeZip(buffer);
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort(
        (a, b) =>
          Number(a.match(/slide(\d+)/)?.[1]) -
          Number(b.match(/slide(\d+)/)?.[1]),
      );
    if (names.length > 500) throw new Error("Présentation trop longue.");
    const result: ExtractedSection[] = [];
    let total = 0;
    for (const file of names) {
      const content = await zip.file(file)!.async("string");
      total += content.length;
      if (total > 20_000_000)
        throw new Error("Présentation trop volumineuse après décompression.");
      result.push({
        content: xmlText(content),
        page: Number(file.match(/slide(\d+)/)?.[1]),
        section: "Diapositive",
      });
    }
    return result;
  }
  if (mime.startsWith("text/") || /\.(txt|md|markdown)$/i.test(name))
    return [{ content: buffer.toString("utf8"), page: null, section: null }];
  throw new Error(
    "Format non pris en charge. Utilisez PDF, DOCX, PPTX, TXT ou Markdown.",
  );
}
