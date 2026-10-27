import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";
import type { Offer } from "../../src/core/types";

async function draft(page: Page) {
  return page.evaluate(() => new Promise<Offer>((resolve) => {
    const q = indexedDB.open("KuhinjaKalkulator");
    q.onsuccess = () => { const db = q.result, request = db.transaction("meta").objectStore("meta").get("draft");
      request.onsuccess = () => { resolve(request.result.value); db.close(); }; };
  }));
}
test("sažet editor koristi isti crtež i menja samo širinu i smer", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/"); await expect(page.locator(".home-view")).toBeVisible();
  const o = createOffer(); o.id = "compact-editor"; o.client.project = "Editor test";
  o.layout = defaultLayout("Prava kuhinja", 3000);
  const item = newElement("base1"); item.id = "door"; item.height = 760; item.depth = 540; item.shelves = 3;
  item.placement = { wall: "A", offset: 0, order: 0 }; o.elements = [item];
  await page.evaluate((offer) => new Promise<void>((resolve) => {
    const q = indexedDB.open("KuhinjaKalkulator"); q.onsuccess = () => {
      const db = q.result, tx = db.transaction(["meta", "offers"], "readwrite");
      tx.objectStore("offers").put(offer); tx.objectStore("meta").put({ id: "draft", value: offer });
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }), ensureLayout(o));
  await page.reload(); await page.locator(".continue-project").click();
  await page.locator('.element-strip-card[data-item-id="door"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Obriši D1" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Dupliraj" })).toBeVisible();
  await expect(dialog.locator('.element-editor-actions button[hidden]')).toHaveCount(3);
  await expect(dialog.locator(".element-advanced-hidden")).toBeHidden();
  await expect(dialog.getByText("Dodatna podešavanja", { exact: true })).toBeHidden();
  await expect(dialog.getByLabel("Širina", { exact: true })).toHaveValue("600");
  await expect(dialog.locator('.editor-drawing [data-kind="base1"]')).toHaveCount(1);
  await expect(dialog.locator('.editor-drawing [data-opening-side="left"]')).toHaveCount(1);
  await dialog.getByLabel("Širina", { exact: true }).fill("450");
  await dialog.getByLabel("Smer otvaranja vrata").selectOption("right");
  await expect(dialog.locator('.editor-drawing [data-opening-side="right"]')).toHaveCount(1);
  await page.screenshot({ path: "test-results/editor-jednostavan-360.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect.poll(async () => (await draft(page)).elements[0].width).toBe(450);
  expect((await draft(page)).elements[0]).toMatchObject({ height: 760, depth: 540, shelves: 3, visual: { hinge: "right" } });
  await expect(page.locator('.wall-elevation [data-opening-side="right"]')).toHaveCount(1);
  await page.reload(); await page.locator(".continue-project").click();
  await expect(page.locator('.wall-elevation [data-opening-side="right"]')).toHaveCount(1);
  await page.locator('.element-strip-card[data-item-id="door"]').click();
  await page.getByRole("dialog").getByRole("button", { name: "Dupliraj" }).click();
  await expect.poll(async () => (await draft(page)).elements.length).toBe(2);
  await page.locator('.element-strip-card[data-item-id="door"]').click();
  await page.getByRole("dialog").getByRole("button", { name: "Obriši D1" }).click();
  await expect.poll(async () => (await draft(page)).elements.length).toBe(1);
});
