"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Code2,
  Lightbulb,
  Eye,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyData } from "@/lib/data";
const Editor = dynamic(() => import("@/components/code-editor"), {
  ssr: false,
  loading: () => <p className="muted text-xs p-5">Chargement de l’éditeur…</p>,
});
export type Exercise = {
  id: string;
  title: string;
  statement: string;
  hint: string | null;
  solution: string | null;
  language: string;
  source: { source_url?: string; document_name?: string };
};
export function Practice({
  data,
  exercises,
}: {
  data: StudyData;
  exercises: Exercise[];
}) {
  const [doc, setDoc] = useState("");
  const [selected, setSelected] = useState(exercises[0]?.id ?? "");
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);
  const [busy, setBusy] = useState(false);
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const current = exercises.find((e) => e.id === selected);
  async function send(method: string, body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/exercises", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(
        method === "PUT"
          ? "Votre réponse a été sauvegardée."
          : d.cached
            ? "Ce document a déjà été analysé."
            : "Exercices identifiés. Sélectionnez un exercice pour commencer.",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="panel p-5 flex flex-col sm:flex-row gap-3">
        <select
          aria-label="Document TD ou TP"
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
        >
          <option value="">Choisir un TD ou TP prêt</option>
          {data.documents
            .filter(
              (d) => d.status === "ready" && ["TD", "TP"].includes(d.category),
            )
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
        <Button
          disabled={!doc || busy}
          onClick={() => send("POST", { documentId: doc })}
        >
          <Sparkles size={16} />
          {busy ? "Analyse…" : "Identifier les exercices"}
        </Button>
      </section>
      {exercises.length > 0 && (
        <select
          aria-label="Exercice"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setAnswer("");
            setHint(false);
            setSolution(false);
          }}
        >
          <option value="">Choisir un exercice</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      )}
      {current ? (
        <div className="grid xl:grid-cols-2 gap-6">
          <section className="panel p-6">
            <h2 className="font-semibold text-lg">{current.title}</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 mt-5">
              {current.statement}
            </p>
            {current.source.source_url && (
              <a
                className="text-xs text-emerald-700 mt-4 flex gap-2 items-center"
                href={current.source.source_url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={13} />
                {current.source.document_name}
              </a>
            )}
            <div className="flex flex-wrap gap-2 mt-7">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHint(!hint)}
              >
                <Lightbulb size={14} />
                Un indice
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSolution(!solution)}
              >
                <Eye size={14} />
                Solution proposée
              </Button>
            </div>
            {hint && (
              <p className="bg-amber-500/5 p-4 rounded-xl text-sm leading-7 mt-4">
                {current.hint ?? "Aucun indice disponible."}
              </p>
            )}
            {solution && (
              <div className="bg-emerald-500/5 p-4 rounded-xl mt-4">
                <p className="label text-[9px] text-emerald-700 mb-3">
                  Proposition AI · à vérifier avec votre cours
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {current.solution ?? "Aucune solution disponible."}
                </p>
              </div>
            )}
          </section>
          <section className="panel overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] text-xs font-semibold flex justify-between">
              <span>Votre espace de travail</span>
              <span className="muted">{current.language}</span>
            </div>
            <Editor
              height="360px"
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              language={current.language}
              value={answer}
              onChange={(v) => setAnswer(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                padding: { top: 20 },
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
            <div className="p-4 border-t border-[var(--border)]">
              <p className="text-[10px] muted mb-4">
                Éditeur avec coloration syntaxique. Le code n’est pas exécuté.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!answer.trim() || busy}
                  onClick={() =>
                    send("PUT", {
                      exerciseId: current.id,
                      answer,
                      completed: false,
                    })
                  }
                >
                  Sauvegarder
                </Button>
                <Button
                  size="sm"
                  disabled={!answer.trim() || busy}
                  onClick={() =>
                    send("PUT", {
                      exerciseId: current.id,
                      answer,
                      completed: true,
                    })
                  }
                >
                  <Check size={13} />
                  Marquer terminé
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className="panel empty-pattern p-16 text-center">
          <Code2 size={36} className="muted mx-auto mb-5" />
          <h2 className="text-xl font-semibold">
            La compréhension vient aussi en pratiquant.
          </h2>
          <p className="muted text-sm mt-3">
            Choisissez un document TD / TP prêt pour retrouver ses exercices.
          </p>
        </section>
      )}
    </div>
  );
}
