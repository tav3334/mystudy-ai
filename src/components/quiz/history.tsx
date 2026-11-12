import Link from "next/link";
import { supabase, checked } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
export async function QuizHistory({ exam = false }: { exam?: boolean }) {
  if (!hasSupabase()) return null;
  const db = await supabase();
  const rows =
    checked(
      await db
        .from("quiz_attempts")
        .select("id,run_id,score,total,completed_at,quizzes!inner(title,kind)")
        .eq("quizzes.kind", exam ? "exam" : "quiz")
        .order("completed_at", { ascending: false })
        .limit(20),
    ) ?? [];
  if (!rows.length) return null;
  return (
    <section className="panel p-6 mt-6">
      <h2 className="font-semibold mb-4">Mes résultats enregistrés</h2>
      <div className="divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <Link
            key={row.id}
            className="flex items-center gap-3 py-4 text-sm"
            href={`/qcm/resultats/${row.run_id}`}
          >
            <div className="flex-1">
              <p className="font-semibold">
                {
                  (Array.isArray(row.quizzes) ? row.quizzes[0] : row.quizzes)
                    ?.title
                }
              </p>
              <p className="text-xs muted mt-1">
                {new Date(row.completed_at).toLocaleDateString("fr-FR")} ·
                Revoir la correction
              </p>
            </div>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {exam
                ? `${Math.round(((20 * row.score) / row.total) * 100) / 100}/20`
                : `${row.score}/${row.total}`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
