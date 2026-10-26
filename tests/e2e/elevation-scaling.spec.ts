import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout, newSpacer } from "../../src/core/layout";
import type { Offer } from "../../src/core/types";
function fixture(length: number, widths: number[], upper = false) {
  const o = createOffer();
  o.id = "scaling";
  o.client.project = `Skaliranje ${length}`;
  o.layout = defaultLayout("L kuhinja", length);
  o.elements = widths.map((width, i) => ({
    ...newElement("base1", o.selection),
    id: `base-${i}`,
    width,
    placement: { wall: "A", offset: 0, order: i },
  }));
  if (upper)
    widths.forEach((width, i) =>
      o.elements.push({
        ...newElement("wall1", o.selection),
        id: `upper-${i}`,
        width,
        placement: { wall: "A", offset: 0, order: i },
      }),
    );
  return ensureLayout(o);
}
async function load(page: Page, o: Offer) {
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  await page.evaluate(
    (o) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("KuhinjaKalkulator");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const d = r.result,
            tx = d.transaction(["offers", "meta"], "readwrite");
          tx.objectStore("offers").put(o);
          tx.objectStore("meta").put({ id: "draft", value: o });
          tx.oncomplete = () => {
            d.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    o,
  );
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(page.locator(".wall-elevation")).toBeVisible();
}
const metrics = (page: Page) =>
  page.locator(".elevation-scroll").evaluate((e) => ({
    width: e.clientWidth,
    height: e.clientHeight,
    scrollWidth: e.scrollWidth,
    scrollHeight: e.scrollHeight,
    left: e.scrollLeft,
    top: e.scrollTop,
  }));
test("kompaktan 2D kadar čuva namerni razmak i omogućava prevlačenje u prazan viseći red", async ({
  page,
}) => {
  const o = fixture(2000, [600, 400, 600]);
  const spacer = newSpacer("A", "base", 200);
  spacer.placement.order = 1;
  o.elements[1].placement!.order = 2;
  o.elements[2].placement!.order = 3;
  o.layout!.spacers = [spacer];
  await load(page, o);
  await expect(page.locator(".wall-elevation")).toBeVisible();
  await center(page);
  await expect(
    page.locator('.elevation-hit[data-element-id="base-1"]'),
  ).toHaveAttribute("data-offset", "800");
  const source = (await page
    .locator(`.elevation-hit[data-element-id="${spacer.id}"]`)
    .boundingBox())!;
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    source.x + source.width / 2 + 10,
    source.y + source.height / 2,
    { steps: 4 },
  );
  await expect(page.locator(".elevation-drop-caption")).toBeVisible();
  const upper = (await page.locator("[data-drop-row=wall]").boundingBox())!;
  await page.mouse.move(upper.x + 40, upper.y + 15, { steps: 8 });
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await page.mouse.up();
  await expect(
    page.locator(`.elevation-hit-row.wall [data-element-id="${spacer.id}"]`),
  ).toHaveCount(1);
  await expect(
    page.locator('.elevation-hit[data-element-id="base-1"]'),
  ).toHaveAttribute("data-offset", "600");
});
const scale = (page: Page) =>
  page.locator(".wall-elevation").getAttribute("data-scale").then(Number);
async function center(page: Page) {
  await page
    .locator(".elevation-frame")
    .evaluate((e) => e.scrollIntoView({ block: "center" }));
}
test("2000, 3200 i 4500 mm na tri mobilne rezolucije: veći frontovi, proporcije i kompaktan okvir", async ({
  page,
}) => {
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [length, widths, upper] of [
      [2000, [600, 400, 600, 400], false],
      [3200, [600, 800, 600, 600, 600], true],
      [4500, [600, 600, 600, 600, 600, 600, 600, 300], false],
    ] as const) {
      await load(page, fixture(length, [...widths], upper));
      const simpleWidth = 600 * Math.max(0.16, 64 / Math.min(600, ...widths));
      if (length === 2000)
        await page.screenshot({
          path: `test-results/skaliranje-jednostavno-${width}.png`,
          animations: "disabled",
        });
      await expect(page.locator(".wall-elevation")).toBeVisible();
      await center(page);
      const view = await metrics(page),
        s = await scale(page);
      expect((600 * s) / simpleWidth).toBeGreaterThan(0.8);
      if (length === 2000) {
        expect((2000 * s) / view.width).toBeGreaterThan(0.85);
        expect(2000 * s).toBeLessThanOrEqual(view.width);
        expect(view.height).toBeLessThan(280);
      } else if (length === 3200) {
        expect(view.height).toBeGreaterThan(300);
        expect(view.height).toBeLessThanOrEqual(height * 0.52 + 1);
        const b = await page
            .locator('[data-technical-id="base-0"]')
            .boundingBox(),
          u = await page.locator('[data-technical-id="upper-0"]').boundingBox();
        expect(Math.abs(b!.y - u!.y - u!.height - 600 * s)).toBeLessThan(1);
      }
      if (length === 4500) expect(view.scrollWidth).toBeGreaterThan(view.width);
      for (const id of ["base-0", "base-1"]) {
        const g = page.locator(`[data-technical-id="${id}"]`),
          box = (await g.boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(
          Number(await g.getAttribute("data-mm-width")) / 720,
          1,
        );
      }
      expect(
        await page
          .locator(".wall-elevation text,.elevation-rulers text")
          .evaluateAll((ns) =>
            ns.every((n) => parseFloat(getComputedStyle(n).fontSize) >= 14),
          ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/skaliranje-${length}-${width}.png`,
        animations: "disabled",
      });
    }
  }
});
test("visina prostorije, prozori i visoki elementi ne umanjuju kuhinju; Uklopi ne menja bazu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const o = fixture(2000, [600, 400, 600, 400]);
  let reference = 0;
  for (const height of [1800, 2600, 6000]) {
    o.elevation!.wallHeight = height;
    o.elevation!.objects = [
      {
        id: "far-window",
        kind: "window",
        wall: "A",
        x: 8000,
        width: 1200,
        height: 2000,
        bottom: 7000,
      },
      {
        id: "window",
        kind: "window",
        wall: "A",
        x: 600,
        width: 800,
        height: 700,
        bottom: 850,
      },
    ];
    await load(page, o);
    await expect(page.locator(".wall-elevation")).toBeVisible();
    await center(page);
    const s = await scale(page);
    if (reference) expect(s).toBeCloseTo(reference);
    else reference = s;
    await expect(page.locator(".elevation-rulers")).toHaveAttribute(
      "aria-label",
      `Visina prostorije ${height} mm`,
    );
    await page.getByRole("button", { name: "Uvećaj 2D prikaz" }).click();
    await page
      .locator(".elevation-scroll")
      .evaluate((e) => e.scrollTo({ left: 300, top: 0 }));
    await page.getByRole("button", { name: "Uklopi", exact: true }).click();
    expect(await scale(page)).toBeCloseTo(reference);
    const view = await metrics(page);
    expect(view.height).toBeLessThan(280);
    const first = (await page
        .locator('.elevation-hit[data-element-id="base-0"]')
        .boundingBox())!,
      frame = (await page.locator(".elevation-scroll").boundingBox())!;
    expect(first.y - frame.y).toBeLessThan(65);
    expect(first.y - frame.y).toBeGreaterThan(30);
    const saved = await page.evaluate(
      () =>
        new Promise<Offer>((resolve) => {
          const r = indexedDB.open("KuhinjaKalkulator");
          r.onsuccess = () => {
            const d = r.result,
              q = d.transaction("meta").objectStore("meta").get("draft");
            q.onsuccess = () => {
              resolve(q.result.value);
              d.close();
            };
          };
        }),
    );
    expect(saved.elements).toEqual(o.elements);
    expect(saved.elevation).toEqual(o.elevation);
    await page.screenshot({
      path: `test-results/skaliranje-prozor-visina-${height}.png`,
      animations: "disabled",
    });
  }
  const tall = fixture(3200, [600, 800, 600, 600, 600], true);
  tall.elements[4] = {
    ...newElement("tall", tall.selection),
    id: "tall",
    height: 2400,
    placement: { wall: "A", offset: 0, order: 4 },
  };
  tall.elevation!.wallHeight = 6000;
  await load(page, tall);
  await expect(page.locator(".wall-elevation")).toBeVisible();
  await center(page);
  const box = (await page.locator("[data-technical-id=tall]").boundingBox())!,
    frame = (await page.locator(".elevation-scroll").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(frame.y + 32);
  expect(box.y + box.height).toBeLessThan(frame.y + frame.height - 40);
  await page.screenshot({
    path: "test-results/skaliranje-visoki.png",
    animations: "disabled",
  });
});
