"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, PauseCircle, Cloud } from "lucide-react";
type Status = {
  connected: boolean;
  ready: number;
  total: number;
  pending: number;
  processing: number;
  failed: number;
  paused: boolean;
  pauseReason?: "provider" | "daily";
  reserved: number;
  retryAt: string;
};
export function AutomaticIndexing({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<Status | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous = "";
    const controller = new AbortController();
    async function tick() {
      try {
        if (document.visibilityState === "visible") {
          const response = await fetch("/api/documents/index", {
            method: "POST",
            signal: controller.signal,
          });
          if (response.ok) {
            const data = (await response.json()) as Status;
            if (stopped) return;
            setState(data);
            const signature = JSON.stringify([
              data.ready,
              data.pending,
              data.processing,
              data.failed,
            ]);
            if (previous && previous !== signature) router.refresh();
            previous = signature;
          }
        }
      } catch {
        /* Next visible poll retries after a connectivity loss. */
      } finally {
        if (!stopped) timer = setTimeout(tick, 30000);
      }
    }
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, router]);
  if (!state?.connected || !state.total) return null;
  const waiting = state.pending + state.processing;
  const paused = state.paused && waiting > 0;
  const Icon = paused
    ? PauseCircle
    : waiting
      ? LoaderCircle
      : state.failed
        ? Cloud
        : CheckCircle2;
  return (
    <div
      role="status"
      className="mb-6 panel px-4 py-3 flex items-start gap-3 text-xs"
    >
      <Icon
        size={17}
        className={`${paused ? "text-amber-600" : "text-emerald-600"} shrink-0 ${waiting && !paused ? "animate-spin" : ""}`}
      />
      <div className="flex-1">
        <p className="font-semibold">
          {paused
            ? "Indexation en pause · quota protégé"
            : waiting
              ? "Indexation automatique en cours"
              : state.failed
                ? "Documents à vérifier"
                : "Bibliothèque à jour"}
          <span className="font-normal muted ml-2">
            {state.ready}/{state.total} documents indexés
            {waiting ? ` · ${waiting} en attente` : ""}
          </span>
        </p>
        <p className="muted mt-1 leading-5">
          {paused
            ? state.pauseReason === "provider"
              ? "Gemini a demandé une pause. Nouvelle tentative automatique dans environ une heure, selon les quotas du fournisseur."
              : `Reprise automatique après le renouvellement du quota. Jusqu’à ${state.reserved} requêtes restent réservées aux QCM ; aucune commande n’est nécessaire.`
            : waiting
              ? "Les cours sont préparés côté serveur. Vous pouvez continuer à utiliser le site ou fermer cette page."
              : state.failed
                ? `${state.failed} fichier(s) demandent une vérification ; le détail apparaît dans Documents.`
                : "Les nouveaux documents seront préparés automatiquement après leur synchronisation."}
        </p>
      </div>
    </div>
  );
}
