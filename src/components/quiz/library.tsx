import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { supabase, checked } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
export async function QuizLibrary({ exam = false }: { exam?: boolean }) {
  if (!hasSupabase()) return null;
  const db = await supabase();
  const [savedResult, activeResult] = await Promise.all([
    db
      .from("quizzes")
      .select("id,title,created_at,questions(count)")
      .eq("kind", exam ? "exam" : "quiz")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("exam_attempts")
      .select(
        "id,quiz_id,answers,started_at,quizzes!inner(id,title,kind,duration_minutes)",
      )
      .is("submitted_at", null)
      .eq("quizzes.kind", exam ? "exam" : "quiz")
      .order("started_at", { ascending: false })
      .limit(30),
  ]);
  const saved = checked(savedResult) ?? [];
  const active = checked(activeResult) ?? [];
  const activeIds = new Set(active.map((a) => a.quiz_id));
  const available = saved.filter((q) => !activeIds.has(q.id));
  if (!saved.length && !active.length) return null;
  return (
    <div className="space-y-5 mb-6">
      {!!active.length && (
        <section
          className="panel p-5 md:p-6 border-emerald-600/30"
          aria-label="Sessions à reprendre"
        >
          <h2 className="font-semibold">À reprendre</h2>
          <p className="text-xs muted mt-2">
            Vos questions et réponses sont enregistrées. Aucun besoin de générer
            à nouveau.
          </p>
          <div className="divide-y divide-[var(--border)] mt-3">
            {active.map((a) => {
              const quiz = Array.isArray(a.quizzes) ? a.quizzes[0] : a.quizzes;
              const answered = Object.values(a.answers ?? {}).filter(
                (value) => Array.isArray(value) && value.length > 0,
              ).length;
              return (
                <Link
                  key={a.id}
                  href={"/qcm/" + a.quiz_id}
                  className="flex flex-wrap items-center gap-3 py-4 text-sm group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold break-words">
                      {quiz?.title ?? "Session enregistrée"}
                    </p>
                    <p className="text-xs muted mt-1">
                      {answered} réponse{answered > 1 ? "s" : ""} enregistrée
                      {answered > 1 ? "s" : ""}
                      {exam
                        ? " · Le chronomètre continue pendant votre absence"
                        : " · Reprenez quand vous voulez"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <Play size={15} />
                    Reprendre
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {!!available.length && (
        <section
          className="panel p-5 md:p-6"
          aria-label={exam ? "Examens enregistrés" : "QCM enregistrés"}
        >
          <h2 className="font-semibold">
            {exam ? "Mes examens enregistrés" : "Mes QCM enregistrés"}
          </h2>
          <p className="text-xs muted mt-2">
            Ouvrez un questionnaire existant sans consommer de quota AI.
          </p>
          <div className="divide-y divide-[var(--border)] mt-3">
            {available.map((q) => (
              <Link
                key={q.id}
                href={"/qcm/" + q.id}
                className="flex items-center gap-3 py-4 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold break-words">{q.title}</p>
                  <p className="text-xs muted mt-1">
                    {q.questions?.[0]?.count ?? 0} questions · Créé le{" "}
                    {new Date(q.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-2 font-semibold">
                  Ouvrir
                  <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
