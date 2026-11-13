export function dailyLimit(value = process.env.AI_DAILY_REQUEST_LIMIT) {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(5000, Math.floor(parsed))
    : 50;
}
export function indexingLimit(limit = dailyLimit()) {
  return Math.max(0, limit - Math.min(5, Math.max(1, Math.floor(limit / 10))));
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

export function providerCooldownUntil(
  lastFailure: string | null | undefined,
  now = Date.now(),
) {
  const retry = lastFailure ? new Date(lastFailure).getTime() + 3600000 : 0;
  return Number.isFinite(retry) && retry > now
    ? new Date(retry).toISOString()
    : null;
}
