import { test, expect } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";

test("okviri i mere, slobodni redovi i most ažuriraju se i ostaju sačuvani", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  const o = createOffer();
  o.id = "wall-summary";
  o.client.project = "Provera zidova";
  o.client.layout = "Prava kuhinja";
  o.layout = defaultLayout("Prava kuhinja", 3000);
  o.elements = (["base1", "wall1", "wallBridgeFridge"] as const).map(
    (kind, index) => {
      const item = newElement(kind);
      item.id = `item-${index}`;
      item.placement = { wall: "A", order: index, offset: 0 };
      if (kind === "wallBridgeFridge") item.width = 400;
      return item;
    },
  );
  await page.evaluate(
    (offer) =>
      new Promise<void>((resolve) => {
        const q = indexedDB.open("KuhinjaKalkulator");
        q.onsuccess = () => {
          const db = q.result,
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
  const summary = page.locator(".wall-measure");
  await expect(summary).toContainText("Donji red 240 cm");
  await expect(summary).toContainText("Viseći red 200 cm");
  await expect(summary).toContainText("Most 200 cm");
  await expect(summary).not.toContainText("Zauzeto");
  await expect(page.locator(".elevation-free-space")).toHaveCount(0);
  await expect(
    page.locator(".elevation-toolbar").getByRole("button", { name: /mere/i }),
  ).toHaveCount(0);
  await summary.getByRole("button", { name: "Okviri i mere" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Dužina zida (mm)").fill("3500");
  await dialog.getByLabel("Visina zida (mm)").fill("2800");
  await dialog.getByLabel("Razmak iznad ploče (mm)").fill("650");
  await dialog.getByRole("button", { name: "Prozor", exact: true }).click();
  await dialog.getByLabel("Od početka zida (mm)").fill("1200");
  await dialog.getByRole("button", { name: "Sačuvaj prikaz" }).click();
  await expect(summary).toContainText("Donji red 290 cm");
  await expect(summary).toContainText("Viseći red 250 cm");
  await expect(summary).toContainText("Most 250 cm");
  await expect(page.locator("[data-object-kind=window]")).toHaveCount(1);
  await page.locator('.elevation-hit[data-element-id="item-0"]').click();
  await page
    .getByRole("dialog")
    .getByLabel("Širina", { exact: true })
    .fill("400");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(summary).toContainText("Donji red 310 cm");
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(summary).toContainText("Donji red 310 cm");
  await expect(summary).toContainText("Most 250 cm");
  await summary.getByRole("button", { name: "Okviri i mere" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Dužina zida (mm)"),
  ).toHaveValue("3500");
  await expect(
    page.getByRole("dialog").getByLabel("Visina zida (mm)"),
  ).toHaveValue("2800");
  await expect(
    page.getByRole("dialog").getByLabel("Razmak iznad ploče (mm)"),
  ).toHaveValue("650");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zatvori", exact: true })
    .click();
  await page.getByRole("button", { name: "Dodaj zid" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zid B", exact: true })
    .click();
  await expect(summary).toContainText("Donji red 300 cm");
  await expect(summary).toContainText("Viseći red 300 cm");
  await expect(summary).not.toContainText("Most");
});
