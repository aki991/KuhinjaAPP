import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout, newSpacer } from "../../src/core/layout";
import { calculateOffer } from "../../src/core/engine";
import type { Offer } from "../../src/core/types";
async function state(p: Page) {
  return p.evaluate(
    () =>
      new Promise<Offer>((resolve) => {
        const q = indexedDB.open("KuhinjaKalkulator");
        q.onsuccess = () => {
          const d = q.result,
            r = d.transaction("meta").objectStore("meta").get("draft");
          r.onsuccess = () => {
            resolve(r.result.value);
            d.close();
          };
        };
      }),
  );
}
async function load(p: Page) {
  await p.goto("/");
  await expect(p.locator(".home-view")).toBeVisible();
  const o = createOffer();
  o.client.project = "Detaljan prikaz";
  o.layout = defaultLayout("Prava kuhinja", 3500);
  o.elements = (
    [
      "fridge",
      "base1",
      "sink",
      "base1",
      "oven",
      "base1",
      "wall1",
      "wall1",
      "wall1",
      "wall2",
      "wall1",
      "worktop",
    ] as const
  ).map((kind, i) => ({
    ...newElement(kind),
    id: "detail-" + i,
    placement: { wall: "A", offset: 0, order: i },
  }));
  [600, 400, 800, 600, 600, 350, 300, 310, 300, 600, 390, 2900].forEach(
    (w, i) => (o.elements[i].width = w),
  );
  o.elements[3].visual = { appliance: "dishwasher" };
  o.elements[11].visual = { offset: 600 };
  const baseGap = newSpacer("A", "base", 150);
  baseGap.placement.order = 4;
  for (const e of o.elements.slice(4, 6))
    e.placement!.order = (e.placement!.order ?? 0) + 1;
  const wallGap1 = newSpacer("A", "wall", 600),
    wallGap2 = newSpacer("A", "wall", 1000);
  wallGap1.placement.order = 0;
  wallGap2.placement.order = 3;
  for (const [j, e] of o.elements.slice(6, 11).entries())
    e.placement!.order = j < 2 ? j + 1 : j + 2;
  o.layout!.spacers = [baseGap, wallGap1, wallGap2];
  o.elevation!.objects = [
    {
      id: "window",
      wall: "A",
      kind: "window",
      x: 1210,
      width: 1000,
      bottom: 950,
      height: 1150,
    },
  ];
  const offer = ensureLayout(o);
  await p.evaluate(
    (o) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open("KuhinjaKalkulator");
        r.onsuccess = () => {
          const d = r.result,
            t = d.transaction(["offers", "meta"], "readwrite");
          t.objectStore("offers").put(o);
          t.objectStore("meta").put({ id: "draft", value: o });
          t.oncomplete = () => {
            d.close();
            resolve();
          };
        };
      }),
    offer,
  );
  await p.reload();
  await p.locator(".continue-project").click();
  await expect(p.locator(".wall-elevation")).toBeVisible();
}
test("detaljni frontovi i kartice, prozor i aparati; Kote na tri mobilne širine ne menjaju projekat", async ({
  page,
}) => {
  await load(page);
  const before = await state(page),
    price = calculateOffer(before).total;
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    const toggle = page.getByRole("button", { name: "Kote", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.locator(".wall-elevation .technical-dimension"),
    ).toHaveCount(1);
    expect(
      await page.locator(".wall-elevation [data-front-panel]").count(),
    ).toBeGreaterThan(8);
    expect(
      await page.locator(".element-miniature [data-front-panel]").count(),
    ).toBeGreaterThan(8);
    await expect(
      page.locator('.wall-elevation [data-appliance="oven"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.wall-elevation [data-wall-object="window"]'),
    ).toHaveCount(1);
    await page.locator(".elevation-view").screenshot({
      path: `test-results/detaljan-prikaz-${width}.png`,
      animations: "disabled",
    });
    const scale = await page
      .locator(".wall-elevation")
      .getAttribute("data-scale");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.locator(".wall-elevation .technical-dimension").count(),
    ).toBeGreaterThan(8);
    await expect(page.locator(".wall-elevation")).toHaveAttribute(
      "data-scale",
      scale!,
    );
    await expect(page.locator('[data-dimension-chain="total"]')).toContainText(
      "3.500",
    );
    expect(await state(page)).toEqual(before);
    expect(calculateOffer(await state(page)).total).toBe(price);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".elevation-view").screenshot({
      path: `test-results/detaljan-kote-${width}.png`,
      animations: "disabled",
    });
    await toggle.click();
  }
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.locator(".elevation-view").screenshot({
    path: "test-results/detaljan-pregled.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Kote", exact: true }).click();
  await page.locator(".elevation-view").screenshot({
    path: "test-results/detaljan-pregled-kote.png",
    animations: "disabled",
  });
  await page.locator(".element-strip").screenshot({
    path: "test-results/detaljni-elementi.png",
    animations: "disabled",
  });
});
test("kote se ažuriraju posle promene širine, u fullscreen prikazu i nakon ponovnog otvaranja", async ({
  page,
}) => {
  await load(page);
  await page.getByRole("button", { name: "Kote", exact: true }).click();
  await page.getByRole("button", { name: "Izmeni D1", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "Širina", exact: true })
    .fill("380");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(
    page.locator(".wall-elevation .technical-dimension"),
  ).toContainText(["380"]);
  await expect
    .poll(
      async () =>
        (await state(page)).elements.find((e) => e.id === "detail-1")!.width,
    )
    .toBe(380);
  await page.setViewportSize({ width: 844, height: 390 });
  await page
    .getByRole("button", { name: "Prikaz preko celog ekrana", exact: true })
    .click();
  await expect(page.locator(".kitchen-fullscreen")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kote", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('.kitchen-fullscreen [data-dimension-chain="total"]'),
  ).toContainText("3.500");
  await page
    .getByRole("button", {
      name: "Zatvori prikaz preko celog ekrana",
      exact: true,
    })
    .click();
  await page.reload();
  await page.locator(".continue-project").click();
  expect(
    (await state(page)).elements.find((e) => e.id === "detail-1")!.width,
  ).toBe(380);
});
