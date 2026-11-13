import { test, expect } from "@playwright/test";
test("honest empty dashboard and working navigation", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Chaque jour, un pas de plus ." }),
  ).toBeVisible();
  await expect(page.getByText("Vos modules vous attendent")).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(
    page.getByRole("link", { name: "Révision AI", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Mes modules", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mes modules", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("removed tutor redirects to QCM and theme remains usable", async ({
  page,
}) => {
  await page.goto("/revision");
  await expect(page).toHaveURL(/\/qcm$/);
  await expect(
    page.getByRole("heading", { name: "Mes QCM", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Changer le thème" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mes QCM", exact: true }),
  ).toBeVisible();
});
test("document library has no per-file indexing control", async ({ page }) => {
  await page.goto("/documents");
  await expect(
    page.getByRole("button", { name: "Indexer", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Mes documents", exact: true }),
  ).toBeVisible();
});
