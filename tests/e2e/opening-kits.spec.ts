import { test, expect, type Page } from "@playwright/test";
import { kitsKitchen } from "../fixtures/opening-kits";
import { calculateOffer } from "../../src/core/engine";
import type { Offer } from "../../src/core/types";
import { newElement } from "../../src/core/catalog";
const nav = (p: Page, name: string) =>
  p.locator(".bottom-nav").getByRole("button", { name, exact: true }).click();
const group = (p: Page, name: string) =>
  p.getByRole("group", { name, exact: true });
async function state(p: Page) {
  return p.evaluate(
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
async function load(
  p: Page,
  options: {
    silent?: boolean;
    vertical?: boolean;
    locked?: boolean;
    invalid?: boolean;
    sink?: boolean;
  } = {},
) {
  await p.goto("/");
  await expect(p.locator(".home-view")).toBeVisible();
  const o = kitsKitchen();
  if (options.sink) {
    o.elements.push({
      ...newElement("sink"),
      id: "sink-gola",
      placement: { wall: "A", offset: 1800, order: 5 },
    });
    o.prices.find((p) => p.id === "push")!.pushRule!.kinds = ["wall1", "wall2"]; // Existing project's previous bundled rule.
  }
  if (options.silent === false)
    o.prices = o.prices.filter((p) => p.id !== "silent-test");
  if (options.vertical === false)
    delete o.prices.find((p) => p.id === "vertical-test")!.verticalGolaRule;
  if (options.locked) {
    o.elements[4].locked = true;
    o.elements[4].selection = { ...o.selection, opening: "handles" };
  }
  if (options.invalid) {
    o.selection.wallOpening = "push";
    o.selection.wallHinge = "hinge-premium";
  }
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
    o,
  );
  await p.reload();
  await p.locator(".continue-project").click();
  return o;
}
async function optimize(p: Page) {
  await nav(p, "Cena");
  await p
    .getByRole("button", { name: "Promeni materijale i okove", exact: true })
    .click();
}
test("visoki ormar dobija Push komplet, sudopera običan GOLA profil, a izbori opstaju posle otvaranja", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, { sink: true });
  await optimize(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await group(page, "Otvaranje visokih")
    .getByRole("button", { name: "Push", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await expect(
    d.getByRole("radio", { name: "Klasični Push 1", exact: true }),
  ).toBeVisible();
  expect((await state(page)).selection.tallOpening).toBe("handles");
  await d.getByRole("radio", { name: "Klasični Push 1", exact: true }).check();
  await d.getByRole("button", { name: "Potvrdi izbor", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).selection.tallOpening)
    .toBe("push");
  const o = await state(page),
    c = calculateOffer(o);
  expect(c.errors).toEqual([]);
  expect(c.usage.find((u) => u.product.id === "push")!.quantity).toBe(2);
  expect(c.usage.find((u) => u.product.id === "gola")!.quantity).toBeCloseTo(
    3.2,
  );
  expect(c.usage.find((u) => u.product.id === "gola-end")!.quantity).toBe(10);
  expect(
    c.elements
      .find((r) => r.element.id === "kit-2")!
      .hardware.filter((h) => h.label === "Šarke")
      .reduce((s, h) => s + h.quantity, 0),
  ).toBe(6);
  expect(
    c.elements
      .find((r) => r.element.id === "sink-gola")!
      .hardware.some((h) => h.label === "Ručke"),
  ).toBe(false);
  expect(o.selection.wallOpening).toBe("handles");
  expect(o.selection.opening).toBe("gola");
  await nav(page, "Kuhinja");
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="sink-gola"] [data-gola="horizontal"]',
    ),
  ).toHaveCount(1);
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="kit-2"] .technical-handle',
    ),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/sudopera-gola-visoki-push-390.png",
    animations: "disabled",
  });
  await page.reload();
  await page.locator(".continue-project").click();
  expect(calculateOffer(await state(page)).total).toBe(c.total);
});
test("mobilni izbor kompleta zahteva potvrdu, čuva premium do potvrde, zamena i Silent bez duplog okova", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const original = await load(page);
  await optimize(page);
  await group(page, "Otvaranje visećih")
    .getByRole("button", { name: "Push", exact: true })
    .click();
  let d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await expect(d).toBeVisible();
  await expect(d.getByRole("radio")).toHaveCount(2);
  expect((await state(page)).selection.wallOpening).toBe("handles");
  expect((await state(page)).selection.hinge).toBe("hinge-premium");
  await d.getByRole("radio", { name: "Klasični Push 1", exact: true }).check();
  await d.getByRole("button", { name: "Odustani", exact: true }).click();
  expect((await state(page)).selection.wallOpening).toBe("handles");
  await group(page, "Otvaranje visećih")
    .getByRole("button", { name: "Push", exact: true })
    .click();
  d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await d.getByRole("radio", { name: "Klasični Push 1", exact: true }).check();
  await page.screenshot({
    path: "test-results/push-potvrda-390.png",
    animations: "disabled",
  });
  await d.getByRole("button", { name: "Potvrdi izbor", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).selection.wallHinge)
    .toBe("hinge-economy");
  let o = await state(page),
    c = calculateOffer(o);
  expect(c.errors).toEqual([]);
  expect(c.elements.slice(0, 3)).toEqual(
    calculateOffer(original).elements.slice(0, 3),
  );
  expect(c.usage.find((u) => u.product.id === "push")!.quantity).toBe(3);
  await page
    .getByRole("button", { name: "Push komplet visećih", exact: true })
    .click();
  d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await d
    .getByRole("radio", { name: "Push sa mekim zatvaranjem 1", exact: true })
    .check();
  await d.getByRole("button", { name: "Potvrdi izbor", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).selection.wallPush)
    .toBe("silent-test");
  o = await state(page);
  c = calculateOffer(o);
  expect(c.errors).toEqual([]);
  expect(c.usage.find((u) => u.product.id === "silent-test")!.quantity).toBe(3);
  expect(c.usage.some((u) => u.product.id === "push")).toBe(false);
  expect(c.usage.find((u) => u.product.id === "other")!.quantity).toBe(6);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await nav(page, "Kuhinja");
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="kit-3"] .technical-handle',
    ),
  ).toHaveCount(0);
  await page.reload();
  await page.locator(".continue-project").click();
  expect(calculateOffer(await state(page)).total).toBe(c.total);
});
test("vertikalna GOLA, nezavisne grupe, individualne ručke, 2D i ponovno otvaranje", async ({
  page,
}) => {
  const original = await load(page, { locked: true });
  await optimize(page);
  await group(page, "Otvaranje visokih")
    .getByRole("button", { name: "Vertikalna GOLA", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Vertikalni GOLA profil", exact: true })
    .selectOption("vertical-test");
  await expect
    .poll(async () => (await state(page)).selection.verticalGola)
    .toBe("vertical-test");
  await group(page, "Otvaranje visećih")
    .getByRole("button", { name: "Push", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await d.getByRole("radio", { name: "Klasični Push 1", exact: true }).check();
  await d.getByRole("button", { name: "Potvrdi izbor", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).selection.wallOpening)
    .toBe("push");
  const o = await state(page),
    c = calculateOffer(o);
  expect(c.errors).toEqual([]);
  expect(o.elements[4]).toEqual(original.elements[4]);
  expect(c.usage.find((u) => u.product.id === "gola")!.quantity).toBe(2.4);
  await nav(page, "Kuhinja");
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="kit-2"] [data-gola="vertical"]',
    ),
  ).toHaveCount(1);
  await expect(
    page.locator(
      '.wall-elevation [data-technical-id="kit-4"] .technical-handle',
    ),
  ).toHaveCount(2);
  await page.screenshot({
    path: "test-results/vertikalna-gola-390.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Izmeni T1", exact: true }).click();
  await page.getByText("Dodatna podešavanja", { exact: true }).click();
  const e = page.getByRole("dialog").first();
  await e
    .getByRole("combobox", { name: "Otvaranje", exact: true })
    .selectOption("handles");
  await e.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await page.reload();
  await page.locator(".continue-project").click();
  expect((await state(page)).elements[2].selection.opening).toBe("handles");
  expect((await state(page)).elements[2].locked).toBe(true);
});
test("Reši otvara komplet za nepotpunu grupu; nepoznati Silent nije ponuđen", async ({
  page,
}) => {
  await load(page, { invalid: true, silent: false });
  await nav(page, "Cena");
  await expect(page.getByRole("alert")).toContainText("nisu potvrđeni");
  await expect(page.getByRole("alert")).not.toContainText(
    /wall1|wall2|tall|sink/,
  );
  await page.getByRole("button", { name: "Reši", exact: true }).first().click();
  const d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await expect(d.getByRole("radio")).toHaveCount(1);
  await expect(
    d.getByText("Push sa mekim zatvaranjem", { exact: true }),
  ).toHaveCount(0);
  await d.getByRole("radio").check();
  await d.getByRole("button", { name: "Potvrdi izbor", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".price-focus>span")).toHaveText(
    "Ukupna cena kuhinje",
  );
});
test("Podesi profil zahteva konkretno pravilo i čuva geometriju i cenu artikla", async ({
  page,
}) => {
  const original = await load(page, { vertical: false });
  await optimize(page);
  await group(page, "Otvaranje visokih")
    .getByRole("button", { name: "Vertikalna GOLA", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Podesi profil", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Vertikalna GOLA", exact: true });
  await d
    .getByRole("combobox", { name: "Artikal profila", exact: true })
    .selectOption("vertical-test");
  await d.getByText("Pravilo vertikalne GOLA", { exact: true }).click();
  await d
    .getByRole("button", { name: "Definiši pravilo profila", exact: true })
    .click();
  await d.getByRole("button", { name: "Potvrdi profil", exact: true }).click();
  await expect(d.getByRole("alert")).toBeVisible();
  await d
    .getByRole("textbox", { name: "Izvor pravila / model", exact: true })
    .fill("Potvrđen model za običan ormar");
  await d
    .getByRole("spinbutton", { name: "Odstupanje od vrha (mm)", exact: true })
    .fill("20");
  await d
    .getByRole("spinbutton", { name: "Odstupanje od dna (mm)", exact: true })
    .fill("30");
  await d
    .getByRole("spinbutton", {
      name: "Suženje fronta po profilu (mm)",
      exact: true,
    })
    .fill("25");
  await d
    .getByRole("spinbutton", {
      name: "Najveća visina korpusa (mm)",
      exact: true,
    })
    .fill("2400");
  await d
    .getByRole("spinbutton", {
      name: "Najveća širina korpusa (mm)",
      exact: true,
    })
    .fill("800");
  await d
    .getByRole("combobox", { name: "Artikal završetka", exact: true })
    .selectOption("gola-end");
  await d.getByRole("button", { name: "Potvrdi profil", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect
    .poll(async () => (await state(page)).selection.verticalGola)
    .toBe("vertical-test");
  const o = await state(page);
  expect(calculateOffer(o).errors).toEqual([]);
  expect(o.elements).toEqual(original.elements);
  expect(o.prices.map((p) => p.price)).toEqual(
    original.prices.map((p) => p.price),
  );
  expect(
    calculateOffer(o).usage.find((u) => u.product.id === "vertical-test")!
      .quantity,
  ).toBeCloseTo((o.elements[2].height - 50) / 1000);
});
test("Podesi komplet koristi postojeće artikle i potvrdu pravila; bez proizvoljne cene", async ({
  page,
}) => {
  const original = await load(page, { silent: false });
  await optimize(page);
  await group(page, "Otvaranje visećih")
    .getByRole("button", { name: "Push", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
  await d.getByRole("button", { name: "Podesi komplet", exact: true }).click();
  await d.getByText("Kompatibilnost push sistema", { exact: true }).click();
  await d
    .getByRole("combobox", { name: "Vrsta Push sistema", exact: true })
    .selectOption("silent");
  await d
    .getByRole("textbox", { name: "Izvor pravila / model", exact: true })
    .fill("Potvrđena test dokumentacija");
  await d.getByRole("spinbutton", { name: /^Šarki po vratima/ }).fill("2");
  await d.getByRole("checkbox", { name: /^Osnovne/ }).uncheck();
  await d.getByRole("checkbox", { name: /^Premium/ }).check();
  await d.getByRole("button", { name: "Proveri komplet", exact: true }).click();
  await d
    .getByRole("radio", { name: "Push sa mekim zatvaranjem 1", exact: true })
    .check();
  await d.getByRole("button", { name: "Potvrdi izbor", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).selection.wallOpening)
    .toBe("push");
  const o = await state(page);
  expect(o.prices.map((p) => p.price)).toEqual(
    original.prices.map((p) => p.price),
  );
  expect(calculateOffer(o).errors).toEqual([]);
  await page.reload();
  await page.locator(".continue-project").click();
  expect(
    (await state(page)).prices.find((p) => p.id === "push")!.pushRule!.system,
  ).toBe("silent");
});
test("tri mobilne širine zadržavaju dostupne kontrole kompleta bez horizontalnog prelivanja", async ({
  page,
}) => {
  await load(page);
  await optimize(page);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({
      width,
      height: width === 360 ? 800 : width === 390 ? 844 : 932,
    });
    await group(page, "Otvaranje visećih")
      .getByRole("button", { name: "Push", exact: true })
      .click();
    const d = page.getByRole("dialog", { name: "Izaberite Push sistem" });
    await expect(
      d.getByRole("button", { name: "Odustani", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await d.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.screenshot({
      path: `test-results/push-komplet-${width}.png`,
      animations: "disabled",
    });
    await d.getByRole("button", { name: "Odustani", exact: true }).click();
  }
});
