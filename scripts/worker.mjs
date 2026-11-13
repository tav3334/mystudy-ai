const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("Set CRON_SECRET in .env.local before starting the worker.");
  process.exit(1);
}
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
console.log("MyStudy AI worker started. Ctrl+C to stop.");
while (!stopping) {
  try {
    const r = await fetch(new URL("/api/jobs", base), {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(310000),
    });
    if (!r.ok) {
      console.error(
        `Worker request failed (${r.status}). Check app configuration.`,
      );
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    const result = await r.json();
    if (result.processed)
      console.log(
        result.failed
          ? `Échec [${result.errorCode ?? "UNKNOWN"}] (${result.stage ?? "traitement"}) : ${result.error ?? "Consultez Documents."}`
          : "Document processed.",
      );
    else await new Promise((r) => setTimeout(r, 5000));
  } catch {
    console.error(
      "Cannot reach the app. Start npm run dev and verify NEXT_PUBLIC_APP_URL.",
    );
    await new Promise((r) => setTimeout(r, 15000));
  }
}
