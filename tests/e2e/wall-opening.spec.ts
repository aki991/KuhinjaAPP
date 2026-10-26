import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";
import { calculateOffer } from "../../src/core/engine";
import type { Offer, WallOpening } from "../../src/core/types";
const nav = (page: Page, name: string) =>
  page
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
async function optimize(page: Page) {
  await nav(page, "Cena");
  await page
    .getByRole("button", { name: "Promeni materijale i okove", exact: true })
    .click();
}
async function snapshot(page: Page) {
  return page.evaluate(
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
}
async function load(page: Page, locked = false) {
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  const o = createOffer();
  o.id = "wall-opening";
  o.client.project = "GOLA i viseći";
  o.layout = defaultLayout("L kuhinja", 4000);
  o.selection = {
    ...o.selection,
    opening: "gola",
    wallOpening: "handles",
    wallHinge: "hinge-economy",
    frontOverhang: 20,
  };
  o.elements = (["base1", "drawer3", "wall1", "wall2", "wall1"] as const).map(
    (kind, i) => ({
      ...newElement(kind, o.selection),
      id: `wall-test-${i}`,
      placement: { wall: "A", offset: 0, order: i },
    }),
  );
  if (locked) {
    o.elements[4].locked = true;
    o.elements[4].selection = {
      ...o.selection,
      opening: "handles",
      handle: "handle",
    };
  }
  const offer = ensureLayout(o);
  await page.evaluate(
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
  await page.reload();
  await page.locator(".continue-project").click();
  return offer;
}
const parsed = (s: string) =>
  Number(
    s
      .replace(/RSD|\s/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
test("GOLA donji i tri viseća: ručke/push/prepust, precizni okovi, cena, SVG, varijante i ponovno otvaranje", async ({
  page,
}) => {
  const original = await load(page),
    lower = calculateOffer(original).elements.slice(0, 2);
  await optimize(page);
  for (const [opening, label] of [
    ["handles", "Ručke"],
    ["push", "Push"],
    ["overhang", "Prepušteni front"],
  ] as const) {
    await page
      .getByRole("group", { name: "Otvaranje visećih", exact: true })
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect
      .poll(async () => (await snapshot(page)).selection.wallOpening)
      .toBe(opening);
    const state = await snapshot(page),
      c = calculateOffer(state);
    expect(c.errors).toEqual([]);
    expect(c.elements.slice(0, 2)).toEqual(lower);
    expect(c.usage.find((u) => u.product.id === "gola")!.quantity).toBeCloseTo(
      2.4,
    );
    expect(c.usage.find((u) => u.product.id === "gola-end")!.quantity).toBe(8);
    expect(c.handleCount).toBe(opening === "handles" ? 4 : 0);
    expect(c.usage.find((u) => u.product.id === "push")?.quantity ?? 0).toBe(
      opening === "push" ? 4 : 0,
    );
    expect(parsed(await page.getByTestId("total-price").innerText())).toBe(
      c.total,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    if (opening === "overhang") {
      await expect(
        page.getByLabel("Prepust (mm)", { exact: true }),
      ).toHaveValue("20");
      expect(
        c.elements[2].panels.find((p) => p.name === "Front vrata 1")!.height,
      ).toBe(738);
    }
    await page
      .getByRole("button", { name: "Sačuvaj varijantu", exact: true })
      .click();
    await page.getByLabel("Naziv varijante").fill(`Viseći ${opening}`);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Sačuvaj varijantu", exact: true })
      .click();
    await nav(page, "Kuhinja");
    await expect(page.locator(".wall-elevation [data-gola]")).toHaveCount(4);
    const wall = page.locator(
      '.wall-elevation [data-technical-id="wall-test-2"]',
    );
    if (opening === "overhang") {
      await expect(wall).toHaveAttribute("data-front-overhang", "20");
      await expect(wall).toHaveAttribute("data-front-height", "738");
      await expect(wall).toHaveAttribute("data-mm-height", "720");
    }
    await expect(wall.locator(".technical-handle")).toHaveCount(
      opening === "handles" ? 1 : 0,
    );
    await page.screenshot({
      path: `test-results/viseći-${opening}.png`,
      animations: "disabled",
    });
    await page.reload();
    await page.locator(".continue-project").click();
    const reopened = await snapshot(page);
    expect(reopened.selection.wallOpening).toBe(opening);
    expect(calculateOffer(reopened).total).toBe(c.total);
    expect(
      reopened.variants.some(
        (v) =>
          v.name === `Viseći ${opening}` && v.selection.wallOpening === opening,
      ),
    ).toBe(true);
    await optimize(page);
  }
  await page.getByLabel("Prepust (mm)", { exact: true }).fill("30");
  await expect
    .poll(async () => (await snapshot(page)).selection.frontOverhang)
    .toBe(30);
  await nav(page, "Kuhinja");
  await expect(
    page.locator('.wall-elevation [data-technical-id="wall-test-2"]'),
  ).toHaveAttribute("data-front-overhang", "30");
});
test("push sa nepotvrđenim usporivačima je nepotpun dok se eksplicitno ne izaberu kompatibilne šarke", async ({
  page,
}) => {
  await load(page);
  await optimize(page);
  await page
    .getByRole("group", { name: "Otvaranje visećih", exact: true })
    .getByRole("button", { name: "Push", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Šarke visećih", exact: true })
    .selectOption("hinge-standard");
  await expect(page.getByRole("alert")).toContainText("nisu potvrđeni");
  await expect(page.locator(".price-focus>span")).toHaveText(
    "Nepotpun obračun",
  );
  await page
    .getByRole("combobox", { name: "Šarke visećih", exact: true })
    .selectOption("hinge-economy");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".price-focus>span")).toHaveText(
    "Ukupna cena kuhinje",
  );
});
test("zaključana individualna ručka i prepust opstaju posle globalnih promena i ponovnog otvaranja", async ({
  page,
}) => {
  await load(page, true);
  await optimize(page);
  await page
    .getByRole("group", { name: "Otvaranje visećih", exact: true })
    .getByRole("button", { name: "Prepušteni front", exact: true })
    .click();
  await nav(page, "Kuhinja");
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="wall-test-4"] .technical-handle',
    ),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Izmeni V1", exact: true }).click();
  await page.getByText("Dodatna podešavanja", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Otvaranje", exact: true })
    .selectOption("overhang");
  await page
    .getByRole("spinbutton", { name: /^Prepust fronta \(mm\)/ })
    .fill("35");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await optimize(page);
  await page
    .getByRole("group", { name: "Otvaranje visećih", exact: true })
    .getByRole("button", { name: "Ručke", exact: true })
    .click();
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(
    page.locator('.wall-elevation [data-technical-id="wall-test-2"]'),
  ).toHaveAttribute("data-front-overhang", "35");
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="wall-test-4"] .technical-handle',
    ),
  ).toHaveCount(1);
});
test("nova sekcija otvaranja je čitljiva i ne preliva mobilne ekrane", async ({
  page,
}) => {
  await load(page);
  await optimize(page);
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("group", { name: "Otvaranje visećih", exact: true })
      .scrollIntoViewIfNeeded();
    const buttons = page
      .getByRole("group", { name: "Otvaranje visećih", exact: true })
      .getByRole("button");
    expect(
      await buttons.evaluateAll((ns) =>
        ns.every(
          (n) =>
            parseFloat(getComputedStyle(n).fontSize) >= 16 &&
            n.getBoundingClientRect().height >= 44,
        ),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/viseći-materijali-${width}.png`,
      animations: "disabled",
    });
  }
});
