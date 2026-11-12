"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  ArrowUp,
  BookOpen,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { StudyData } from "@/lib/data";
import type { SourceChunk } from "@/lib/ai/schemas";
import { Button } from "@/components/ui/button";
type Reply = {
  question: string;
  answer: string;
  generalKnowledge?: string;
  sources: (SourceChunk & { quote: string })[];
};
export function Tutor({ data }: { data: StudyData }) {
  const params = useSearchParams();
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const [language, setLanguage] = useState("Français");
  const [module, setModule] = useState("");
  const [supplement, setSupplement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          language,
          moduleId: module || undefined,
          supplement,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setReplies((prev) => [...prev, { question, ...result }]);
      setQuestion("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réponse indisponible");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid xl:grid-cols-[1fr_260px] gap-6">
      <section className="panel flex flex-col min-h-[570px]">
        <div className="p-4 border-b border-[var(--border)] flex flex-wrap gap-3 items-center">
          <span className="flex gap-2 font-semibold text-xs mr-auto">
            <span className="size-2 bg-emerald-500 rounded-full mt-1" />
            Assistant pédagogique
          </span>
          <select
            aria-label="Langue des explications"
            className="!w-auto !text-xs !py-2"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {["Français", "Darija", "العربية", "English"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div aria-live="polite" className="flex-1 p-5 md:p-7 space-y-7">
          {!replies.length && (
            <div className="text-center py-14">
              <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-700 mx-auto grid place-items-center mb-5">
                <Sparkles size={27} />
              </div>
              <h2 className="text-xl font-semibold">
                Comprendre, avant de mémoriser.
              </h2>
              <p className="muted text-sm mt-3 max-w-md mx-auto leading-6">
                Posez une question à vos cours. Retrouvez des explications et
                les passages qui les justifient.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-7">
                {[
                  "Résume ce chapitre",
                  "Explique avec un exemple",
                  "Explique en Darija",
                ].map((q) => (
                  <button
                    key={q}
                    className="text-xs rounded-full border border-[var(--border)] px-4 py-2 hover:bg-[var(--muted)]"
                    onClick={() => {
                      setQuestion(q);
                      if (q.includes("Darija")) setLanguage("Darija");
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {replies.map((r, i) => (
            <article key={i} className="space-y-4">
              <p className="ml-auto max-w-[85%] bg-[var(--muted)] rounded-xl p-4 text-sm">
                {r.question}
              </p>
              <div
                className="text-sm whitespace-pre-wrap leading-7"
                dir={language === "العربية" ? "rtl" : undefined}
              >
                {r.answer}
              </div>
              {r.generalKnowledge && (
                <div className="border-l-2 border-amber-500 pl-4 text-sm leading-7 whitespace-pre-wrap">
                  <p className="label text-amber-600 text-[9px]">
                    Complément de connaissances générales
                  </p>
                  {r.generalKnowledge}
                </div>
              )}
              {r.sources.map((s, j) => (
                <a
                  key={j}
                  href={s.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-[var(--border)] rounded-lg p-3 text-xs"
                >
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex gap-2 items-center">
                    <BookOpen size={13} />
                    {s.document_name}
                    {s.page ? ` · Page / diapositive ${s.page}` : ""}
                    <ExternalLink size={12} />
                  </span>
                  <p className="muted mt-2">{s.section}</p>
                  <q className="muted block mt-1 leading-5">{s.quote}</q>
                </a>
              ))}
            </article>
          ))}
          {busy && (
            <p className="muted text-xs flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin" />
              Je recherche dans vos documents…
            </p>
          )}
        </div>
        <form onSubmit={ask} className="p-4 border-t border-[var(--border)]">
          <div className="relative">
            <textarea
              aria-label="Votre question"
              required
              minLength={3}
              maxLength={3000}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Qu’aimeriez-vous comprendre aujourd’hui ?"
              className="resize-none !pr-16"
            />
            <Button
              type="submit"
              aria-label="Envoyer la question"
              size="icon"
              className="absolute right-2 bottom-3"
              disabled={busy || !data.configured}
            >
              <ArrowUp size={18} />
            </Button>
          </div>
          <p className="text-[10px] muted mt-2 text-center">
            L’AI peut se tromper. Consultez les sources pour vérifier les
            explications.
          </p>
        </form>
      </section>
      <aside className="space-y-5">
        <section className="panel p-5">
          <h2 className="font-semibold text-sm">Contexte de révision</h2>
          <label className="block mt-5 text-xs muted">
            Module
            <select
              className="mt-2 !text-xs"
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              <option value="">Tous mes modules</option>
              {data.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-3 text-xs mt-5 leading-5">
            <input
              className="!w-4 mt-1 accent-emerald-700"
              type="checkbox"
              checked={supplement}
              onChange={(e) => setSupplement(e.target.checked)}
            />
            <span>
              Autoriser les connaissances générales
              <p className="muted mt-1">
                Les compléments seront signalés séparément.
              </p>
            </span>
          </label>
        </section>
        <section className="p-5">
          <p className="label muted text-[10px]">Pour mieux apprendre</p>
          <p className="text-xs muted leading-6 mt-3">
            Demandez un exemple concret, une comparaison ou une explication plus
            simple. Vous pouvez aussi passer en Darija.
          </p>
        </section>
      </aside>
    </div>
  );
}
