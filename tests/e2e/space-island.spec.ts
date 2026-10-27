import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";
import type { Offer } from "../../src/core/types";

async function draft(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Offer>((resolve) => {
        const open = indexedDB.open("KuhinjaKalkulator");
        open.onsuccess = () => {
          const db = open.result,
            q = db.transaction("meta").objectStore("meta").get("draft");
          q.onsuccess = () => {
            resolve(q.result.value);
            db.close();
          };
        };
      }),
  );
}
async function setup(page: Page) {
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  const o = createOffer();
  o.id = "room-test";
  o.client.project = "Promena prostora";
  o.client.layout = "Prava kuhinja";
  o.layout = defaultLayout("Prava kuhinja", 3000);
  const a = newElement("base1");
  a.id = "original";
  a.placement = { wall: "A", offset: 0, order: 0 };
  o.elements = [a];
  await page.evaluate(
    (offer) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.open("KuhinjaKalkulator");
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(["meta", "offers"], "readwrite");
          tx.objectStore("offers").put(offer);
          tx.objectStore("meta").put({ id: "draft", value: offer });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    ensureLayout(o),
  );
  await page.reload();
  await page.locator(".continue-project").click();
}
async function shape(page: Page, value: string) {
  await page.getByRole("button", { name: "Okviri i mere" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Prostor (tip kuhinje)").selectOption({ label: value });
  return dialog;
}
test("promena prostora i položaj ostrva opstaju pri ponovnom otvaranju", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page);
  let dialog = await shape(page, "L kuhinja");
  await dialog.getByRole("button", { name: "Sačuvaj prikaz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zid B", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await draft(page)).layout!.walls.map((w) => w.id))
    .toEqual(["A", "B"]);
  await page
    .getByRole("group", { name: "Pogled kuhinje" })
    .getByRole("button", { name: "Odozgo" })
    .click();
  await expect(page.locator('[data-wall-label="A"]')).toHaveText(
    "Zid A – 3000 mm",
  );
  await expect(page.locator('[data-wall-label="B"]')).toHaveText(
    "Zid B – 3000 mm",
  );
  const bLabel = (await page.locator('[data-wall-label="B"]').boundingBox())!;
  expect(bLabel.height).toBeGreaterThan(bLabel.width);
  for (const enabled of [false, true]) {
    if (enabled)
      await page.getByRole("button", { name: "Kote", exact: true }).click();
    const frame = (await page.locator(".top-scroll").boundingBox())!;
    const labels = await page
      .locator(
        ".top-canvas [data-wall-label], .top-canvas .technical-dimension text",
      )
      .evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
      );
    expect(labels.length).toBeGreaterThanOrEqual(2);
    for (const r of labels) {
      expect(r.left).toBeGreaterThanOrEqual(frame.x - 1);
      expect(r.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
      expect(r.top).toBeGreaterThanOrEqual(frame.y - 1);
      expect(r.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
  }
  await page
    .locator(".top-view")
    .screenshot({ path: "test-results/prostor-kote-360.png" });
  await page
    .getByRole("group", { name: "Tip elementa u biblioteci" })
    .getByRole("button", { name: "Ostali", exact: true })
    .click();
  await page
    .locator(".kitchen-inline-library")
    .getByRole("button", { name: "Dodaj Ostrvski element sa vratima" })
    .click();
  await expect(page.getByRole("button", { name: "Položaj ostrva" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ostrvo", exact: true })).toHaveCount(0);
  const openIsland = async () => {
    await page.locator('[data-plan-wall="island"] [data-plan-id]').first().click();
    return page.getByRole("dialog");
  };
  dialog = await openIsland();
  await dialog.getByLabel("Udaljenost od zida A (mm)").fill("1200");
  await dialog.getByLabel("Udaljenost od zida B (mm)").fill("700");
  await dialog.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).layout!.islandPosition)
    .toEqual({ x: 1400, y: 1200 });
  dialog = await shape(page, "U kuhinja");
  await dialog.getByRole("button", { name: "Sačuvaj prikaz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zid C", exact: true }),
  ).toBeVisible();
  dialog = await openIsland();
  await expect(dialog.getByLabel("Udaljenost od zida C (mm)")).toHaveValue(
    "1200",
  );
  await dialog.getByLabel("Udaljenost od zida C (mm)").fill("1000");
  await expect(dialog.getByLabel("Udaljenost od zida A (mm)")).toHaveValue(
    "1400",
  );
  await dialog.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect
    .poll(async () => (await draft(page)).layout!.islandPosition)
    .toEqual({ x: 1400, y: 1400 });
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(
    page.getByRole("button", { name: "Zid C", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Odozgo" }).click();
  dialog = await openIsland();
  await expect(dialog.getByLabel("Udaljenost od zida B (mm)")).toHaveValue(
    "700",
  );
  await expect(dialog.getByLabel("Udaljenost od zida C (mm)")).toHaveValue(
    "1000",
  );
  await dialog.getByRole("button", { name: "Zatvori" }).click();  await page.getByRole("button", { name: "Zid B", exact: true }).click();
  await page
    .getByRole("group", { name: "Tip elementa u biblioteci" })
    .getByRole("button", { name: "Donji", exact: true })
    .click();
  await page
    .locator(".kitchen-inline-library")
    .getByRole("button", { name: "Dodaj Jedna vrata — levo" })
    .first()
    .click();
  const before = await draft(page);
  dialog = await shape(page, "Prava kuhinja");
  const save = dialog.getByRole("button", { name: "Sačuvaj prikaz", exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await save.click();
  await expect
    .poll(async () => (await draft(page)).layout!.walls.map((w) => w.id))
    .toEqual(["A", "island"]);
  const after = await draft(page);
  expect(after.elements.map((e) => e.id)).toEqual(
    before.elements.map((e) => e.id),
  );
  expect(
    after.elements.find((e) => !before.elements.some((x) => x.id === e.id)),
  ).toBeUndefined();
  expect(after.elements.filter((e) => e.placement?.wall === "A")).toHaveLength(
    2,
  );
});
