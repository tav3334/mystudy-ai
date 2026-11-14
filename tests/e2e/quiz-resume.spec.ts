import { test, expect } from "@playwright/test";
test.setTimeout(60000);
const quizId = "a226f211-c5e2-4c60-a6ab-c1407d35485e";
const attemptId = "b226f211-c5e2-4c60-a6ab-c1407d35485e";
const questions = [
  {
    id: "q1",
    statement: "Quelle commande affiche les conteneurs ?",
    options: ["docker ps", "git log"],
    multiple: false,
    topic: "Docker",
  },
  {
    id: "q2",
    statement: "Quelle commande crée une image Docker ?",
    options: ["docker build", "git status"],
    multiple: false,
    topic: "Docker",
  },
];
test("save and leave preserves the latest answer and resumes the same quiz without generation", async ({
  page,
}) => {
  let saved: Record<string, number[]> = { q1: [0] };
  let generated = 0;
  let starts = 0;
  await page.route("**/api/quizzes/generate", (route) => {
    generated++;
    return route.fulfill({
      status: 500,
      json: { error: "Unexpected generation" },
    });
  });
  await page.route("**/api/quizzes/start", (route) => {
    starts++;
    return route.fulfill({
      json: {
        quiz: { title: "QCM Docker", kind: "quiz", duration_minutes: null },
        attempt: {
          id: attemptId,
          started_at: new Date().toISOString(),
          answers: saved,
        },
        questions,
      },
    });
  });
  await page.route("**/api/quizzes/answer", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.attemptId).toBe(attemptId);
    saved = body.answers;
    await route.fulfill({ json: { saved: true } });
  });
  await page.goto("/qcm/" + quizId);
  await page.getByRole("button", { name: "Commencer ou reprendre" }).click();
  await expect(
    page.getByText("Question 2 sur 2", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("docker build", { exact: true }).check();
  await page
    .getByRole("button", { name: "Enregistrer et quitter", exact: true })
    .click();
  await expect(page).toHaveURL(/\/qcm$/);
  expect(saved).toEqual({ q1: [0], q2: [0] });
  await page.goto("/qcm/" + quizId);
  await page.getByRole("button", { name: "Commencer ou reprendre" }).click();
  await expect(page.getByLabel("docker build", { exact: true })).toBeChecked();
  expect(starts).toBe(2);
  expect(generated).toBe(0);
});
test("failed save keeps the current questionnaire open", async ({ page }) => {
  await page.route("**/api/quizzes/start", (route) =>
    route.fulfill({
      json: {
        quiz: { title: "Docker", kind: "quiz", duration_minutes: null },
        attempt: {
          id: attemptId,
          started_at: new Date().toISOString(),
          answers: {},
        },
        questions,
      },
    }),
  );
  await page.route("**/api/quizzes/answer", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/qcm/" + quizId);
  await page.getByRole("button", { name: "Commencer ou reprendre" }).click();
  await page
    .getByRole("button", { name: "Enregistrer et quitter", exact: true })
    .click();
  await expect(
    page.getByText(
      "Sauvegarde indisponible. Gardez cette page ouverte et réessayez.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL("/qcm/" + quizId);
  await expect(
    page.getByRole("button", { name: "Enregistrer et quitter", exact: true }),
  ).toBeEnabled();
});
