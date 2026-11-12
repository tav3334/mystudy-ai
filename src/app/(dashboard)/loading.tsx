export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Chargement en cours"
      className="space-y-6 animate-pulse"
    >
      <div className="h-10 w-64 rounded-lg bg-[var(--border)]" />
      <div className="h-48 rounded-xl bg-[var(--border)]" />
      <div className="grid grid-cols-2 gap-5">
        <div className="h-64 rounded-xl bg-[var(--border)]" />
        <div className="h-64 rounded-xl bg-[var(--border)]" />
      </div>
    </div>
  );
}
