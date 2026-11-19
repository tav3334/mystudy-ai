import { test, expect } from "@playwright/test";
test.setTimeout(60000);
const quizId = "a226f211-c5e2-4c60-a6ab-c1407d35485e",
  attemptId = "b226f211-c5e2-4c60-a6ab-c1407d35485e",
  questionId = "c226f211-c5e2-4c60-a6ab-c1407d35485e";
const question = {
  id: questionId,
  statement: "Que partagent les conteneurs Docker ?",
  options: ["Le noyau hôte", "Un noyau indépendant"],
  multiple: false,
  topic: "Docker",
};
test("training saves an answer before showing its correction and source", async ({
  page,
}) => {
  let saved: Record<string, number[]> = {};
  let corrections = 0;
  await page.route("**/api/quizzes/start", (route) =>
    route.fulfill({
      json: {
        quiz: { title: "Docker", kind: "quiz", duration_minutes: null },
        attempt: {
          id: attemptId,
          started_at: new Date().toISOString(),
          answers: {},
        },
        questions: [question],
      },
    }),
  );
  await page.route("**/api/quizzes/answer", (route) => {
    saved = route.request().postDataJSON().answers;
    return route.fulfill({ json: { saved: true } });
  });
  await page.route("**/api/quizzes/feedback", (route) => {
    corrections++;
    expect(saved[questionId]).toEqual([1]);
    expect(route.request().postDataJSON()).toEqual({ attemptId, questionId });
    return route.fulfill({
      json: {
        correct: false,
        correctIndices: [0],
        explanation: "Les conteneurs partagent le noyau du système hôte.",
        source: {
          quote: "Les conteneurs partagent le noyau du système hôte.",
          document_name: "Docker.pdf",
          source_url: "https://drive.google.com/file/d/course/view",
          page: 3,
        },
      },
    });
  });
  await page.goto("/qcm/" + quizId);
  await page.getByRole("button", { name: "Commencer ou reprendre" }).click();
  await expect(
    page.getByRole("button", { name: "Vérifier ma réponse" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Mode entraînement : correction après chaque réponse")
    .check();
  await expect(
    page.getByRole("button", { name: "Vérifier ma réponse" }),
  ).toBeDisabled();
  await page.getByLabel("Un noyau indépendant", { exact: true }).check();
  await page.getByRole("button", { name: "Vérifier ma réponse" }).click();
  await expect(
    page.getByText("Bonne réponse : Le noyau hôte", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Source de la réponse" }),
  ).toContainText("Docker.pdf");
  await expect(
    page.getByLabel("Un noyau indépendant", { exact: true }),
  ).toBeDisabled();
  expect(corrections).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("exams keep feedback hidden until final submission", async ({ page }) => {
  await page.route("**/api/quizzes/start", (route) =>
    route.fulfill({
      json: {
        quiz: { title: "Examen Docker", kind: "exam", duration_minutes: 30 },
        attempt: {
          id: attemptId,
          started_at: new Date().toISOString(),
          answers: {},
        },
        questions: [question],
      },
    }),
  );
  await page.route("**/api/quizzes/answer", (route) =>
    route.fulfill({ json: { saved: true } }),
  );
  await page.goto("/qcm/" + quizId);
  await page.getByRole("button", { name: "Commencer ou reprendre" }).click();
  await expect(
    page.getByLabel("Mode entraînement : correction après chaque réponse"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Vérifier ma réponse" }),
  ).toHaveCount(0);
});
