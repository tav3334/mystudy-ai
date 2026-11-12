import { loadData } from "@/lib/data";
import { hasSupabase } from "@/lib/env";
import { supabase, checked } from "@/lib/supabase/server";
import { Analytics } from "@/components/analytics";
import { PageHeading } from "@/components/page-heading";
export default async function Stats() {
  const data = await loadData();
  const db = hasSupabase() ? await supabase() : null;
  const [topics, sessions, exercises] = db
    ? await Promise.all([
        db.from("learning_progress").select("topic,correct,total"),
        db.from("study_sessions").select("duration_seconds,created_at"),
        db
          .from("exercise_attempts")
          .select("exercise_id")
          .eq("completed", true),
      ])
    : [];
  return (
    <>
      <PageHeading
        eyebrow="Voir le chemin parcouru"
        title="Ma progression"
        description="Des repères concrets pour reconnaître vos acquis et orienter vos prochaines révisions."
      />
      <Analytics
        data={data}
        topics={topics ? (checked(topics) ?? []) : []}
        sessions={sessions ? (checked(sessions) ?? []) : []}
        exerciseCount={
          new Set(
            exercises ? checked(exercises)?.map((e) => e.exercise_id) : [],
          ).size
        }
      />
    </>
  );
}
