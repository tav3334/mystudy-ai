import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  finish: vi.fn(),
  aiCall: vi.fn(),
  writes: [] as { table: string; payload: Record<string, unknown> }[],
}));
vi.mock("../src/lib/document-processing/queue", () => ({
  claimIndexingJob: mocks.claim,
}));
vi.mock("../src/lib/ai/provider", () => ({
  ai: { embed: mocks.aiCall, generate: mocks.aiCall },
}));
vi.mock("../src/lib/google-drive/client", () => ({
  accessToken: async () => "test-token",
  driveFetch: async () => new Response("Course text content."),
}));
vi.mock("../src/lib/document-processing/extract", () => ({
  extract: async () => [
    {
      content: "Course content about containers and the host kernel.",
      page: 3,
      section: "Containers",
    },
  ],
}));
vi.mock("../src/lib/supabase/server", () => ({
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  },
  admin: () => ({
    rpc: mocks.finish,
    from: (table: string) => {
      if (!["documents", "document_processing_jobs"].includes(table))
        throw new Error("Unexpected indexing access: " + table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (payload: Record<string, unknown>) => {
          mocks.writes.push({ table, payload });
          return chain;
        },
        single: async () => ({
          data: {
            id: "doc",
            active: true,
            version: "v1",
            size_bytes: 20,
            mime_type: "text/plain",
            name: "course.txt",
            drive_id: "drive-doc",
          },
          error: null,
        }),
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: null, error: null }),
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
  mocks.finish.mockReset().mockResolvedValue({ data: true, error: null });
  mocks.aiCall.mockReset().mockRejectedValue(new Error("DAILY_AI_LIMIT"));
});
describe("text-only automatic preparation", () => {
  it("prepares and saves a course while AI is unavailable, with no vector/cache/provider calls", async () => {
    const result = await processNext({ userId: "alice" });
    expect(result).toMatchObject({ processed: true, documentId: "doc" });
    expect(mocks.aiCall).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      "finish_document",
      expect.objectContaining({
        p_user: "alice",
        p_document: "doc",
        p_version: "v1",
        p_chunks: [
          expect.objectContaining({
            content: "Course content about containers and the host kernel.",
            page: 3,
            section: "Containers",
            embedding: null,
          }),
        ],
      }),
    );
    expect(mocks.writes.some((w) => w.payload.status === "failed")).toBe(false);
  });
  it("keeps a document queued before its hosting deadline", async () => {
    const result = await processNext({
      userId: "alice",
      deadline: Date.now() + 1000,
    });
    expect(result).toMatchObject({ processed: false, yielded: true });
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(
      mocks.writes.some(
        (w) =>
          w.table === "document_processing_jobs" &&
          w.payload.status === "pending",
      ),
    ).toBe(true);
    expect(mocks.aiCall).not.toHaveBeenCalled();
  });
  it("does not claim another account jobs", async () => {
    mocks.claim.mockResolvedValue(null);
    await processNext({ userId: "alice" });
    expect(mocks.claim).toHaveBeenCalledWith("alice");
    expect(mocks.finish).not.toHaveBeenCalled();
  });
  it("bounds repeated deadline failures instead of looping indefinitely", async () => {
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
    expect(mocks.aiCall).not.toHaveBeenCalled();
  });
});
