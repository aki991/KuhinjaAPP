import { test, expect, type Page } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { ensureLayout } from "../../src/core/layout";
import { calculateOffer } from "../../src/core/engine";
import type { Offer } from "../../src/core/types";
const nav = (p: Page, name: string) =>
  p.locator(".bottom-nav").getByRole("button", { name, exact: true }).click();
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
async function load(p: Page, locked = false) {
  await p.goto("/");
  await expect(p.locator(".home-view")).toBeVisible();
  const o = ensureLayout(createOffer(true));
  o.id = "appearance-plan";
  if (locked) o.elements[0].locked = true;
  o.prices.push({
    ...o.prices.find((p) => p.id === "worktop")!,
    id: "worktop-28",
    name: "Radna ploča 28 mm — test",
    thickness: 28,
    price: 6300,
    appearance: { color: "#424743", texture: "stone" },
  });
  o.prices.push({
    ...o.prices.find((p) => p.id === "handle")!,
    id: "handle-chrome",
    name: "Ručka hrom — test",
    price: 750,
    appearance: { color: "#c5c7c6", texture: "solid" },
  });
  await p.evaluate(
    (o) =>
      new Promise<void>((resolve) => {
        const q = indexedDB.open("KuhinjaKalkulator");
        q.onsuccess = () => {
          const d = q.result,
            t = d.transaction(["meta", "offers"], "readwrite");
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
test("Uklopi u 360 px prikazuje celu kuhinju i kote bez horizontalnog ili vertikalnog skrola", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await load(page);
  const before = await state(page);
  await page
    .getByRole("button", { name: "Uvećaj 2D prikaz", exact: true })
    .click();
  await page.getByRole("button", { name: "Uklopi", exact: true }).click();
  const scroll = page.locator(".elevation-scroll");
  await expect(scroll).toHaveAttribute("data-fit-all", "true");
  for (const dimensions of [false, true]) {
    if (dimensions)
      await page.getByRole("button", { name: "Kote", exact: true }).click();
    await expect
      .poll(() => scroll.evaluate((e) => e.scrollWidth - e.clientWidth))
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() => scroll.evaluate((e) => e.scrollHeight - e.clientHeight))
      .toBeLessThanOrEqual(1);
    const frame = (await scroll.boundingBox())!;
    for (const box of await page
      .locator(".wall-elevation .technical-element")
      .evaluateAll((es) =>
        es.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      )) {
      expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
      expect(box.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
      expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
    }
    expect(await state(page)).toEqual(before);
    await page.locator(".elevation-view").screenshot({
      path: `test-results/uklopi-360-${dimensions ? "kote" : "cisto"}.png`,
      animations: "disabled",
    });
  }
  await page
    .getByRole("button", { name: "Uvećaj 2D prikaz", exact: true })
    .click();
  await expect(scroll).toHaveAttribute("data-fit-all", "false");
  await page.getByRole("button", { name: "Uklopi", exact: true }).click();
  await expect(scroll).toHaveAttribute("data-fit-all", "true");
});
test("pogled odozgo ima donji, viseći i ceo red, stvarne dubine i otvara isti editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await load(page);
  const before = await state(page);
  await page
    .getByRole("group", { name: "Pogled kuhinje", exact: true })
    .getByRole("button", { name: "Odozgo", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Pogled kuhinje odozgo" }),
  ).toBeVisible();
  const filter = page.getByRole("group", {
    name: "Elementi u pogledu odozgo",
    exact: true,
  });
  expect(await page.locator('[data-plan-row="base"]').count()).toBeGreaterThan(
    0,
  );
  expect(await page.locator('[data-plan-row="wall"]').count()).toBeGreaterThan(
    0,
  );
  await filter.getByRole("button", { name: "Donji", exact: true }).click();
  await expect(page.locator('[data-plan-row="wall"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Izmeni D1, pogled odozgo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zatvori", exact: true })
    .click();
  await filter.getByRole("button", { name: "Viseći", exact: true }).click();
  await expect(page.locator('[data-plan-row="base"]')).toHaveCount(0);
  expect(await page.locator('[data-plan-row="wall"]').count()).toBeGreaterThan(
    0,
  );
  await filter.getByRole("button", { name: "Sve", exact: true }).click();
  await page.locator(".top-view").screenshot({
    path: "test-results/pogled-odozgo-360.png",
    animations: "disabled",
  });
  expect(await state(page)).toEqual(before);
});
test("Izgled menja materijale, RAL, ploču i ručice uz tačnu cenu, zaključane izbore i ponovno otvaranje", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const original = await load(page, true);
  await nav(page, "Izgled");
  await page
    .getByRole("textbox", { name: "Pronađi dekor ili artikal", exact: true })
    .fill("hrast");
  await expect(page.locator(".decor-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Pronađi dekor ili artikal", exact: true })
    .fill("");
  await expect(
    page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Cenovnik", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Izaberi Univer hrast 18 mm", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).selection.body)
    .toBe("body-oak");
  await page.getByRole("tab", { name: "Frontovi", exact: true }).click();
  await page
    .getByRole("button", { name: "Isto kao korpus", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).selection.frontMode)
    .toBe("body");
  expect((await state(page)).elements[0]).toEqual(original.elements[0]);
  await nav(page, "Cena");
  await page
    .getByRole("button", { name: "Promeni materijale i okove", exact: true })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Frontovi", exact: true })
      .getByRole("button", { name: "MDF", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("group", { name: "Frontovi", exact: true }),
  ).toContainText("Isto kao korpus");
  await nav(page, "Kuhinja");
  await expect(
    page.locator(`[data-technical-id="${original.elements[1].id}"]`).first(),
  ).toHaveAttribute("data-front-color", "#bd966b");
  await nav(page, "Izgled");
  await page.getByRole("tab", { name: "Frontovi", exact: true }).click();
  await page
    .getByRole("button", { name: "Lakirani MDF (RAL)", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).selection.front)
    .toBe("front-lacquer");
  await expect(page.locator(".decor-card.selected")).toContainText("10.300");
  await page
    .getByRole("textbox", { name: "RAL oznaka", exact: true })
    .fill("RAL test");
  const beforeColor = calculateOffer(await state(page)).total;
  await page.getByLabel("Boja prikaza", { exact: true }).fill("#193847");
  await expect
    .poll(async () => (await state(page)).selection.ralColor)
    .toBe("#193847");
  expect(calculateOffer(await state(page)).total).toBe(beforeColor);
  await page.getByRole("tab", { name: "Radna ploča", exact: true }).click();
  await page
    .getByRole("group", { name: "Debljina radne ploče", exact: true })
    .getByRole("button", { name: "28 mm", exact: true })
    .click();
  await expect(page.locator(".decor-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Izaberi Radna ploča 28 mm — test",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await state(page)).selection.worktop)
    .toBe("worktop-28");
  expect(
    (await state(page)).elements.find((e) => e.kind === "worktop")!.height,
  ).toBe(28);
  await page.getByRole("tab", { name: "Ručice", exact: true }).click();
  await page
    .getByRole("button", { name: "Izaberi Ručka hrom — test", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Viseći elementi", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Izaberi Ručka • Crna mat 160", exact: true })
    .click();
  await page.getByRole("button", { name: "Vodoravno", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).selection.wallHandle)
    .toBe("handle");
  const o = await state(page),
    c = calculateOffer(o);
  expect(c.errors).toEqual([]);
  expect(o.selection.handle).toBe("handle-chrome");
  expect(o.elements[0]).toEqual(original.elements[0]);
  await page.screenshot({
    path: "test-results/izgled-rucice-390.png",
    animations: "disabled",
  });
  await nav(page, "Kuhinja");
  await expect(
    page.locator(`[data-technical-id="${o.elements[1].id}"]`).first(),
  ).toHaveAttribute("data-front-color", "#193847");
  await page.reload();
  await page.locator(".continue-project").click();
  expect(calculateOffer(await state(page)).total).toBe(c.total);
  expect((await state(page)).selection).toEqual(o.selection);
});
test("Izgled i pogled odozgo rade offline i zadržavaju izbor materijala posle ponovnog otvaranja", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:4188/");
  await expect(page.locator(".home-view")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.locator(".continue-project").click();
  await context.setOffline(true);
  await nav(page, "Izgled");
  await page
    .getByRole("button", { name: "Izaberi Univer hrast 18 mm", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).selection.body)
    .toBe("body-oak");
  const total = calculateOffer(await state(page)).total;
  await page.reload();
  await page.locator(".continue-project").click();
  await page
    .getByRole("group", { name: "Pogled kuhinje", exact: true })
    .getByRole("button", { name: "Odozgo", exact: true })
    .click();
  await expect(page.locator(".top-canvas")).toBeVisible();
  await nav(page, "Izgled");
  await expect(
    page.getByRole("button", {
      name: "Izaberi Univer hrast 18 mm",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(calculateOffer(await state(page)).total).toBe(total);
});
test("Cenovnik je u drugoj stranici Podešavanja, fotografija artikla ostaje lokalna i ne menja cenu", async ({
  page,
}) => {
  await load(page);
  await page
    .locator(".app-header")
    .getByRole("button", { name: "Podešavanja", exact: true })
    .click();
  const settings = page.getByRole("dialog", {
    name: "Podešavanja i rezervne kopije",
    exact: true,
  });
  await expect(
    settings.getByRole("tab", { name: "Opšte", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await settings.getByRole("tab", { name: "Cenovnik", exact: true }).click();
  await settings.getByRole("button", { name: /MDF • Mat kašmir/ }).click();
  const edit = page.getByRole("dialog", {
    name: "Izmeni artikal",
    exact: true,
  });
  await edit.getByText("Izgled artikla", { exact: true }).click();
  await edit
    .getByLabel("Fotografija dekora ili ručice", { exact: true })
    .setInputFiles({
      name: "dekor.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(edit.locator(".product-image-preview")).toBeVisible();
  await edit
    .getByRole("button", { name: "Sačuvaj artikal", exact: true })
    .click();
  await settings.getByRole("button", { name: "Zatvori", exact: true }).click();
  const price = calculateOffer(await state(page)).total;
  await nav(page, "Izgled");
  await page.getByRole("tab", { name: "Frontovi", exact: true }).click();
  await page
    .getByRole("button", { name: "Izaberi MDF • Mat kašmir", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        !!(await state(page)).prices.find((p) => p.id === "front-mdf")!
          .appearance?.image,
    )
    .toBe(true);
  expect(calculateOffer(await state(page)).total).toBe(price);
  await page.screenshot({
    path: "test-results/izgled-frontovi-390.png",
    animations: "disabled",
  });
});
