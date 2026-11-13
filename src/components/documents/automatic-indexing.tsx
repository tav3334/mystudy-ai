"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Cloud } from "lucide-react";
type Status = {
  connected: boolean;
  ready: number;
  total: number;
  pending: number;
  processing: number;
  failed: number;
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
        /* Next visible poll retries a lost connection. */
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
  const Icon = waiting ? LoaderCircle : state.failed ? Cloud : CheckCircle2;
  return (
    <div
      role="status"
      className="mb-6 panel px-4 py-3 flex items-start gap-3 text-xs"
    >
      <Icon
        size={17}
        className={`text-emerald-600 shrink-0 ${waiting ? "animate-spin" : ""}`}
      />
      <div className="flex-1">
        <p className="font-semibold">
          {waiting
            ? "Préparation automatique des cours"
            : state.failed
              ? "Documents à vérifier"
              : "Vos cours sont prêts"}
          <span className="font-normal muted ml-2">
            {state.ready}/{state.total} prêts
            {waiting ? ` · ${waiting} à préparer` : ""}
          </span>
        </p>
        <p className="muted mt-1 leading-5">
          {waiting
            ? "Le texte des documents est préparé sans AI et sans consommer votre quota Gemini. Vous pouvez fermer cette page."
            : state.failed
              ? `${state.failed} fichier(s) demandent une vérification dans Documents. Les autres cours sont disponibles pour vos QCM.`
              : "Aucun appel AI pour préparer les documents. Gemini intervient uniquement lorsque vous demandez une génération."}
        </p>
      </div>
    </div>
  );
}
