"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuizSource } from "./source";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Timer,
  RotateCcw,
  Printer,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Question } from "@/lib/ai/schemas";
type Playing = {
  quiz: { title: string; kind: string; duration_minutes: number };
  attempt: {
    id: string;
    started_at: string;
    answers: Record<string, number[]>;
  };
  questions: {
    id: string;
    statement: string;
    options: string[];
    multiple: boolean;
    topic: string;
  }[];
};
type Result = {
  score: number;
  total: number;
  grade20: number;
  review: (Question & {
    id: string;
    selected: number[];
    correct: boolean;
    source: Question["source"] & {
      document_name: string;
      source_url: string;
      page: number | null;
      section: string | null;
    };
  })[];
};
export function QuizPlayer({
  quizId,
  initialReview,
}: {
  quizId: string;
  initialReview?: { game: Playing; result: Result };
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [game, setGame] = useState<Playing | null>(initialReview?.game ?? null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<Result | null>(
    initialReview?.result ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const submitting = useRef(false);
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  }, [answers]);
  const submit = useCallback(async () => {
    if (!game || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/quizzes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: game.attempt.id,
          answers: latest.current,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }, [game]);
  useEffect(() => {
    if (!game || game.quiz.kind !== "exam" || result) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil(
          (new Date(game.attempt.started_at).getTime() +
            game.quiz.duration_minutes * 60000 -
            Date.now()) /
            1000,
        ),
      );
      setSeconds(left);
      if (left === 0) void submit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game, result, submit]);
  useEffect(() => {
    if (!game || result) return;
    const abort = new AbortController();
    const id = setTimeout(async () => {
      setSaved("Enregistrement…");
      try {
        const r = await fetch("/api/quizzes/answer", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: game.attempt.id, answers }),
          signal: abort.signal,
        });
        setSaved(r.ok ? "Réponses sauvegardées" : "Sauvegarde indisponible");
      } catch {
        if (!abort.signal.aborted)
          setSaved("Hors connexion : gardez cette page ouverte");
      }
    }, 350);
    return () => {
      clearTimeout(id);
      abort.abort();
    };
  }, [answers, game, result]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quizzes/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAnswers(d.attempt.answers);
      setGame(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Session indisponible");
    } finally {
      setBusy(false);
    }
  }
  async function retryMistakes() {
    if (!game || retrying) return;
    setRetrying(true);
    try {
      const response = await fetch("/api/quizzes/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: game.attempt.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push("/qcm/" + data.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de préparer vos erreurs.",
      );
    } finally {
      setRetrying(false);
    }
  }
  if (!game)
    return (
      <section className="panel p-12 text-center max-w-2xl mx-auto">
        <Timer className="text-emerald-600 mx-auto mb-5" size={36} />
        <h1 className="text-2xl font-semibold">Prêt à tester vos acquis ?</h1>
        <p className="muted mt-4 leading-7">
          Votre progression est sauvegardée pendant la session. Pour un examen
          blanc, le chronomètre démarre dès que vous commencez et continue si
          vous quittez la page.
        </p>
        {error && (
          <p role="alert" className="text-red-600 mt-4">
            {error}
          </p>
        )}
        <Button onClick={start} disabled={busy} className="mt-7">
          {busy ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          Commencer ou reprendre
        </Button>
      </section>
    );
  if (result)
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="panel text-center p-8">
          <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto mb-4 grid place-items-center">
            <Check size={28} />
          </div>
          <h1 className="text-2xl font-semibold">Une étape de plus.</h1>
          <p className="muted mt-2">Votre résultat a été enregistré.</p>
          <p className="text-5xl font-semibold mt-6 text-emerald-700 dark:text-emerald-400">
            {game.quiz.kind === "exam"
              ? `${result.grade20}/20`
              : `${Math.round((result.score / result.total) * 100)}%`}
          </p>
          <p className="muted text-sm mt-3">
            {result.score} bonnes réponses sur {result.total}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6 no-print">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={15} />
              Imprimer / PDF
            </Button>
            {result.review.some((q) => !q.correct) && (
              <Button
                variant="outline"
                disabled={retrying}
                onClick={retryMistakes}
              >
                {retrying ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <RotateCcw size={15} />
                )}
                Revoir mes erreurs (
                {result.review.filter((q) => !q.correct).length})
              </Button>
            )}
            <Button asChild>
              <Link href="/qcm">Nouveau QCM</Link>
            </Button>
          </div>
        </section>
        {result.review.some((q) => !q.correct) && (
          <p className="muted text-sm text-center no-print">
            Reprenez les questions ratées ou sans réponse. Aucun quota AI
            utilisé.
          </p>
        )}
        <h2 className="font-semibold text-xl">Comprendre mes réponses</h2>
        {result.review.map((q, i) => (
          <article className="panel p-6 space-y-4" key={q.id}>
            <p
              className={`text-xs font-semibold ${q.correct ? "text-emerald-700" : "text-red-600"}`}
            >
              Question {i + 1} · {q.correct ? "Bonne réponse" : "À revoir"} ·{" "}
              {q.topic}
            </p>
            <h3 className="font-semibold leading-7">{q.statement}</h3>
            <div className="space-y-2">
              {q.options.map((o, j) => (
                <p
                  className={`p-3 rounded-lg text-sm border ${q.correctIndices.includes(j) ? "border-emerald-600/40 bg-emerald-500/5" : q.selected.includes(j) ? "border-red-600/30 bg-red-500/5" : "border-[var(--border)]"}`}
                  key={j}
                >
                  {String.fromCharCode(65 + j)}. {o}
                  {q.correctIndices.includes(j) && " ✓"}
                  {q.selected.includes(j) && " · Votre réponse"}
                </p>
              ))}
            </div>
            <p className="text-sm leading-7 muted">{q.explanation}</p>
            <QuizSource source={q.source} />
          </article>
        ))}
      </div>
    );
  const q = game.questions[index];
  if (!q) return <p>Aucune question disponible.</p>;
  const selected = answers[q.id] ?? [];
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <Link href="/qcm" className="muted flex gap-2 text-xs">
          <ArrowLeft size={14} />
          Mes QCM
        </Link>
        {seconds !== null && (
          <span
            className={`font-mono text-sm flex gap-2 ${seconds < 60 ? "text-red-600" : "muted"}`}
          >
            <Timer size={17} />
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <section className="panel p-6 md:p-9">
        <div className="flex justify-between text-xs muted">
          <span>
            Question {index + 1} sur {game.questions.length}
          </span>
          <span>
            {Object.keys(answers).filter((k) => answers[k].length).length}{" "}
            réponses
          </span>
        </div>
        <div className="h-1.5 bg-[var(--muted)] rounded-full mt-4">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all"
            style={{ width: `${((index + 1) / game.questions.length) * 100}%` }}
          />
        </div>
        <p className="label text-emerald-700 text-[10px] mt-8">{q.topic}</p>
        <h1 className="text-xl font-semibold leading-8 mt-3">{q.statement}</h1>
        <p className="text-xs muted mt-3">
          {q.multiple
            ? "Sélectionnez toutes les bonnes réponses."
            : "Sélectionnez une seule réponse."}
        </p>
        <fieldset className="mt-7 space-y-3">
          <legend className="sr-only">Vos réponses</legend>
          {q.options.map((option, i) => (
            <label
              key={`${q.id}-${i}`}
              className={`p-4 flex gap-3 items-start rounded-xl border cursor-pointer transition-colors ${selected.includes(i) ? "border-emerald-600 bg-emerald-500/5" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
            >
              <input
                className="!w-4 mt-1 accent-emerald-700"
                name={q.id}
                type={q.multiple ? "checkbox" : "radio"}
                checked={selected.includes(i)}
                onChange={() =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]: q.multiple
                      ? selected.includes(i)
                        ? selected.filter((j) => j !== i)
                        : [...selected, i]
                      : [i],
                  }))
                }
              />
              <span className="text-sm leading-6">{option}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex justify-between mt-8 gap-3">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ArrowLeft size={15} />
            Précédent
          </Button>
          {index < game.questions.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)}>
              Suivant
              <ArrowRight size={15} />
            </Button>
          ) : (
            <Button disabled={busy} onClick={submit}>
              {busy ? "Enregistrement…" : "Terminer et corriger"}
              <Check size={15} />
            </Button>
          )}
        </div>
        <p aria-live="polite" className="text-[10px] muted text-center mt-5">
          {saved}
        </p>
      </section>
    </div>
  );
}
