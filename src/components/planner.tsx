"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, CalendarDays, Check, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyData } from "@/lib/data";
function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function Planner({ data }: { data: StudyData }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const router = useRouter();
  const today = localDate();
  async function mutate(method: string, body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/planning", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAdding(false);
      setEdit(null);
      router.refresh();
      toast.success("Planning mis à jour.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6">
      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Mes prochaines séances</h2>
          <Button
            onClick={() => setAdding(!adding)}
            size="sm"
            disabled={!data.configured}
          >
            <Plus size={14} />
            Ajouter une séance
          </Button>
        </div>
        {adding && (
          <form
            className="panel p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutate("POST", {
                title: f.get("title"),
                scheduledDate: f.get("date"),
                duration: Number(f.get("duration")),
                moduleId: f.get("module") || undefined,
                examDate: f.get("exam") || undefined,
              });
            }}
          >
            <label className="block space-y-2 text-xs">
              <span>Objectif de la séance</span>
              <input
                name="title"
                required
                minLength={3}
                maxLength={300}
                placeholder="Réviser le chapitre 2"
              />
            </label>
            <label className="block text-xs space-y-2">
              <span>Module</span>
              <select name="module">
                <option value="">Sans module</option>
                {data.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs space-y-2">
                <span>Date de révision</span>
                <input type="date" name="date" defaultValue={today} required />
              </label>
              <label className="text-xs space-y-2">
                <span>Durée (min)</span>
                <input
                  type="number"
                  name="duration"
                  defaultValue={30}
                  min={5}
                  max={480}
                  required
                />
              </label>
            </div>
            <label className="block text-xs space-y-2">
              <span>Date d’examen (facultatif)</span>
              <input name="exam" type="date" />
            </label>
            <Button disabled={busy}>Enregistrer la séance</Button>
          </form>
        )}
        {data.tasks.length ? (
          <div className="space-y-3">
            {data.tasks.map((t) => (
              <article key={t.id} className="panel p-4">
                {edit === t.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void mutate("PATCH", {
                        id: t.id,
                        title: f.get("title"),
                        scheduled_date: f.get("date"),
                        duration_minutes: Number(f.get("duration")),
                      });
                    }}
                    className="space-y-3"
                  >
                    <input
                      aria-label="Titre de la séance"
                      name="title"
                      defaultValue={t.title}
                      required
                      minLength={3}
                    />
                    <input
                      aria-label="Date de la séance"
                      name="date"
                      type="date"
                      defaultValue={t.scheduled_date}
                      required
                    />
                    <input
                      aria-label="Durée de la séance"
                      name="duration"
                      type="number"
                      defaultValue={t.duration_minutes}
                      min={5}
                      max={480}
                      required
                    />
                    <Button size="sm" disabled={busy}>
                      Enregistrer
                    </Button>
                  </form>
                ) : (
                  <div className="flex gap-3 items-center">
                    <button
                      aria-label={
                        t.completed ? "Marquer à faire" : "Marquer terminée"
                      }
                      onClick={() =>
                        mutate("PATCH", { id: t.id, completed: !t.completed })
                      }
                      disabled={busy}
                      className={`size-6 shrink-0 rounded-full border grid place-items-center ${t.completed ? "bg-emerald-600 border-emerald-600 text-white" : "border-[var(--border)]"}`}
                    >
                      {t.completed && <Check size={13} />}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold ${t.completed ? "line-through muted" : ""}`}
                      >
                        {t.title}
                      </p>
                      <p className="text-xs muted mt-1">
                        {new Date(
                          t.scheduled_date + "T12:00:00",
                        ).toLocaleDateString("fr-FR")}{" "}
                        · {t.duration_minutes} min
                        {!t.completed && t.scheduled_date < today
                          ? " · En retard"
                          : ""}
                      </p>
                      {t.exam_date && (
                        <p className="text-xs text-amber-600 mt-1">
                          Examen le{" "}
                          {new Date(
                            t.exam_date + "T12:00:00",
                          ).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    <button
                      aria-label="Modifier la séance"
                      onClick={() => setEdit(t.id)}
                    >
                      <Pencil size={14} className="muted" />
                    </button>
                    <button
                      aria-label="Supprimer la séance"
                      disabled={busy}
                      onClick={() => mutate("DELETE", { id: t.id })}
                    >
                      <Trash2 size={14} className="muted" />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <section className="panel p-14 text-center empty-pattern">
            <CalendarDays size={33} className="muted mx-auto mb-4" />
            <h3 className="font-semibold">Une intention devient une séance.</h3>
            <p className="text-xs muted mt-3 leading-6">
              Ajoutez un objectif, une date, un peu de temps.
              <br />
              Votre planning prend forme à votre rythme.
            </p>
          </section>
        )}
      </div>
      <aside className="space-y-5">
        <section className="panel p-6">
          <p className="label text-emerald-700 text-[10px]">
            Priorités suggérées
          </p>
          <h2 className="font-semibold mt-4">Commencer par l’essentiel</h2>
          <p className="muted text-xs leading-6 mt-3">
            {
              data.flashcards.filter((c) => new Date(c.due_at) <= new Date())
                .length
            }{" "}
            flashcards attendent votre révision.
          </p>
          {data.attempts.length > 0 ? (
            <p className="muted text-xs leading-6 mt-3">
              Consultez vos corrections de QCM pour choisir les notions à
              retravailler.
            </p>
          ) : (
            <p className="muted text-xs leading-6 mt-3">
              Après vos premiers QCM, vous pourrez repérer les notions qui
              demandent davantage de pratique.
            </p>
          )}
          <p className="text-[11px] muted mt-5 border-t border-[var(--border)] pt-4 leading-6">
            Les recommandations ne modifient jamais votre planning. Vous
            choisissez les séances à ajouter.
          </p>
        </section>
      </aside>
    </div>
  );
}
