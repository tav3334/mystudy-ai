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
  await page.getByRole("link", { name: "Mes modules", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mes modules", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("theme switch and tutor controls", async ({ page }) => {
  await page.goto("/revision");
  await page.getByRole("button", { name: "Changer le thème" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Révision AI", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Langue des explications").selectOption("Darija");
  await page
    .getByLabel("Votre question")
    .fill("Explique les conteneurs Docker");
  await expect(page.getByLabel("Envoyer la question")).toBeDisabled();
});
