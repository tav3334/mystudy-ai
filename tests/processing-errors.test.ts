import { describe, it, expect } from "vitest";
import { processingFailure } from "../src/lib/document-processing/errors";
describe("safe processing diagnostics", () => {
  it("distinguishes provider quota from the application daily quota", () => {
    expect(
      processingFailure(new Error("AI provider failed (429)"), "embed").code,
    ).toBe("AI_PROVIDER_QUOTA");
    expect(processingFailure(new Error("DAILY_AI_LIMIT"), "embed").code).toBe(
      "AI_DAILY_LIMIT",
    );
  });
  it("distinguishes missing models, bad keys and Google access", () => {
    expect(
      processingFailure(new Error("AI provider failed (404)"), "embed").code,
    ).toBe("AI_MODEL");
    expect(
      processingFailure(new Error("AI provider failed (403)"), "embed").code,
    ).toBe("AI_ACCESS");
    expect(
      processingFailure(new Error("Drive request failed (403)"), "download")
        .code,
    ).toBe("DRIVE_ACCESS");
  });
  it("identifies missing PDF runtime assets", () => {
    expect(
      processingFailure(new Error("Setting up fake worker failed"), "extract")
        .code,
    ).toBe("PDF_RUNTIME");
    expect(
      processingFailure(new Error("DOMMatrix is not defined"), "extract").code,
    ).toBe("PDF_RUNTIME");
  });
  it("never exposes arbitrary exception content or credentials", () => {
    const sensitive =
      "private-token document-text https://example.com/?token=secret";
    const result = processingFailure(new Error(sensitive), "save");
    expect(result.message).not.toContain(sensitive);
    expect(result.code).toBe("PROCESSING_FAILED");
  });
  it("reports scanned and password-protected PDF documents", () => {
    expect(
      processingFailure(
        new Error(
          "PDF sans texte lisible. OCR requis : exportez une version OCR puis resynchronisez.",
        ),
        "extract",
      ).code,
    ).toBe("DOCUMENT_CONTENT");
    const password = new Error("private password value");
    password.name = "PasswordException";
    const result = processingFailure(password, "extract");
    expect(result.code).toBe("PDF_PASSWORD");
    expect(result.message).not.toContain("private password value");
  });
});
