"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, RotateCcw, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { StudyData } from "@/lib/data";
export function Flashcards({ data }: { data: StudyData }) {
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const router = useRouter();
  const due = data.flashcards.filter(
    (c) => new Date(c.due_at) <= new Date() && !reviewed.includes(c.id),
  );
  const current = due[0];
  async function generate() {
    if (!doc) return;
    setBusy(true);
    try {
      const r = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(
        d.cached
          ? "Ces cartes existent déjà."
          : `${d.generated} cartes créées.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setBusy(false);
    }
  }
  async function rate(rating: number) {
    setBusy(true);
    try {
      const r = await fetch("/api/flashcards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: current.id, rating }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setReviewed([...reviewed, current.id]);
      setFlipped(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="panel p-5 flex flex-col sm:flex-row gap-3">
        <select
          aria-label="Document pour les flashcards"
          value={doc}
          onChange={(e) => setDoc(e.target.value)}
        >
          <option value="">Choisir un document indexé</option>
          {data.documents
            .filter((d) => d.status === "ready")
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
        <Button onClick={generate} disabled={!doc || busy}>
          <Sparkles size={16} />
          {busy ? "Chargement…" : "Créer des flashcards"}
        </Button>
      </section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "À revoir aujourd’hui", n: due.length },
          {
            label: "Nouvelles",
            n: data.flashcards.filter((c) => c.repetitions === 0).length,
          },
          {
            label: "En apprentissage",
            n: data.flashcards.filter(
              (c) => c.repetitions > 0 && c.interval_days < 21,
            ).length,
          },
          {
            label: "Bien ancrées",
            n: data.flashcards.filter((c) => c.interval_days >= 21).length,
          },
        ].map((x) => (
          <div className="panel p-5" key={x.label}>
            <p className="muted text-xs">{x.label}</p>
            <p className="text-3xl mt-3 font-semibold">{x.n}</p>
          </div>
        ))}
      </div>
      {current ? (
        <section className="max-w-3xl mx-auto py-5">
          <p className="text-center text-xs muted mb-4">
            {due.length} carte(s) dans votre file du jour
          </p>
          <button
            onClick={() => setFlipped(!flipped)}
            aria-label={flipped ? "Afficher la question" : "Révéler la réponse"}
            className="panel w-full min-h-72 p-9 text-center hover:border-emerald-500/50"
          >
            <p className="label text-[10px] text-emerald-700 mb-7">
              {flipped ? "Réponse" : "Question"} · {current.difficulty}
            </p>
            <p className="text-xl leading-8 font-medium">
              {flipped ? current.answer : current.question}
            </p>
            {flipped && (
              <p className="muted text-sm leading-7 mt-5">
                {current.explanation}
              </p>
            )}
            <p className="text-xs muted mt-8 flex items-center justify-center gap-2">
              <RotateCcw size={13} />
              Cliquer pour retourner
            </p>
          </button>
          {flipped && (
            <div className="mt-5">
              <p className="muted text-xs text-center mb-3">
                Comment était votre rappel ?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: "À reprendre", rating: 1 },
                  { name: "Difficile", rating: 3 },
                  { name: "Bien", rating: 4 },
                  { name: "Facile", rating: 5 },
                ].map((x) => (
                  <Button
                    key={x.rating}
                    variant="outline"
                    disabled={busy}
                    onClick={() => rate(x.rating)}
                  >
                    {x.name}
                  </Button>
                ))}
              </div>
              {current.source?.source_url && (
                <a
                  className="text-xs text-emerald-700 mt-5 flex justify-center items-center gap-2"
                  href={current.source.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={13} />
                  Consulter le cours
                </a>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="panel empty-pattern p-16 text-center">
          <Layers size={35} className="muted mx-auto mb-5" />
          <h2 className="text-xl font-semibold">
            {data.flashcards.length
              ? "Vous êtes à jour."
              : "Les petites révisions font les grands progrès."}
          </h2>
          <p className="muted text-sm mt-3">
            {data.flashcards.length
              ? "Vos prochaines cartes apparaîtront à leur date de révision."
              : "Créez vos premières cartes à partir d’un cours indexé."}
          </p>
        </section>
      )}
      <p className="text-xs muted text-center">
        Répétition espacée SM-2 · Les dates de révision dépendent de vos
        évaluations.
      </p>
    </div>
  );
}
