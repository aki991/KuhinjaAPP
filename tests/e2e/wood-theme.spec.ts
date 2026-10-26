import { test, expect } from "@playwright/test";
test("drveni redizajn: početna, svi projekti i dijalozi na telefonu čuvaju podatke i dostupne kontrole", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Početna", exact: true })
      .click();
    await expect(page.locator(".mobile-brand img")).toHaveJSProperty(
      "naturalWidth",
      1254,
    );
    await page.screenshot({
      path: `test-results/drveni-pocetna-${width}.png`,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Prikaži sve", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sačuvane ponude", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Pretraži projekte", exact: true })
      .fill("Petrović");
    await expect(page.locator(".project-card")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Nazad na početnu", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nova kuhinja", exact: true })
      .click();
    const modal = page.getByRole("dialog", {
      name: "Nova kuhinja",
      exact: true,
    });
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/drveni-nova-kuhinja-${width}.png`,
      animations: "disabled",
    });
    await modal.getByRole("button", { name: "Zatvori", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("produkcioni drveni izgled čuva sve lokalne slike i logo za offline otvaranje", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:4188/");
  await expect(page.locator(".home-view")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".home-view")).toBeVisible();
  for (const name of [
    "logo.png",
    "wood-light.png",
    "wood-dark.png",
    "wood-background.png",
    "kitchen-dark.png",
    "kitchen-light.png",
    "kitchen-walnut.png",
    "icon-maskable.svg",
  ]) {
    expect(
      await page.evaluate(
        async (name) => (await fetch("/brand/" + name)).ok,
        name,
      ),
    ).toBe(true);
  }
  await expect(page.locator(".mobile-brand img")).toHaveJSProperty(
    "naturalWidth",
    1254,
  );
  await page.locator(".continue-project").click();
  await expect(page.locator(".wall-elevation")).toBeVisible();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Cena", exact: true })
    .click();
  await expect(page.getByTestId("total-price")).toBeVisible();
  await page.screenshot({
    path: "test-results/drveni-offline-cena.png",
    animations: "disabled",
  });
});
