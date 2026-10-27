import { expect, test, type Page } from "@playwright/test";
import type { Offer } from "../../src/core/types";

async function draft(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Offer>((resolve) => {
        const request = indexedDB.open("KuhinjaKalkulator");
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction("meta").objectStore("meta").get("draft");
          get.onsuccess = () => {
            resolve(get.result.value);
            db.close();
          };
        };
      }),
  );
}

test("360 px: naziv, početni Uklopi i direktno dodavanje iz cele biblioteke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page).toHaveTitle("Kuhinja po meri");
  await expect(page.locator(".app-header")).toContainText("Kuhinja po meri");
  await page.locator(".continue-project").click();
  const frame = page.locator(".elevation-scroll");
  await expect(frame).toHaveAttribute("data-fit-all", "true");
  await expect
    .poll(() => frame.evaluate((e) => e.scrollWidth - e.clientWidth))
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() => frame.evaluate((e) => e.scrollHeight - e.clientHeight))
    .toBeLessThanOrEqual(1);
  const library = page.getByRole("region", { name: "Biblioteka elemenata" });
  await expect(library.locator(".library-grid > button")).toHaveCount(44);
  await expect(
    library
      .getByRole("group", { name: "Tip elementa u biblioteci" })
      .getByRole("button"),
  ).toHaveCount(4);
  const before = await draft(page);
  await library
    .getByRole("button", { name: "Dodaj Jedna vrata — desno", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Dodaj element" })).toHaveCount(
    0,
  );
  await expect
    .poll(async () => (await draft(page)).elements.length)
    .toBe(before.elements.length + 1);
  expect((await draft(page)).elements.at(-1)?.kind).toBe("base1Right");
  await expect(page.locator(".elevation-scroll")).toHaveAttribute(
    "data-fit-all",
    "true",
  );
  await page.screenshot({
    path: "test-results/biblioteka-360.png",
    animations: "disabled",
  });
  await page.reload();
  await page.locator(".continue-project").click();
  expect((await draft(page)).elements.at(-1)?.kind).toBe("base1Right");
  await library
    .getByRole("button", { name: "Dodaj Izvlačna korpa / cargo" })
    .click();
  await expect
    .poll(async () => (await draft(page)).elements.at(-1)?.kind)
    .toBe("baseCargo");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Cena", exact: true })
    .click();
  await expect(page.getByText("Nepotpun obračun").first()).toBeVisible();
});

test("uvoz dobavljača prikazuje razlike i pamti raspored kolona offline", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".app-header")
    .getByRole("button", { name: "Podešavanja" })
    .click();
  const settings = page.getByRole("dialog", {
    name: "Podešavanja i rezervne kopije",
  });
  await settings.getByRole("tab", { name: "Cenovnik" }).click();
  const csv = [
    "SKU,Naziv,Proizvodjac,Kategorija,Dobavljac,JM,Cena,Valuta,PDV,Rabat,Sirina mm,Visina mm,Dubina mm",
    "BODY-WHITE,Univer beli 18 mm,Primer,body,Demo materijali,m²,2100,RSD,20,5,2800,2070,18",
  ].join("\n");
  await settings
    .locator('input[type="file"][accept=".xlsx,.csv"]')
    .setInputFiles({
      name: "dobavljac.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  const dialog = page.getByRole("dialog", { name: "Uvoz cenovnika" });
  await expect(
    dialog.locator('[aria-label="Promene cena pre uvoza"]'),
  ).toContainText("2.100");
  await expect(
    dialog.locator('[aria-label="Promene cena pre uvoza"]'),
  ).toContainText("1.850");
  await dialog.getByRole("button", { name: /Potvrdi uvoz/ }).click();
  await expect(dialog).toHaveCount(0);
  await settings
    .locator('input[type="file"][accept=".xlsx,.csv"]')
    .setInputFiles({
      name: "dobavljac.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(
    page.getByRole("dialog", { name: "Uvoz cenovnika" }),
  ).toContainText("Učitan sačuvan format: Demo materijali");
});
