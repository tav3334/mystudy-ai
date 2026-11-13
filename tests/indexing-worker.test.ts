import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  embed: vi.fn(),
  writes: [] as { table: string; payload: Record<string, unknown> }[],
}));
vi.mock("../src/lib/document-processing/queue", () => ({
  claimIndexingJob: mocks.claim,
}));
vi.mock("../src/lib/ai/provider", () => ({ ai: { embed: mocks.embed } }));
vi.mock("../src/lib/google-drive/client", () => ({
  accessToken: async () => "test-access-token",
  driveFetch: async () =>
    new Response("Test text for indexing a course document."),
}));
vi.mock("../src/lib/document-processing/extract", () => ({
  extract: async () => [
    {
      content: "Course content about containers and the host kernel.",
      page: 1,
      section: null,
    },
  ],
}));
vi.mock("../src/lib/supabase/server", () => ({
  checked: (result: { data: unknown; error: unknown }) => {
    if (result.error) throw result.error;
    return result.data;
  },
  admin: () => ({
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        update: (payload: Record<string, unknown>) => {
          mocks.writes.push({ table, payload });
          return chain;
        },
        upsert: () => chain,
        single: async () => ({
          data: {
            id: "doc",
            active: true,
            version: "v1",
            size_bytes: 40,
            mime_type: "text/plain",
            name: "course.txt",
            drive_id: "drive-doc",
          },
          error: null,
        }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data: table === "document_chunks" ? [] : null,
            error: null,
          }),
      };
      return chain;
    },
  }),
}));
import { processNext } from "../src/lib/document-processing/worker";
beforeEach(() => {
  mocks.writes.length = 0;
  mocks.claim.mockResolvedValue({
    id: "job",
    document_id: "doc",
    user_id: "alice",
    version: "v1",
    attempts: 1,
  });
  mocks.embed.mockReset();
});
describe("worker checkpoint and quota behavior", () => {
  it("keeps a quota-limited document pending instead of failed", async () => {
    mocks.embed.mockRejectedValue(new Error("DAILY_AI_LIMIT"));
    const result = await processNext({ userId: "alice" });
    expect(result.paused).toBe(true);
    expect(
      mocks.writes.some(
        (w) =>
          w.table === "document_processing_jobs" &&
          w.payload.status === "pending" &&
          w.payload.attempts === 0,
      ),
    ).toBe(true);
    expect(mocks.writes.some((w) => w.payload.status === "failed")).toBe(false);
  });
  it("yields before the hosting deadline without consuming another AI call", async () => {
    const result = await processNext({
      userId: "alice",
      deadline: Date.now() + 1000,
    });
    expect(result.yielded).toBe(true);
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(
      mocks.writes.some(
        (w) =>
          w.table === "document_processing_jobs" &&
          w.payload.status === "pending",
      ),
    ).toBe(true);
  });
  it("claims only the requested account jobs", async () => {
    mocks.claim.mockResolvedValue(null);
    await processNext({ userId: "alice" });
    expect(mocks.claim).toHaveBeenCalledWith("alice");
    expect(mocks.embed).not.toHaveBeenCalled();
  });
});

describe("bounded checkpoint continuation", () => {
  it("stops an oversized document after three deadline exits with no saved progress", async () => {
    mocks.claim.mockResolvedValue({
      id: "job",
      document_id: "doc",
      user_id: "alice",
      version: "v1",
      attempts: 3,
    });
    const result = await processNext({
      userId: "alice",
      deadline: Date.now() + 1000,
    });
    expect(result).toMatchObject({
      failed: true,
      errorCode: "INDEXING_STALLED",
    });
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(
      mocks.writes.some(
        (w) =>
          w.table === "document_processing_jobs" &&
          w.payload.status === "failed",
      ),
    ).toBe(true);
  });
});
