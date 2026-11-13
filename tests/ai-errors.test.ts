import { normalizeModel } from "../src/lib/ai/errors";
import { describe, it, expect } from "vitest";
import { AIProviderError, providerFailure } from "../src/lib/ai/errors";
describe("safe actionable Gemini failures", () => {
  it("distinguishes an unavailable model from an invalid key and quota", () => {
    expect(providerFailure(404, null).code).toBe("AI_MODEL_UNAVAILABLE");
    expect(
      providerFailure(400, { error: { message: "API key not valid" } }).code,
    ).toBe("AI_KEY_INVALID");
    expect(providerFailure(429, null).code).toBe("AI_QUOTA");
  });
  it("does not expose upstream bodies or credentials", () => {
    const error = providerFailure(403, {
      error: { message: "secret-api-key private document" },
    });
    expect(error.message).not.toContain("secret-api-key");
    expect(error.message).not.toContain("private document");
    expect(error.code).toBe("AI_ACCESS_DENIED");
  });
  it("maps provider problems to safe error statuses", () => {
    expect(new AIProviderError("AI_QUOTA").status).toBe(429);
    expect(new AIProviderError("AI_MODEL_UNAVAILABLE").status).toBe(502);
  });
});

describe("safe configured model names", () => {
  it("accepts model identifiers but never returns arbitrary environment values", () => {
    expect(normalizeModel("models/gemini-2.5-flash")).toBe("gemini-2.5-flash");
    expect(normalizeModel("sb_secret_test_value")).toBeNull();
    expect(normalizeModel("not a model identifier")).toBeNull();
  });
});
