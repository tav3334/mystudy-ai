import { describe, it, expect } from "vitest";
import {
  isTrustedBrowserRequest,
  type BrowserRequest,
  type OriginSettings,
} from "../src/lib/validation/origin";
const canonical = "https://mystudy-ai-two.vercel.app";
const settings: OriginSettings = {
  appUrl: canonical + "/",
  deploymentHost: "mystudy-ai-build123-team.vercel.app",
  branchHost: "mystudy-ai-git-master-team.vercel.app",
  productionHost: "mystudy-ai-two.vercel.app",
};
function request(
  origin: string | null,
  url = canonical + "/api/quizzes/generate",
  extra: Partial<BrowserRequest> = {},
): BrowserRequest {
  return { url, origin, referer: null, fetchSite: null, ...extra };
}
describe("CSRF origin validation on Vercel", () => {
  it("accepts the configured production origin with a trailing slash in configuration", () => {
    expect(isTrustedBrowserRequest(request(canonical), settings)).toBe(true);
  });
  it("accepts exact deployment and branch hostnames supplied by Vercel", () => {
    for (const host of [settings.deploymentHost, settings.branchHost]) {
      expect(
        isTrustedBrowserRequest(
          request(`https://${host}`, `https://${host}/api/quizzes/generate`),
          settings,
        ),
      ).toBe(true);
    }
  });
  it("accepts the platform production hostname even when the app URL is stale", () => {
    expect(
      isTrustedBrowserRequest(request(canonical), {
        ...settings,
        appUrl: "http://localhost:3000",
      }),
    ).toBe(true);
  });
  it("rejects another Vercel project and lookalike domains", () => {
    for (const origin of [
      "https://other-project.vercel.app",
      "https://mystudy-ai-two.vercel.app.evil.example",
      "https://evil.example",
    ])
      expect(isTrustedBrowserRequest(request(origin), settings)).toBe(false);
  });
  it("rejects null, malformed origins, credentials and origins with paths", () => {
    for (const origin of [
      "null",
      "not a URL",
      "https://secret@mystudy-ai-two.vercel.app",
      canonical + "/attack",
    ])
      expect(isTrustedBrowserRequest(request(origin), settings)).toBe(false);
  });
  it("does not allow HTTP downgrades or arbitrary ports in production", () => {
    expect(
      isTrustedBrowserRequest(
        request("http://mystudy-ai-two.vercel.app"),
        settings,
      ),
    ).toBe(false);
    expect(isTrustedBrowserRequest(request(canonical + ":444"), settings)).toBe(
      false,
    );
  });
  it("rejects missing Origin without both same-origin browser signals", () => {
    expect(isTrustedBrowserRequest(request(null), settings)).toBe(false);
    expect(
      isTrustedBrowserRequest(
        request(null, undefined, { fetchSite: "same-origin" }),
        settings,
      ),
    ).toBe(false);
    expect(
      isTrustedBrowserRequest(
        request(null, undefined, { referer: canonical + "/qcm" }),
        settings,
      ),
    ).toBe(false);
  });
  it("accepts a stripped Origin only with same-origin metadata and a trusted matching referer", () => {
    expect(
      isTrustedBrowserRequest(
        request(null, undefined, {
          fetchSite: "same-origin",
          referer: canonical + "/qcm",
        }),
        settings,
      ),
    ).toBe(true);
    expect(
      isTrustedBrowserRequest(
        request(null, undefined, {
          fetchSite: "same-origin",
          referer: "https://evil.example/qcm",
        }),
        settings,
      ),
    ).toBe(false);
  });
  it("rejects cross-site Fetch Metadata even when a supplied origin claims to be trusted", () => {
    expect(
      isTrustedBrowserRequest(
        request(canonical, undefined, { fetchSite: "cross-site" }),
        settings,
      ),
    ).toBe(false);
  });
  it("accepts loopback only for a matching local development server", () => {
    const local = request(
      "http://localhost:3001",
      "http://localhost:3001/api/quizzes/generate",
    );
    expect(isTrustedBrowserRequest(local, { development: true })).toBe(true);
    expect(isTrustedBrowserRequest(local, { development: false })).toBe(false);
    expect(
      isTrustedBrowserRequest(request("http://localhost:3002", local.url), {
        development: true,
      }),
    ).toBe(false);
  });
});
