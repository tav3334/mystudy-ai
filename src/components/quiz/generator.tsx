"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Sparkles, FileText, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyData } from "@/lib/data";
type Fields = {
  chapter: string;
  count: number;
  difficulty: string;
  language: string;
  questionType: string;
  duration: number;
};
export function QuizGenerator({
  data,
  exam = false,
}: {
  data: StudyData;
  exam?: boolean;
}) {
  const [module, setModule] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { register, handleSubmit } = useForm<Fields>({
    defaultValues: {
      chapter: "",
      count: 10,
      difficulty: "Mixte",
      language: "Français",
      questionType: "single",
      duration: 30,
    },
  });
  const docs = data.documents.filter(
    (d) => d.status === "ready" && (!module || d.module_id === module),
  );
  async function generate(values: Fields) {
    if (!selected.length) {
      toast.error("Sélectionnez au moins un document prêt.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          moduleId: module || undefined,
          documentIds: selected,
          kind: exam ? "exam" : "quiz",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/qcm/${d.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={handleSubmit(generate)}
      className="grid xl:grid-cols-[1.4fr_1fr] gap-6"
    >
      <section className="panel p-6 space-y-5">
        <h2 className="font-semibold">1. Choisissez vos sources</h2>
        <label className="block text-xs space-y-2">
          <span>Module</span>
          <select
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">Tous les modules</option>
            {data.modules.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs space-y-2">
          <span>
            Chapitre ou sujet <span className="muted">(facultatif)</span>
          </span>
          <input
            {...register("chapter")}
            maxLength={300}
            placeholder="Ex. Les réseaux Docker"
          />
        </label>
        <div className="border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="bg-[var(--background)] p-3 text-[10px] muted uppercase tracking-wide">
            Documents prêts · {selected.length} sélectionné(s)
          </div>
          {docs.length ? (
            docs.map((d) => (
              <label
                key={d.id}
                className="p-4 border-t border-[var(--border)] flex gap-3 items-center text-xs"
              >
                <input
                  className="!w-4 accent-emerald-700"
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  disabled={!selected.includes(d.id) && selected.length >= 8}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, d.id]
                        : selected.filter((id) => id !== d.id),
                    )
                  }
                />
                <FileText size={16} className="text-emerald-700" />
                {d.name}
              </label>
            ))
          ) : (
            <div className="p-8 text-center">
              <FileText className="muted mx-auto mb-3" />
              <p className="text-xs muted leading-6">
                Vos cours sont préparés automatiquement après la
                synchronisation. Ils apparaîtront ici une fois prêts.
              </p>
            </div>
          )}
        </div>
        <p className="text-[11px] muted leading-5">
          Seuls les documents prêts sont disponibles. Les questions seront
          basées sur des extraits sélectionnés, avec leurs sources.
        </p>
      </section>
      <section className="panel p-6 space-y-5">
        <h2 className="font-semibold">
          2. Personnalisez votre {exam ? "examen" : "QCM"}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-xs space-y-2">
            <span>Difficulté</span>
            <select {...register("difficulty")}>
              {["Facile", "Moyen", "Difficile", "Mixte"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-xs space-y-2">
            <span>Questions</span>
            <input
              type="number"
              min={1}
              max={50}
              {...register("count", { valueAsNumber: true, min: 1, max: 50 })}
            />
          </label>
        </div>
        <label className="block text-xs space-y-2">
          <span>Type de question</span>
          <select {...register("questionType")}>
            <option value="single">Une seule bonne réponse</option>
            <option value="multiple">Plusieurs bonnes réponses</option>
            <option value="boolean">Vrai / Faux</option>
          </select>
        </label>
        <label className="block text-xs space-y-2">
          <span>Langue</span>
          <select {...register("language")}>
            {["Français", "Darija", "العربية", "English"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {exam && (
          <label className="block text-xs space-y-2">
            <span>Durée (minutes)</span>
            <input
              type="number"
              min={1}
              max={300}
              {...register("duration", { valueAsNumber: true })}
            />
          </label>
        )}
        <div className="bg-emerald-500/5 p-4 rounded-xl flex gap-3 text-emerald-800 dark:text-emerald-300">
          <ShieldCheck size={20} className="shrink-0" />
          <p className="text-xs leading-6">
            La qualité avant la quantité. Si vos sources ne suffisent pas, l’AI
            générera moins de questions.
          </p>
        </div>
        <Button
          className="w-full"
          disabled={busy || !data.configured || !selected.length}
        >
          {busy ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          {busy
            ? "Génération en cours…"
            : `Générer mon ${exam ? "examen" : "QCM"}`}
        </Button>
        <p className="text-[10px] muted text-center">
          Une génération utilise votre quota AI quotidien.
        </p>
      </section>
    </form>
  );
}
