import { QuizHistory } from "@/components/quiz/history";
import { loadData } from "@/lib/data";
import { PageHeading } from "@/components/page-heading";
import { QuizGenerator } from "@/components/quiz/generator";
export default async function Exams() {
  return (
    <>
      <PageHeading
        eyebrow="Se préparer en conditions réelles"
        title="Examens blancs"
        description="Un sujet chronométré, vos réponses sauvegardées et une correction détaillée sur 20. Première version : QCM, réponses multiples et vrai / faux."
      />
      <QuizGenerator data={await loadData()} exam />
      <QuizHistory exam />
    </>
  );
}
