import { expect, test, type Page } from "@playwright/test";
import type { Offer } from "../../src/core/types";

async function draft(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Offer>((resolve) => {
        const open = indexedDB.open("KuhinjaKalkulator");
        open.onsuccess = () => {
          const db = open.result,
            request = db.transaction("meta").objectStore("meta").get("draft");
          request.onsuccess = () => {
            resolve(request.result.value);
            db.close();
          };
        };
      }),
  );
}
test("grupe, 92 elementa iz priloga i isti crtež u biblioteci i kuhinji", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nova kuhinja", exact: true }).click();
  await page.getByLabel("Naziv projekta").fill("Biblioteka elemenata");
  await page.getByRole("button", { name: "Dodaj elemente" }).click();
  const library = page.getByRole("region", { name: "Biblioteka elemenata" });
  const filters = library.getByRole("group", {
    name: "Tip elementa u biblioteci",
  });
  for (const [name, count, example] of [
    ["Donji", 44, "Dodaj Donja vitrina — aluminijumski ram"],
    ["Viseći", 37, "Dodaj Podizni front — Blum AVENTOS HK top"],
    ["Visoki", 29, "Dodaj Kolonac rerna + mikrotalasna + 2 fioke"],
    ["Ostali", 34, "Dodaj Ravni most"],
  ] as const) {
    await filters.getByRole("button", { name, exact: true }).click();
    await expect(library.locator(".library-grid > button")).toHaveCount(count);
    await expect(
      library.locator(".library-grid .library-thumbnail"),
    ).toHaveCount(count);
    await expect(
      library.getByRole("button", { name: example, exact: true }),
    ).toBeVisible();
    await expect(
      filters.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await expect(
    library.getByRole("button", { name: "Dodaj Završni isečeni", exact: true }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", {
      name: "Dodaj Frižider samostojeći",
      exact: true,
    }),
  ).toBeVisible();
  await filters.getByRole("button", { name: "Visoki", exact: true }).click();
  const pantry = library.getByRole("button", { name: "Dodaj Visoka ostava sa policama", exact: true });
  await expect(pantry.locator('[data-reference-art="reference062"]')).toHaveCount(1);
  await expect(pantry).toContainText("Precizan obračun nije dostupan");
  await filters.getByRole("button", { name: "Donji", exact: true }).click();
  await filters.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/biblioteka-grupe-360.png",
    animations: "disabled",
  });
  const card = library.getByRole("button", {
    name: "Dodaj Donja vitrina — aluminijumski ram",
    exact: true,
  });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/biblioteka-prilog-360.png",
    animations: "disabled",
  });
  const preview = card.locator('[data-reference-art="reference002"]');
  await expect(preview).toHaveCount(1);
  const sketch = await preview.innerHTML();
  await card.click();
  await expect
    .poll(async () => (await draft(page)).elements.at(-1)?.kind)
    .toBe("reference002");
  const inserted = page.locator(
    '.wall-elevation [data-reference-art="reference002"]',
  );
  await expect(inserted).toHaveCount(1);
  expect(await inserted.innerHTML()).toBe(sketch);
  await expect(
    page.locator('.element-strip [data-reference-art="reference002"]'),
  ).toHaveCount(1);
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(
    page.locator('.wall-elevation [data-reference-art="reference002"]'),
  ).toHaveCount(1);
  await page.getByRole("group", { name: "Tip elementa u biblioteci" }).getByRole("button", { name: "Ostali", exact: true }).click();
  await library.getByRole("button", { name: "Dodaj Donja maska", exact: true }).click();
  await expect.poll(async () => (await draft(page)).elements.at(-1)?.kind).toBe("reference082");
  const mask = (await draft(page)).elements.at(-1)!;
  await page.locator(`.element-strip-card[data-item-id="${mask.id}"]`).click();
  await expect(page.getByRole("dialog").getByLabel("Širina", { exact: true })).toHaveValue("40");
  await page.getByRole("dialog").getByLabel("Širina", { exact: true }).fill("30");
  await page.getByRole("dialog").getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect.poll(async () => (await draft(page)).elements.find((e) => e.id === mask.id)?.width).toBe(30);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Cena", exact: true })
    .click();
  await expect(page.getByText("Nepotpun obračun").first()).toBeVisible();
});
