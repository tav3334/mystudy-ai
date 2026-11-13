export function dailyLimit(value = process.env.AI_DAILY_REQUEST_LIMIT) {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(5000, Math.floor(parsed))
    : 50;
}
// The existing atomic SQL quota counts all historical operations. Offset only legacy embeddings,
// so the configured ceiling remains the number of generation requests, without deleting usage history.
export function generationCeiling(limit: number, legacyEmbeddings: number) {
  return (
    limit +
    (Number.isSafeInteger(legacyEmbeddings) && legacyEmbeddings > 0
      ? legacyEmbeddings
      : 0)
  );
}
export function nextQuotaReset(now = Date.now()) {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}
export function recoverableFailure(message: string | null) {
  return (
    !message ||
    /Indexation interrompue|quota|Limite AI|Gemini|expiré|configuration|moteur PDF|serveur/i.test(
      message,
    )
  );
}
export class ProcessingYield extends Error {
  constructor() {
    super("INDEXING_YIELD");
    this.name = "ProcessingYield";
  }
}
