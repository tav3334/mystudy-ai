import { QuizHistory } from "@/components/quiz/history";
import { QuizLibrary } from "@/components/quiz/library";
import { loadData } from "@/lib/data";
import { PageHeading } from "@/components/page-heading";
import { QuizGenerator } from "@/components/quiz/generator";
export default async function Quizzes() {
  const data = await loadData();
  return (
    <>
      <PageHeading
        eyebrow="Faire le point, progresser"
        title="Mes QCM"
        description="Transformez vos cours en questions ciblées. Comprenez chaque erreur, consolidez chaque acquis."
      />
      <QuizLibrary />
      <QuizGenerator data={data} />
      <QuizHistory />
    </>
  );
}
