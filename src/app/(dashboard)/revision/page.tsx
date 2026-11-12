import { Suspense } from "react";
import { PageHeading } from "@/components/page-heading";
import { Tutor } from "@/components/ai/tutor";
import { loadData } from "@/lib/data";
export default async function Revision() {
  return (
    <>
      <PageHeading
        eyebrow="Apprendre avec vos propres cours"
        title="Révision AI"
        description="Un concept difficile ? Prenez le temps de le comprendre, avec des réponses sourcées."
      />
      <Suspense>
        <Tutor data={await loadData()} />
      </Suspense>
    </>
  );
}
