"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
export type SavedQuiz = {
  id: string;
  title: string;
  moduleId: string | null;
  createdAt: string;
  count: number;
  answered: number | null;
};
export function QuizLibraryList({
  items,
  modules,
  exam = false,
}: {
  items: SavedQuiz[];
  modules: { id: string; name: string }[];
  exam?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [busy, setBusy] = useState(false);
  const visible = items.filter(
    (q) =>
      (!module || (module === "none" ? !q.moduleId : q.moduleId === module)) &&
      q.title
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase()
        .includes(
          search.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase(),
        ),
  );
  async function save(q: SavedQuiz) {
    setBusy(true);
    try {
      const r = await fetch("/api/quizzes/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: q.id,
          title,
          moduleId: moduleId || null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setEditing(null);
      toast.success("Questionnaire mis à jour.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(q: SavedQuiz) {
    setBusy(true);
    try {
      const r = await fetch("/api/quizzes/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: q.id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setRemoving(null);
      toast.success("Questionnaire supprimé.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }
  function group(active: boolean) {
    const rows = visible.filter((q) => (q.answered !== null) === active);
    if (!rows.length) return null;
    return (
      <section
        className="panel p-5 md:p-6"
        aria-label={
          active
            ? "Sessions à reprendre"
            : exam
              ? "Examens enregistrés"
              : "QCM enregistrés"
        }
      >
        <h2 className="font-semibold">
          {active
            ? "À reprendre"
            : exam
              ? "Mes examens enregistrés"
              : "Mes QCM enregistrés"}
        </h2>
        <p className="text-xs muted mt-2">
          {active
            ? "Vos questions et réponses sont enregistrées. Aucun besoin de générer à nouveau."
            : "Ouvrez un questionnaire existant sans consommer de quota AI."}
        </p>
        <div className="divide-y divide-[var(--border)] mt-3">
          {rows.map((q) => (
            <article key={q.id} className="py-4 space-y-3">
              {editing === q.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(q);
                  }}
                  className="space-y-3"
                >
                  <label className="block text-xs space-y-2">
                    <span>Nouveau titre</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      maxLength={250}
                      disabled={busy}
                    />
                  </label>
                  <label className="block text-xs space-y-2">
                    <span>Classer dans un module</span>
                    <select
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Sans module</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy}>
                      Enregistrer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-3 items-center">
                  <Link href={"/qcm/" + q.id} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm break-words">
                      {q.title}
                    </p>
                    <p className="text-xs muted mt-1">
                      {modules.find((m) => m.id === q.moduleId)?.name ??
                        "Sans module"}{" "}
                      ·{" "}
                      {q.answered !== null
                        ? q.answered +
                          " réponse" +
                          (q.answered > 1 ? "s" : "") +
                          " enregistrée" +
                          (q.answered > 1 ? "s" : "")
                        : q.count +
                          " questions · Créé le " +
                          new Date(q.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                    {active && (
                      <p className="text-xs muted mt-1">
                        {exam
                          ? "Le chronomètre continue pendant votre absence"
                          : "Reprenez quand vous voulez"}
                      </p>
                    )}
                  </Link>
                  <Button asChild size="sm">
                    <Link href={"/qcm/" + q.id}>
                      {active ? "Reprendre" : "Ouvrir"}
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRemoving(null);
                      setEditing(q.id);
                      setTitle(q.title);
                      setModuleId(q.moduleId ?? "");
                    }}
                  >
                    Renommer / classer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setRemoving(q.id);
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              )}
              {removing === q.id && (
                <div
                  role="alert"
                  className="border border-red-500/30 rounded-lg p-4 space-y-3"
                >
                  <p className="text-sm">
                    Supprimer « {q.title} » ? Ses questions, réponses et
                    résultats seront supprimés définitivement. Vos documents
                    Google Drive sont conservés.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => remove(q)}>
                      Confirmer la suppression
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRemoving(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }
  return (
    <div className="mb-6 space-y-5">
      <div className="panel p-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs space-y-2">
          <span>Rechercher un questionnaire enregistré</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titre du QCM ou de l’examen…"
          />
        </label>
        <label className="text-xs space-y-2">
          <span>Filtrer par module</span>
          <select value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="">Tous les modules</option>
            <option value="none">Sans module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs muted md:col-span-2">
          Recherche parmi les questionnaires affichés, les plus récents en
          premier.
        </p>
      </div>
      {group(true)}
      {group(false)}
      {!visible.length && (
        <p className="panel p-6 text-sm muted">
          Aucun questionnaire ne correspond à cette recherche.
        </p>
      )}
    </div>
  );
}
