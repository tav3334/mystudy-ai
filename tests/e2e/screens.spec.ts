import { test, expect } from "@playwright/test";
test("all study screens render without runtime errors", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "/",
    "/modules",
    "/documents",
    "/qcm",
    "/examens",
    "/pratique",
    "/flashcards",
    "/planning",
    "/statistiques",
    "/parametres",
    "/login",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow on ${route}`,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.goto("/");
  await expect(page.locator("main > div").first()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `artifacts/dashboard-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});
test("job endpoint requires a server credential", async ({ request }) => {
  const r = await request.get("/api/jobs");
  expect(r.status()).toBe(401);
});

test("QCM endpoint rejects cross-site submissions", async ({ request }) => {
  const r = await request.post("/api/quizzes/generate", {
    headers: { Origin: "https://foreign-site.example" },
    data: {},
  });
  expect(r.status()).toBe(403);
  expect((await r.json()).error).toContain("Origine");
});
