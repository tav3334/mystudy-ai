import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({
  requireUser: mocks.requireUser,
  admin: () => ({ rpc: mocks.rpc }),
}));
import { NextRequest } from "next/server";
import { apiUser } from "../src/lib/api";
const production = "https://mystudy-ai-two.vercel.app";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", production);
  vi.stubEnv("VERCEL_URL", "mystudy-ai-build123-team.vercel.app");
  mocks.requireUser.mockReset();
  mocks.rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("origin checks never bypass account authentication", () => {
  it("rejects an external origin before checking a session or touching the database", async () => {
    const req = new NextRequest(production + "/api/quizzes/generate", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    await expect(apiUser(req, "generate-quiz")).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("still requires a valid session on the exact deployment URL", async () => {
    mocks.requireUser.mockRejectedValue(new Error("AUTH_REQUIRED"));
    const origin = "https://mystudy-ai-build123-team.vercel.app";
    const req = new NextRequest(origin + "/api/quizzes/generate", {
      method: "POST",
      headers: { Origin: origin },
    });
    await expect(apiUser(req, "generate-quiz")).rejects.toThrow(
      "AUTH_REQUIRED",
    );
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retains the per-user rate limit after accepting the origin", async () => {
    mocks.requireUser.mockResolvedValue({ user: { id: "account-id" }, db: {} });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const req = new NextRequest(production + "/api/quizzes/generate", {
      method: "POST",
      headers: { Origin: production },
    });
    await apiUser(req, "generate-quiz", 4);
    expect(mocks.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_user: "account-id",
      p_bucket: "generate-quiz",
      p_limit: 4,
      p_seconds: 60,
    });
  });
});
