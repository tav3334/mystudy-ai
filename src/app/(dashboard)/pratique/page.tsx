import { loadData } from "@/lib/data";
import { hasSupabase } from "@/lib/env";
import { supabase, checked } from "@/lib/supabase/server";
import { Practice } from "@/components/practice";
import { PageHeading } from "@/components/page-heading";
export default async function Pratique() {
  const data = await loadData();
  const exercises = hasSupabase()
    ? (checked(
        await (await supabase()).from("exercises").select("*").order("title"),
      ) ?? [])
    : [];
  return (
    <>
      <PageHeading
        eyebrow="Passer de la théorie à la pratique"
        title="TD / TP"
        description="Un exercice, une tentative, un déclic. Travaillez vos solutions dans un espace dédié."
      />
      <Practice data={data} exercises={exercises} />
    </>
  );
}
