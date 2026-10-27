import { pinchZoom } from "./pinch";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";
import { calculateOffer } from "../../src/core/engine";
import type { Offer } from "../../src/core/types";
async function fixture(page: Page, kind = "base1", count = 3) {
  await page.goto("/");
  await expect(page.locator(".home-view")).toBeVisible();
  const o = createOffer();
  o.id = "fullscreen-test";
  o.client.project = "Rad u punom ekranu";
  o.layout = defaultLayout("L kuhinja", 600 * count);
  o.elements = Array.from({ length: count }, (_, i) => ({
    ...newElement(kind as "base1", o.selection),
    id: `e${i}`,
    width: 600,
    placement: { wall: "A", offset: 0, order: i },
  }));
  const normalized = ensureLayout(o);
  await page.evaluate(
    (o) =>
      new Promise<void>((resolve, reject) => {
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
          t.onerror = () => reject(t.error);
        };
      }),
    normalized,
  );
  await page.reload();
  await page.locator(".continue-project").click();
  return normalized;
}
const hit = (page: Page, code: string) =>
  page.locator(`.elevation-hit[aria-label^="${code},"]`).first();
async function point(l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const save = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
const enter = (page: Page) =>
  page
    .getByRole("button", { name: "Prikaz preko celog ekrana", exact: true })
    .click();
const exit = (page: Page) =>
  page
    .getByRole("button", { name: "Zatvori prikaz preko celog ekrana" })
    .click();
async function saved(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Offer>((resolve) => {
        const r = indexedDB.open("KuhinjaKalkulator");
        r.onsuccess = () => {
          const d = r.result,
            q = d
              .transaction("offers")
              .objectStore("offers")
              .get("fullscreen-test");
          q.onsuccess = () => {
            resolve(q.result);
            d.close();
          };
        };
      }),
  );
}
test("jedini 2D prikaz i SVG kartice: izbor, fokus, filteri i ponovno otvaranje", async ({
  page,
}) => {
  await fixture(page, "drawer3", 8);
  await expect(page.getByRole("group", { name: "Režim prikaza" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Jednostavno", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".wall-elevation")).toHaveCount(1);
  await expect(page.getByTestId("element-card")).toHaveCount(8);
  const card = page.getByTestId("element-card").last();
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(100);
  expect((await card.boundingBox())!.height).toBeLessThanOrEqual(120);
  await expect(card.locator("[data-front=drawer]")).toHaveCount(3);
  await expect(card).not.toContainText("RSD");
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(hit(page, "D8")).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Širina", { exact: true }).fill("400");
  await save(page);
  await expect(card).toContainText("40 cm");
  await page.screenshot({
    path: "test-results/jedinstveni-2d-kartice.png",
    animations: "disabled",
  });
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(page.getByTestId("element-card").last()).toContainText("40 cm");
  await page.getByRole("button", { name: "Zid B", exact: true }).click();
  await expect(page.getByTestId("element-card")).toHaveCount(0);
});
test("landscape fullscreen: nativni API, bočni editor, 600/600/600 → 600/400/600 i trajno čuvanje", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await fixture(page);
  await enter(page);
  await expect(page.locator(".kitchen-fullscreen")).toBeVisible();
  await expect(page.locator(".app-header")).not.toBeVisible();
  await expect(page.locator(".bottom-nav")).not.toBeVisible();
  await expect(page.locator(".element-strip")).not.toBeVisible();
  await expect(page.locator(".fullscreen-rotate-hint")).not.toBeVisible();
  const native = await page.evaluate(
    () =>
      document.fullscreenElement?.classList.contains("kitchen-fullscreen") ??
      false,
  );
  console.log("Fullscreen API used:", native);
  for (const [width, height] of [
    [800, 360],
    [932, 430],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page
          .locator(".kitchen-fullscreen")
          .evaluate((e) => Math.round(e.getBoundingClientRect().width)),
      )
      .toBe(width);
    await expect
      .poll(() =>
        page
          .locator(".kitchen-fullscreen")
          .evaluate((e) => Math.round(e.getBoundingClientRect().height)),
      )
      .toBe(height);
    await page.screenshot({
      path: `test-results/fullscreen-${width}x${height}.png`,
      animations: "disabled",
    });
  }
  await hit(page, "D2").tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  const panel = (await page.getByRole("dialog").boundingBox())!;
  expect(panel.width / 844).toBeGreaterThanOrEqual(0.35);
  expect(panel.width / 844).toBeLessThanOrEqual(0.45);
  await page.getByLabel("Širina", { exact: true }).fill("400");
  await save(page);
  await expect(page.locator(".kitchen-fullscreen")).toBeVisible();
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  await expect
    .poll(async () => (await saved(page)).elements[1].width)
    .toBe(400);
  await page.screenshot({
    path: "test-results/fullscreen-landscape.png",
    animations: "disabled",
  });
  await hit(page, "D2").tap();
  await page.screenshot({
    path: "test-results/fullscreen-bocni-editor.png",
    animations: "disabled",
  });
  const before = await page.locator(".sheet-body").evaluate((e) => e.scrollTop);
  await page.locator(".sheet-body").evaluate((e) => (e.scrollTop += 200));
  expect(
    await page.locator(".sheet-body").evaluate((e) => e.scrollTop),
  ).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Zatvori", exact: true }).click();
  await exit(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".bottom-nav")).toBeVisible();
  await expect(page.getByTestId("element-card").nth(1)).toContainText("40 cm");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  const o = await saved(page);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Cena", exact: true })
    .click();
  const total = await page.getByTestId("total-price").innerText();
  expect(total).toContain(
    new Intl.NumberFormat("sr-Latn-RS", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(calculateOffer(o).total),
  );
});
test("fullscreen dodir: prevlačenje posle zumiranja i pinch-to-zoom bez slučajnog editora", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await fixture(page);
  await enter(page);
  await pinchZoom(page, ".elevation-scroll", 1.3);
  await page.locator(".elevation-scroll").evaluate((e) => (e.scrollLeft = 30));
  const from = await point(hit(page, "D3")),
    to = await point(hit(page, "D1")),
    s = await context.newCDPSession(page);
  const touch = async (
    type: "touchStart" | "touchMove" | "touchEnd",
    points: { x: number; y: number; id: number }[],
  ) =>
    s.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((p) => ({
        ...p,
        radiusX: 8,
        radiusY: 8,
        force: 1,
      })),
    });
  await touch("touchStart", [{ ...from, id: 1 }]);
  await page.waitForTimeout(520);
  await expect(page.getByTestId("drag-ghost")).toBeVisible();
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", [
      {
        x: from.x + ((to.x - 25 - from.x) * i) / 12,
        y: from.y + ((to.y - from.y) * i) / 12,
        id: 1,
      },
    ]);
    await page.waitForTimeout(18);
  }
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await touch("touchEnd", []);
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "0");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Uklopi", exact: true }).click();
  const initial = Number(
      await page.locator(".wall-elevation").getAttribute("data-scale"),
    ),
    box = (await page.locator(".elevation-scroll").boundingBox())!,
    mid = { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
  await touch("touchStart", [
    { x: mid.x - 45, y: mid.y, id: 1 },
    { x: mid.x + 45, y: mid.y, id: 2 },
  ]);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", [
      { x: mid.x - 45 - i * 4, y: mid.y, id: 1 },
      { x: mid.x + 45 + i * 4, y: mid.y, id: 2 },
    ]);
    await page.waitForTimeout(20);
  }
  await touch("touchEnd", []);
  expect(
    Number(await page.locator(".wall-elevation").getAttribute("data-scale")),
  ).toBeGreaterThan(initial * 1.3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/fullscreen-pinch.png",
    animations: "disabled",
  });
  await exit(page);
});
test("fallback bez Fullscreen API: portrait predlog, rotacija, otključavanje i vraćanje skrola", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: async () => {
        (window as any).locked = (window as any).locked + 1 || 1;
      },
    });
    Object.defineProperty(screen.orientation, "unlock", {
      configurable: true,
      value: () => {
        (window as any).unlocked = (window as any).unlocked + 1 || 1;
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, "base1", 8);
  await page.evaluate(() => scrollTo(0, 100));
  const scroll = await page.evaluate(() => scrollY);
  await enter(page);
  await expect(page.locator(".fullscreen-rotate-hint")).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(
    await page
      .locator(".kitchen-fullscreen")
      .evaluate((e) => getComputedStyle(e).transform),
  ).toBe("none");
  await page.screenshot({
    path: "test-results/fullscreen-portrait-fallback.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".fullscreen-rotate-hint")).not.toBeVisible();
  await page.getByLabel("Zid u celom ekranu").selectOption("B");
  await expect(page.locator(".elevation-hit")).toHaveCount(0);
  await page.getByLabel("Zid u celom ekranu").selectOption("A");
  await expect(page.locator(".elevation-hit")).toHaveCount(8);
  await exit(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  expect(await page.evaluate(() => (window as any).unlocked)).toBe(1);
});
test("odbijen fullscreen/orijentacija ostavlja funkcionalan viewport režim i otkazuje izlaskom", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: async () => {
        throw new DOMException("Unsupported", "NotSupportedError");
      },
    });
  });
  await fixture(page);
  await enter(page);
  await expect(page.locator(".kitchen-fullscreen")).toBeVisible();
  await expect(page.locator(".fullscreen-rotate-hint")).toBeVisible();
  await hit(page, "D2").tap();
  await page.getByLabel("Širina", { exact: true }).fill("400");
  await save(page);
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  await exit(page);
  await expect(page.locator(".kitchen-fullscreen")).toHaveCount(0);
});
test("fullscreen uređivanje i automatsko čuvanje rade offline u produkcionoj PWA aplikaciji", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:4188/");
  await expect(page.locator(".home-view")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((r) => {
      if (navigator.serviceWorker.controller) r();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        );
    });
  });
  await page.locator(".continue-project").click();
  await context.setOffline(true);
  await enter(page);
  await hit(page, "D2").tap();
  await page.getByLabel("Širina", { exact: true }).fill("400");
  await save(page);
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  await expect(page.locator(".kitchen-fullscreen")).toBeVisible();
  await exit(page);
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  await expect(page.getByTestId("element-card").nth(1)).toContainText("40 cm");
  await enter(page);
  await expect(page.locator(".kitchen-fullscreen")).toBeVisible();
  await exit(page);
  await context.setOffline(false);
});
