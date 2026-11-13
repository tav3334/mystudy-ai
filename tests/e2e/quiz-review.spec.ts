import { test, expect } from "@playwright/test";
test.setTimeout(60000);
const originalId = "a226f211-c5e2-4c60-a6ab-c1407d35485e";
const retryId = "b226f211-c5e2-4c60-a6ab-c1407d35485e";
const attemptId = "c226f211-c5e2-4c60-a6ab-c1407d35485e";
const question = {
  id: "q1",
  statement: "Quel noyau utilisent les conteneurs ?",
  options: ["Le noyau hôte", "Un noyau par conteneur"],
  multiple: false,
  topic: "Docker",
};
async function setup(page: import("@playwright/test").Page, correct = false) {
  await page.route("**/api/quizzes/start", (route) =>
    route.fulfill({
      json: {
        quiz: { title: "QCM Docker", kind: "quiz", duration_minutes: null },
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
  await page.route("**/api/quizzes/submit", (route) =>
    route.fulfill({
      json: {
        score: correct ? 1 : 0,
        total: 1,
        grade20: correct ? 20 : 0,
        review: [
          {
            ...question,
            correct,
            selected: [correct ? 0 : 1],
            correctIndices: [0],
            explanation: "Les conteneurs partagent le noyau du système hôte.",
            difficulty: "Facile",
            source: {
              chunkId: originalId,
              quote: "Les conteneurs partagent le noyau du système hôte.",
              document_name: "Docker.pdf",
              source_url: "https://drive.google.com/file/d/course/view",
              page: 3,
              section: "Isolation",
            },
          },
        ],
      },
    }),
  );
  await page.goto("/qcm/" + originalId);
  await page.getByRole("button", { name: "Commencer ou reprendre" }).click();
  await page
    .getByLabel(correct ? "Le noyau hôte" : "Un noyau par conteneur", {
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Terminer et corriger" }).click();
}
test("reviews sources and starts a fresh targeted quiz on desktop and mobile", async ({
  page,
}) => {
  let body: unknown;
  await page.route("**/api/quizzes/retry", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: retryId, count: 1 } });
  });
  await setup(page);
  const source = page.getByRole("complementary", {
    name: "Source de la réponse",
  });
  await expect(source).toContainText("Docker.pdf");
  await expect(source).toContainText("Page / diapositive 3");
  await expect(source).toContainText("Isolation");
  await expect(source.getByRole("link")).toHaveAttribute(
    "href",
    "https://drive.google.com/file/d/course/view",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Revoir mes erreurs (1)", exact: true })
    .click();
  await expect(page).toHaveURL("/qcm/" + retryId);
  await expect(
    page.getByRole("button", { name: "Commencer ou reprendre" }),
  ).toBeVisible();
  expect(body).toEqual({ attemptId });
});
test("a perfect score offers no unnecessary error quiz", async ({ page }) => {
  await setup(page, true);
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Revoir mes erreurs/ }),
  ).toHaveCount(0);
});
test("retry failure leaves the correction and sources available", async ({
  page,
}) => {
  await page.route("**/api/quizzes/retry", (route) =>
    route.fulfill({
      status: 500,
      json: { error: "Reprise temporairement indisponible." },
    }),
  );
  await setup(page);
  const button = page.getByRole("button", {
    name: "Revoir mes erreurs (1)",
    exact: true,
  });
  await button.click();
  await expect(
    page.getByText("Reprise temporairement indisponible."),
  ).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(
    page.getByRole("complementary", { name: "Source de la réponse" }),
  ).toBeVisible();
});
