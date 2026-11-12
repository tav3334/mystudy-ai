import { loadData } from "@/lib/data";
import { Flashcards } from "@/components/flashcards";
import { PageHeading } from "@/components/page-heading";
export default async function Cards() {
  return (
    <>
      <PageHeading
        eyebrow="Un peu chaque jour, pour longtemps"
        title="Mes flashcards"
        description="Ancrez l’essentiel avec des révisions espacées adaptées à votre mémoire."
      />
      <Flashcards data={await loadData()} />
    </>
  );
}
