import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";
import type { ElementKind, Offer } from "../../src/core/types";
import { pinchZoom } from "./pinch";

function fixture(u: boolean) {
  const o = createOffer();
  o.id = "connected-plan";
  o.client.project = "Povezana kuhinja";
  o.client.layout = u ? "U kuhinja" : "L kuhinja";
  o.layout = defaultLayout(o.client.layout, 2400);
  const add = (
    kind: ElementKind,
    id: string,
    wall: string,
    order: number,
    width = 600,
  ) => {
    const e = newElement(kind);
    e.id = id;
    e.width = width;
    e.placement = { wall, order, offset: 0 };
    o.elements.push(e);
  };
  add("base2", "a1", "A", 0, 900);
  add("base1", "a2", "A", 1);
  add("corner", "corner-a", "A", 2, 900);
  add("wall2", "upper-a", "A", 0, 1500);
  add("wallCorner", "upper-corner", "A", 1, 900);
  o.elements.at(-1)!.depth = 600;
  add("base1", "b1", "B", 0);
  add("wall1", "upper-b", "B", 0);
  if (u) {
    add("corner", "corner-b", "B", 1, 900);
    add("base1", "c1", "C", 0);
  }
  o.layout.walls.push({ id: "island", name: "Ostrvo", length: 900 });
  add("island", "island-1", "island", 0, 900);
  return ensureLayout(o);
}
async function load(page: Page, offer: Offer) {
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
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
    offer,
  );
  await page.reload();
  await page.locator(".continue-project").click();
  await page
    .getByRole("group", { name: "Pogled kuhinje", exact: true })
    .getByRole("button", { name: "Odozgo", exact: true })
    .click();
}
test("L/U plan na tri mobilne širine povezuje sve zidove, ugaone rezerve i ostrvo", async ({
  page,
}) => {
  for (const width of [360, 390, 430])
    for (const [u, island] of [[false, false], [false, true], [true, false], [true, true]]) {
      await page.setViewportSize({ width, height: 844 });
      const offer = fixture(u);
      if (!island) {
        offer.elements = offer.elements.filter((e) => e.placement?.wall !== "island");
        offer.layout!.walls = offer.layout!.walls.filter((w) => w.id !== "island");
      }
      await load(page, offer);
      await expect(page.locator("[data-plan-wall]")).toHaveCount((u ? 3 : 2) + Number(island));
      await expect(page.locator('[data-plan-wall="B"]')).toHaveAttribute(
        "data-wall-angle",
        "90",
      );
      await expect(page.locator('[data-wall-label="A"]')).toHaveText("Zid A – 2400 mm");
      await expect(page.locator('[data-wall-label="B"]')).toHaveText("Zid B – 2400 mm");
      if (!island) {
        const frame = (await page.locator(".top-scroll").boundingBox())!;
        const wall = (await page.locator('[data-plan-wall="A"] > path').boundingBox())!;
        expect(wall.width / frame.width).toBeGreaterThan(0.72);
      }
      await expect(
        page.locator('[data-plan-wall="B"] [data-plan-id="b1"]'),
      ).toHaveAttribute("data-mm-x", "900");
      await expect(
        page.locator('[data-plan-wall="B"] [data-plan-id="upper-b"]'),
      ).toHaveAttribute("data-mm-x", "600");
      await expect(
        page.locator(
          '[data-plan-wall="B"] [data-corner-reservation="corner-a"]',
        ),
      ).toHaveAttribute("data-reserved-mm", "900");
      if (island) await expect(
        page.locator('[data-plan-wall="island"] [data-plan-id="island-1"]'),
      ).toBeVisible();
      if (u) {
        await expect(page.locator('[data-wall-label="C"]')).toHaveText("Zid C – 2400 mm");
        const labels = await page.evaluate(() => {
          const values = ["A", "B", "C"].map((id) => {
            const group = document.querySelector(`[data-plan-wall="${id}"]`)!;
            const line = group.querySelector("path")!.getBoundingClientRect();
            const text = group.querySelector("[data-wall-label]") as SVGTextElement;
            const box = text.getBoundingClientRect();
            return { line: { x: line.x, y: line.y }, box: { left: box.left, top: box.top, bottom: box.bottom }, matrix: { a: text.getScreenCTM()!.a, d: text.getScreenCTM()!.d } };
          });
          return { gapA: values[0].line.y - values[0].box.bottom,
            gapB: values[1].box.left - values[1].line.x,
            gapC: values[2].box.top - values[2].line.y, c: values[2].matrix };
        });
        expect(labels.c.a).toBeLessThan(0);
        expect(labels.c.d).toBeLessThan(0);
        expect(Math.abs(labels.gapA - labels.gapB)).toBeLessThan(1);
        expect(Math.abs(labels.gapA - labels.gapC)).toBeLessThan(1);
        await expect(page.locator('[data-plan-wall="C"]')).toHaveAttribute(
          "data-wall-angle",
          "180",
        );
        await expect(
          page.locator('[data-plan-wall="C"] [data-plan-id="c1"]'),
        ).toHaveAttribute("data-mm-x", "900");
      }
      const filters = page.getByRole("group", {
        name: "Elementi u pogledu odozgo",
        exact: true,
      });
      await filters.getByRole("button", { name: "Donji", exact: true }).click();
      await expect(page.locator('[data-plan-row="wall"]')).toHaveCount(0);
      await filters
        .getByRole("button", { name: "Viseći", exact: true })
        .click();
      await expect(page.locator('[data-plan-row="base"]')).toHaveCount(0);
      await expect(
        page.locator('[data-plan-wall="B"] [data-plan-id="upper-b"]'),
      ).toBeVisible();
      await filters.getByRole("button", { name: "Sve", exact: true }).click();
      await page.getByRole("button", { name: "Kote", exact: true }).click();
      const scroll = page.locator(".top-scroll");
      expect(
        await scroll.evaluate((e) => e.scrollWidth - e.clientWidth),
      ).toBeLessThanOrEqual(1);
      expect(
        await scroll.evaluate((e) => e.scrollHeight - e.clientHeight),
      ).toBeLessThanOrEqual(1);
      const frame = (await scroll.boundingBox())!;
      for (const label of await page
        .locator(".top-canvas [data-wall-label], .top-canvas .technical-dimension text")
        .evaluateAll((labels) =>
          labels.map((label) => {
            const r = label.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          }),
        )) {
        expect(label.left).toBeGreaterThanOrEqual(frame.x - 1);
        expect(label.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
        expect(label.top).toBeGreaterThanOrEqual(frame.y - 1);
        expect(label.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
      }
      await page
        .locator(".top-view")
        .screenshot({
          path: `test-results/povezana-${u ? "U" : "L"}-${width}${island ? "-ostrvo" : ""}.png`,
        });
    }
});
test("dodir oznake uređuje izabrani zid i čuva ostale zidove", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const offer = fixture(true);
  offer.elements = offer.elements.filter((item) => item.placement?.wall !== "island");
  offer.layout!.walls = offer.layout!.walls.filter((wall) => wall.id !== "island");
  await load(page, offer);
  await page.locator(".top-view").screenshot({ path: "test-results/uvecani-tlocrt-360.png" });
  await page.getByRole("button", { name: "Izmeni dužinu Zid B" }).tap();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Dužina · Zid B");
  await dialog.getByLabel("Dužina zida (mm)").fill("3200");
  await dialog.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect(page.locator('[data-wall-label="B"]')).toHaveText("Zid B – 3200 mm");
  await expect(page.locator('[data-wall-label="A"]')).toHaveText("Zid A – 2400 mm");
  await expect(page.locator('[data-wall-label="C"]')).toHaveText("Zid C – 2400 mm");
  await expect(page.getByRole("button", { name: "Zid A", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Izmeni dužinu Zid C" }).focus();
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Dužina · Zid C");
  await dialog.getByRole("button", { name: "Zatvori", exact: true }).click();
  await page.reload();
  await page.locator(".continue-project").click();
  await page.getByRole("group", { name: "Pogled kuhinje", exact: true }).getByRole("button", { name: "Odozgo", exact: true }).click();
  await expect(page.locator('[data-wall-label="B"]')).toHaveText("Zid B – 3200 mm");
});
test("izbor elementa na drugom zidu, izmena dubine ugla i ponovno otvaranje ažuriraju oba prikaza", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, fixture(false));
  await pinchZoom(page, ".top-scroll", 1.5);
  await page.getByRole("button", { name: "Uklopi", exact: true }).click();
  await page
    .getByRole("group", { name: "Elementi u pogledu odozgo", exact: true })
    .getByRole("button", { name: "Donji", exact: true })
    .click();
  await page.locator('[data-plan-wall="B"] [data-plan-id="b1"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zid B", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zatvori", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Elementi u pogledu odozgo", exact: true })
    .getByRole("button", { name: "Donji", exact: true })
    .click();
  await page.locator('[data-plan-wall="A"] [data-plan-id="corner-a"]').click();
  await page
    .getByRole("dialog")
    .getByLabel("Dubina", { exact: true })
    .fill("750");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(
    page.locator('[data-plan-wall="B"] [data-plan-id="b1"]'),
  ).toHaveAttribute("data-mm-x", "750");
  await page.reload();
  await page.locator(".continue-project").click();
  await page
    .getByRole("group", { name: "Pogled kuhinje", exact: true })
    .getByRole("button", { name: "Odozgo", exact: true })
    .click();
  await expect(
    page.locator('[data-plan-wall="B"] [data-plan-id="b1"]'),
  ).toHaveAttribute("data-mm-x", "750");
});
