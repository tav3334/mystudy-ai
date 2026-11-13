export type BatchState = { runnable: number };
export type BatchResult = {
  processed: boolean;
  yielded?: boolean;
  failed?: boolean;
};
export interface BatchPorts {
  acquire(userId: string): Promise<string | null>;
  release(userId: string, token: string): Promise<void>;
  repair(userId: string, resetFailures: boolean): Promise<void>;
  state(userId: string): Promise<BatchState>;
  process(userId: string, deadline: number): Promise<BatchResult>;
  continue(userId: string): Promise<void>;
  now(): number;
}
export async function runIndexingBatch(
  userId: string,
  ports: BatchPorts,
  options: {
    resetFailures?: boolean;
    budgetMs?: number;
    maxDocuments?: number;
  } = {},
) {
  const token = await ports.acquire(userId);
  if (!token) return { busy: true, processed: 0 };
  const deadline = ports.now() + (options.budgetMs ?? 230000);
  let processed = 0;
  let idle = false;
  try {
    await ports.repair(userId, options.resetFailures ?? false);
    while (
      processed < (options.maxDocuments ?? 20) &&
      ports.now() < deadline - 105000
    ) {
      const result = await ports.process(userId, deadline);
      if (result.yielded) break;
      if (!result.processed) {
        idle = true;
        break;
      }
      processed++;
    }
  } finally {
    await ports.release(userId, token);
  }
  const remaining = await ports.state(userId);
  if (!idle && remaining.runnable > 0) await ports.continue(userId);
  return { busy: false, processed };
}
