import { QuizHistory } from "@/components/quiz/history";
import Link from "next/link";
import { loadData } from "@/lib/data";
import { hasSupabase } from "@/lib/env";
import { supabase, checked } from "@/lib/supabase/server";
import { PageHeading } from "@/components/page-heading";
import { QuizGenerator } from "@/components/quiz/generator";
export default async function Quizzes() {
  const data = await loadData();
  const history = hasSupabase()
    ? checked(
        await (
          await supabase()
        )
          .from("quizzes")
          .select("id,title,created_at")
          .eq("kind", "quiz")
          .order("created_at", { ascending: false })
          .limit(10),
      )
    : [];
  return (
    <>
      <PageHeading
        eyebrow="Faire le point, progresser"
        title="Mes QCM"
        description="Transformez vos cours en questions ciblées. Comprenez chaque erreur, consolidez chaque acquis."
      />
      <QuizGenerator data={data} />
      <QuizHistory />
      {!!history?.length && (
        <section className="panel p-6 mt-6">
          <h2 className="font-semibold mb-4">QCM enregistrés</h2>
          {history.map((q) => (
            <Link
              className="block border-t border-[var(--border)] py-4 text-sm text-emerald-700 dark:text-emerald-400"
              href={`/qcm/${q.id}`}
              key={q.id}
            >
              {q.title}
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
