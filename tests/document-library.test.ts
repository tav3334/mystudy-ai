import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentList } from "../src/components/documents/document-list";
import type { StudyData } from "../src/lib/data";
describe("automatic-only document library", () => {
  it("shows queued and failed documents without per-file processing buttons", () => {
    const doc = {
      id: "test-doc",
      name: "Course.pdf",
      status: "queued",
      category: "Cours",
      module_id: null,
      source_url: "https://drive.google.com/file/d/test/view",
      modified_at: "2026-11-13T00:00:00Z",
      processing_error: null,
    };
    const data: StudyData = {
      configured: true,
      email: "fixture@example.test",
      modules: [],
      documents: [
        doc,
        {
          ...doc,
          id: "failed-doc",
          status: "failed",
          processing_error: "PDF sans texte lisible.",
        },
      ],
      attempts: [],
      tasks: [],
      flashcards: [],
      sync: null,
      connected: true,
      usage: 0,
    };
    const html = renderToStaticMarkup(createElement(DocumentList, { data }));
    expect(html).toContain("Course.pdf");
    expect(html).toContain("PDF sans texte lisible.");
    expect(html).toContain("drive.google.com");
    expect(html).not.toContain("<button");
  });
});
