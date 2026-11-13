import { providerCooldownUntil } from "../src/lib/document-processing/policy";
import { describe, it, expect, vi } from "vitest";
import {
  runIndexingBatch,
  type BatchPorts,
} from "../src/lib/document-processing/batch";
import {
  dailyLimit,
  indexingLimit,
  nextQuotaReset,
  recoverableFailure,
} from "../src/lib/document-processing/policy";
function ports(overrides: Partial<BatchPorts> = {}): BatchPorts {
  return {
    acquire: vi.fn(async () => "lease"),
    release: vi.fn(async () => {}),
    repair: vi.fn(async () => {}),
    state: vi.fn(async () => ({ paused: false, runnable: 1 })),
    process: vi.fn(async () => ({ processed: true })),
    continue: vi.fn(async () => {}),
    now: () => 0,
    ...overrides,
  };
}
describe("bounded automatic indexing", () => {
  it("does nothing when another invocation owns the account lease", async () => {
    const p = ports({ acquire: vi.fn(async () => null) });
    await runIndexingBatch("alice", p);
    expect(p.process).not.toHaveBeenCalled();
    expect(p.continue).not.toHaveBeenCalled();
  });
  it("pauses before claiming documents when the quota is exhausted", async () => {
    const p = ports({
      state: vi.fn(async () => ({ paused: true, runnable: 20 })),
    });
    await runIndexingBatch("alice", p);
    expect(p.process).not.toHaveBeenCalled();
    expect(p.continue).not.toHaveBeenCalled();
    expect(p.release).toHaveBeenCalledWith("alice", "lease");
  });
  it("bounds a batch and continues on the server for the same account", async () => {
    const p = ports();
    const result = await runIndexingBatch("alice", p, { maxDocuments: 2 });
    expect(result.processed).toBe(2);
    expect(p.process).toHaveBeenCalledTimes(2);
    expect(p.process).toHaveBeenCalledWith("alice", 230000);
    expect(p.continue).toHaveBeenCalledWith("alice");
    expect(vi.mocked(p.release).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(p.continue).mock.invocationCallOrder[0],
    );
  });
  it("stops the chain when the queue is empty", async () => {
    const p = ports({
      process: vi.fn(async () => ({ processed: false })),
      state: vi.fn(async () => ({ paused: false, runnable: 0 })),
    });
    await runIndexingBatch("alice", p);
    expect(p.continue).not.toHaveBeenCalled();
  });
  it("preserves the queue and stops on a provider/application quota pause", async () => {
    const p = ports({
      process: vi.fn(async () => ({ processed: false, paused: true })),
    });
    const result = await runIndexingBatch("alice", p);
    expect(result.paused).toBe(true);
    expect(p.continue).not.toHaveBeenCalled();
  });
  it("continues a checkpointed document in a new invocation", async () => {
    const p = ports({
      process: vi.fn(async () => ({ processed: false, yielded: true })),
    });
    await runIndexingBatch("alice", p);
    expect(p.continue).toHaveBeenCalledOnce();
  });
  it("releases the lease on unexpected failure", async () => {
    const p = ports({
      process: vi.fn(async () => {
        throw new Error("database down");
      }),
    });
    await expect(runIndexingBatch("alice", p)).rejects.toThrow("database down");
    expect(p.release).toHaveBeenCalledWith("alice", "lease");
    expect(p.continue).not.toHaveBeenCalled();
  });
  it("does not start a document without enough execution time", async () => {
    const p = ports();
    await runIndexingBatch("alice", p, { budgetMs: 100000 });
    expect(p.process).not.toHaveBeenCalled();
    expect(p.continue).toHaveBeenCalled();
  });
});
describe("quota reservation and retry policy", () => {
  it("keeps generation requests available without increasing the daily cap", () => {
    expect(indexingLimit(50)).toBe(45);
    expect(indexingLimit(200)).toBe(195);
    expect(indexingLimit(1)).toBe(0);
  });
  it("rejects invalid environment limits and clamps excessive limits", () => {
    expect(dailyLimit("not-a-number")).toBe(50);
    expect(dailyLimit("-5")).toBe(50);
    expect(dailyLimit("99999")).toBe(5000);
  });
  it("resumes at the next UTC day boundary", () => {
    expect(nextQuotaReset(Date.parse("2026-11-13T23:58:00Z"))).toBe(
      "2026-11-14T00:00:00.000Z",
    );
  });
  it("retries transient failures but does not repeatedly process OCR-only scans", () => {
    expect(
      recoverableFailure(
        "Indexation interrompue. Vérifiez la connexion Drive et les quotas AI, puis réessayez.",
      ),
    ).toBe(true);
    expect(recoverableFailure("PDF sans texte lisible. OCR requis.")).toBe(
      false,
    );
    expect(recoverableFailure("Format non pris en charge.")).toBe(false);
  });
});

describe("provider quota cooldown", () => {
  it("waits for an hour instead of consuming the next documents on repeated 429 responses", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(providerCooldownUntil("2026-11-13T11:30:00Z", now)).toBe(
      "2026-11-13T12:30:00.000Z",
    );
    expect(providerCooldownUntil("2026-11-13T10:00:00Z", now)).toBeNull();
    expect(providerCooldownUntil(null, now)).toBeNull();
  });
});
