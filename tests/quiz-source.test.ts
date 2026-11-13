import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizSource } from "../src/components/quiz/source";
import { courseSourceUrl } from "../src/lib/learning/source";
describe("course citations", () => {
  it("only opens HTTPS Google Drive or Google Docs links", () => {
    expect(
      courseSourceUrl("https://drive.google.com/file/d/course/view"),
    ).toContain("drive.google.com");
    expect(
      courseSourceUrl("https://docs.google.com/presentation/d/course/edit"),
    ).toContain("docs.google.com");
    for (const url of [
      undefined,
      "javascript:alert(1)",
      "http://drive.google.com/file/d/course/view",
      "https://drive.google.com.evil.example/",
      "https://user:password@drive.google.com/",
      "invalid",
    ])
      expect(courseSourceUrl(url)).toBeNull();
  });
  it("shows the exact saved quote, document, page and section", () => {
    const html = renderToStaticMarkup(
      createElement(QuizSource, {
        source: {
          quote: "Le noyau est partagé entre les conteneurs.",
          document_name: "Docker.pdf",
          page: 3,
          section: "Isolation",
          source_url: "https://drive.google.com/file/d/course/view",
        },
      }),
    );
    for (const text of [
      "Docker.pdf",
      "Page / diapositive 3",
      "Isolation",
      "Le noyau est partagé entre les conteneurs.",
      "Ouvrir le document Google Drive",
    ])
      expect(html).toContain(text);
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("keeps evidence readable when a source link is missing or unsafe", () => {
    const html = renderToStaticMarkup(
      createElement(QuizSource, {
        source: {
          quote: "Un extrait conservé.",
          source_url: "javascript:alert(1)",
        },
      }),
    );
    expect(html).toContain("Un extrait conservé.");
    expect(html).toContain("indisponible");
    expect(html).not.toContain("href=");
  });
});
