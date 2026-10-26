import { test, expect } from "@playwright/test";
test("2D GOLA i push crtaju frontove bez klasičnih ručki", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova kuhinja", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj elemente" }).click();
  for (const name of ["Donji sa jednim vratima", "Fiokar sa 3 fioke"]) {
    await page
      .getByRole("button", { name: "Dodaj element", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Sačuvaj", exact: true })
      .click();
  }
  await expect(page.locator(".wall-elevation")).toBeVisible();
  await expect(page.locator(".technical-handle")).not.toHaveCount(0);
  for (const opening of ["GOLA", "Push"]) {
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Cena", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Promeni materijale i okove", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Otvaranje", exact: true })
      .getByRole("button", { name: opening, exact: true })
      .click();
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Kuhinja", exact: true })
      .click();
    await expect(page.locator(".wall-elevation")).toBeVisible();
    await expect(page.locator(".technical-handle")).toHaveCount(0);
    if (opening === "GOLA")
      await expect(page.locator(".wall-elevation [data-gola]")).toHaveCount(4);
    else
      await expect(page.locator(".wall-elevation [data-gola]")).toHaveCount(0);
  }
  await page.screenshot({
    path: "test-results/2d-push.png",
    animations: "disabled",
  });
});
