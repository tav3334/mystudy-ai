import { loadData } from "@/lib/data";
import { Planner } from "@/components/planner";
import { PageHeading } from "@/components/page-heading";
export default async function Planning() {
  return (
    <>
      <PageHeading
        eyebrow="Donner du temps à vos objectifs"
        title="Mon planning"
        description="Planifiez des séances réalistes, gardez vos examens en vue et ajustez votre rythme."
      />
      <Planner data={await loadData()} />
    </>
  );
}
