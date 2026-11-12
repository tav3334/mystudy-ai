import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extract } from "../src/lib/document-processing/extract";
function pdfFixture() {
  const stream =
    "BT /F1 16 Tf 72 720 Td (Docker containers share the host kernel and isolate processes.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}
describe("document extraction", () => {
  it("extracts an actual PDF buffer with page references", async () => {
    const sections = await extract(
      pdfFixture(),
      "application/pdf",
      "course.pdf",
    );
    expect(sections[0].content).toContain("Docker containers share");
    expect(sections[0].page).toBe(1);
  });
  it("preserves markdown text", async () => {
    const r = await extract(
      Buffer.from("# Linux\n\nLes processus utilisent le noyau."),
      "text/markdown",
      "cours.md",
    );
    expect(r[0].content).toContain("# Linux");
  });
  it("extracts PPTX slides in numeric order", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide10.xml", "<a:t>Dixième diapositive</a:t>");
    zip.file("ppt/slides/slide2.xml", "<a:t>Deuxième &amp; exemple</a:t>");
    const r = await extract(
      await zip.generateAsync({ type: "nodebuffer" }),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "slides.pptx",
    );
    expect(r.map((s) => s.page)).toEqual([2, 10]);
    expect(r[0].content).toBe("Deuxième & exemple");
  });
  it("rejects unsupported formats and oversized inputs", async () => {
    await expect(
      extract(Buffer.from("unknown"), "application/octet-stream", "file.exe"),
    ).rejects.toThrow("Format non pris");
    await expect(
      extract(Buffer.alloc(21 * 1024 * 1024), "text/plain", "big.txt"),
    ).rejects.toThrow("volumineux");
  });
});
