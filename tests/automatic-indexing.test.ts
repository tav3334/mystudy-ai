import { describe, it, expect, vi } from "vitest";
import {
  runIndexingBatch,
  type BatchPorts,
} from "../src/lib/document-processing/batch";
import {
  dailyLimit,
  generationCeiling,
  nextQuotaReset,
  recoverableFailure,
} from "../src/lib/document-processing/policy";
function ports(overrides: Partial<BatchPorts> = {}): BatchPorts {
  return {
    acquire: vi.fn(async () => "lease"),
    release: vi.fn(async () => {}),
    repair: vi.fn(async () => {}),
    state: vi.fn(async () => ({ runnable: 1 })),
    process: vi.fn(async () => ({ processed: true })),
    continue: vi.fn(async () => {}),
    now: () => 0,
    ...overrides,
  };
}
describe("automatic preparation independent of AI quotas", () => {
  it("does not steal a live account lease", async () => {
    const p = ports({ acquire: vi.fn(async () => null) });
    await runIndexingBatch("alice", p);
    expect(p.process).not.toHaveBeenCalled();
  });
  it("continues preparing when the generation budget is exhausted", async () => {
    const p = ports({
      state: vi.fn(async () => ({ runnable: 10, used: 200, limit: 200 })),
    });
    const result = await runIndexingBatch("alice", p, { maxDocuments: 2 });
    expect(result.processed).toBe(2);
    expect(p.continue).toHaveBeenCalledWith("alice");
  });
  it("bounds batches and releases before requesting a continuation", async () => {
    const p = ports();
    await runIndexingBatch("alice", p, { maxDocuments: 2 });
    expect(p.process).toHaveBeenCalledTimes(2);
    expect(p.process).toHaveBeenCalledWith("alice", 230000);
    expect(vi.mocked(p.release).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(p.continue).mock.invocationCallOrder[0],
    );
  });
  it("stops when no runnable work remains", async () => {
    const p = ports({
      process: vi.fn(async () => ({ processed: false })),
      state: vi.fn(async () => ({ runnable: 0 })),
    });
    await runIndexingBatch("alice", p);
    expect(p.continue).not.toHaveBeenCalled();
  });
  it("does not abandon other documents when one file is unsupported", async () => {
    const p = ports({
      process: vi.fn(async () => ({ processed: true, failed: true })),
      state: vi.fn(async () => ({ runnable: 0 })),
    });
    await runIndexingBatch("alice", p, { maxDocuments: 2 });
    expect(p.process).toHaveBeenCalledTimes(2);
  });
  it("continues a deadline interruption on the server", async () => {
    const p = ports({
      process: vi.fn(async () => ({ processed: false, yielded: true })),
    });
    await runIndexingBatch("alice", p);
    expect(p.continue).toHaveBeenCalledOnce();
  });
  it("releases the lease after an unexpected failure", async () => {
    const p = ports({
      process: vi.fn(async () => {
        throw new Error("database down");
      }),
    });
    await expect(runIndexingBatch("alice", p)).rejects.toThrow("database down");
    expect(p.release).toHaveBeenCalledWith("alice", "lease");
  });
  it("waits for a fresh invocation when little execution time remains", async () => {
    const p = ports();
    await runIndexingBatch("alice", p, { budgetMs: 100000 });
    expect(p.process).not.toHaveBeenCalled();
    expect(p.continue).toHaveBeenCalled();
  });
});
describe("generation-only quota accounting", () => {
  it("offsets historical embedding calls without increasing the configured generation budget", () => {
    expect(generationCeiling(200, 200)).toBe(400);
    expect(generationCeiling(200, 0)).toBe(200);
    expect(generationCeiling(50, -3)).toBe(50);
  });
  it("keeps the daily generation safety cap", () => {
    expect(dailyLimit("bad")).toBe(50);
    expect(dailyLimit("999999")).toBe(5000);
    expect(dailyLimit("200")).toBe(200);
  });
  it("uses the next UTC midnight", () => {
    expect(nextQuotaReset(Date.parse("2026-11-13T23:58:00Z"))).toBe(
      "2026-11-14T00:00:00.000Z",
    );
  });
  it("recovers old quota failures but never loops on an OCR-only scan", () => {
    expect(recoverableFailure("Limite AI quotidienne atteinte.")).toBe(true);
    expect(recoverableFailure("PDF sans texte lisible. OCR requis.")).toBe(
      false,
    );
  });
});
