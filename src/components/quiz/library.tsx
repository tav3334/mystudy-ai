import { QuizLibraryList } from "./library-list";
import { supabase, checked } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
export async function QuizLibrary({ exam = false }: { exam?: boolean }) {
  if (!hasSupabase()) return null;
  const db = await supabase();
  const [savedResult, activeResult, moduleResult] = await Promise.all([
    db
      .from("quizzes")
      .select("id,title,module_id,created_at,questions(count)")
      .eq("kind", exam ? "exam" : "quiz")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("exam_attempts")
      .select(
        "id,quiz_id,answers,started_at,quizzes!inner(id,title,kind,module_id,created_at,duration_minutes)",
      )
      .is("submitted_at", null)
      .eq("quizzes.kind", exam ? "exam" : "quiz")
      .order("started_at", { ascending: false })
      .limit(30),
    db.from("modules").select("id,name").order("name"),
  ]);
  const saved = checked(savedResult) ?? [];
  const active = checked(activeResult) ?? [];
  const activeIds = new Set(active.map((a) => a.quiz_id));
  const available = saved.filter((q) => !activeIds.has(q.id));
  if (!saved.length && !active.length) return null;
  const modules = checked(moduleResult) ?? [];
  const items = [
    ...active.map((a) => {
      const quiz = Array.isArray(a.quizzes) ? a.quizzes[0] : a.quizzes;
      return {
        id: a.quiz_id,
        title: quiz?.title ?? "Session enregistrée",
        moduleId: quiz?.module_id ?? null,
        createdAt: quiz?.created_at ?? a.started_at,
        count: 0,
        answered: Object.values(a.answers ?? {}).filter(
          (v) => Array.isArray(v) && v.length > 0,
        ).length,
      };
    }),
    ...available.map((q) => ({
      id: q.id,
      title: q.title,
      moduleId: q.module_id,
      createdAt: q.created_at,
      count: q.questions?.[0]?.count ?? 0,
      answered: null,
    })),
  ];
  return <QuizLibraryList items={items} modules={modules} exam={exam} />;
}
