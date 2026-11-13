import "server-only";
import { hasSupabase } from "@/lib/env";
import { supabase, checked } from "@/lib/supabase/server";
export type StudyData = Awaited<ReturnType<typeof loadData>>;
export async function loadData() {
  if (!hasSupabase())
    return {
      configured: false,
      email: null as string | null,
      modules: [],
      documents: [],
      attempts: [],
      tasks: [],
      flashcards: [],
      sync: null,
      connected: false,
      usage: 0,
    };
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return {
      configured: true,
      email: null,
      modules: [],
      documents: [],
      attempts: [],
      tasks: [],
      flashcards: [],
      sync: null,
      connected: false,
      usage: 0,
    };
  const [
    modules,
    documents,
    attempts,
    tasks,
    flashcards,
    sync,
    connection,
    usage,
  ] = await Promise.all([
    db.from("modules").select("*").eq("active", true).order("name"),
    db
      .from("documents")
      .select("*")
      .eq("active", true)
      .order("modified_at", { ascending: false }),
    db
      .from("quiz_attempts")
      .select("id,score,total,completed_at")
      .order("completed_at", { ascending: false })
      .limit(30),
    db.from("study_tasks").select("*").order("scheduled_date"),
    db.from("flashcards").select("*").order("due_at"),
    db
      .from("sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("drive_connections").select("user_id").maybeSingle(),
    db
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("operation", "generate")
      .gte("created_at", new Date().toISOString().slice(0, 10)),
  ]);
  return {
    configured: true,
    email: user.email ?? null,
    modules: checked(modules) ?? [],
    documents: checked(documents) ?? [],
    attempts: checked(attempts) ?? [],
    tasks: checked(tasks) ?? [],
    flashcards: checked(flashcards) ?? [],
    sync: checked(sync),
    connected: !!checked(connection),
    usage: usage.count ?? 0,
  };
}
