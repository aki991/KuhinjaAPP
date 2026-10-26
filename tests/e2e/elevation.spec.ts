import {
  test,
  expect,
  type Page,
  type Locator,
  type CDPSession,
} from "@playwright/test";
import type { Offer } from "../../src/core/types";
const nav = (page: Page, name: string) =>
  page
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
const mode = (page: Page, _name = "2D prikaz") =>
  expect(page.locator(".wall-elevation")).toBeVisible();
const hit = (page: Page, code: string) =>
  page.locator(`.elevation-hit[aria-label^="${code},"]`).first();
const save = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
async function draft(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Offer>((resolve, reject) => {
        const r = indexedDB.open("KuhinjaKalkulator");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const database = r.result,
            q = database.transaction("meta").objectStore("meta").get("draft");
          q.onsuccess = () => {
            resolve(q.result.value);
            database.close();
          };
          q.onerror = () => reject(q.error);
        };
      }),
  );
}
async function openDemo(page: Page, url = "/") {
  await page.goto(url);
  await page.locator(".continue-project").click();
  await expect(page.locator(".kitchen-view")).toBeVisible();
}
async function fresh(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova kuhinja", exact: true }).click();
  await page.getByLabel("Naziv projekta").fill("2D scenario");
  await page.getByLabel("Dužina zida (mm)").fill("2400");
  await page
    .getByRole("combobox", { name: "Tip kuhinje", exact: true })
    .selectOption("L kuhinja");
  await page.getByRole("button", { name: "Dodaj elemente" }).click();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Dodaj element", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Jedna vrata — levo", exact: true })
      .click();
    await save(page);
  }
  await mode(page);
  await expect(hit(page, "D3")).toBeVisible();
}
async function point(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function touch(
  s: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  p = { x: 0, y: 0 },
) {
  await s.send("Input.dispatchTouchEvent", {
    type,
    touchPoints:
      type === "touchEnd"
        ? []
        : [{ ...p, radiusX: 8, radiusY: 8, force: 1, id: 1 }],
  });
}
async function slide(
  s: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  for (let i = 1; i <= 10; i++) {
    await touch(s, "touchMove", {
      x: from.x + ((to.x - from.x) * i) / 10,
      y: from.y + ((to.y - from.y) * i) / 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

test("jedini 2D režim: isti podaci, čitljive kote i mobilni snimci", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openDemo(page);
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await mode(page, "Jednostavno");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/2d-jednostavno-${width}.png`,
      animations: "disabled",
    });
    const initial = await draft(page);
    const simple = await page.locator(".elevation-hit").evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: (n as HTMLElement).dataset.elementId,
        x: Number((n as HTMLElement).dataset.offset),
        width: Number((n as HTMLElement).dataset.width),
      })),
    );
    await mode(page);
    await expect(page.locator(".wall-elevation")).toBeVisible();
    expect(await draft(page)).toEqual(initial);
    for (const e of simple) {
      await expect(
        page.locator(`[data-technical-id="${e.id}"]`).first(),
      ).toHaveAttribute("data-mm-x", String(e.x));
      await expect(
        page.locator(`[data-technical-id="${e.id}"]`).first(),
      ).toHaveAttribute("data-mm-width", String(e.width));
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".wall-elevation text")
        .evaluateAll((nodes) =>
          nodes.every((n) => parseFloat(getComputedStyle(n).fontSize) >= 14),
        ),
    ).toBe(true);
    await expect(page.locator(".kitchen-view")).not.toContainText("RSD");
    await page.screenshot({
      path: `test-results/2d-elevacija-${width}.png`,
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(page.getByRole("group", { name: "Režim prikaza" })).toHaveCount(
    0,
  );
  await expect(page.locator(".wall-elevation")).toBeVisible();
  expect(errors).toEqual([]);
});

test("2D izmena širine, prepakivanje, dupliranje i brisanje ažuriraju kartice", async ({
  page,
}) => {
  await fresh(page);
  await hit(page, "D2").tap();
  await page.getByLabel("Širina", { exact: true }).fill("400");
  await save(page);
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  const d2 = await hit(page, "D2").getAttribute("data-element-id");
  await expect(page.locator(`[data-technical-id="${d2}"]`)).toHaveAttribute(
    "data-mm-width",
    "400",
  );
  await mode(page, "Jednostavno");
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "1000");
  await mode(page);
  await hit(page, "D2").tap();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Dupliraj", exact: true })
    .click();
  await expect(hit(page, "D4")).toHaveAttribute("data-offset", "1600");
  await hit(page, "D2").tap();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Obriši/ })
    .click();
  await expect(hit(page, "D2")).toHaveAttribute("data-offset", "600");
  await expect(page.locator(".elevation-hit")).toHaveCount(3);
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(hit(page, "D2")).toHaveAttribute("data-offset", "600");
});

test("2D telefon: dugi pritisak, marker, redosled, zid i čuvanje", async ({
  page,
  context,
}) => {
  await fresh(page);
  const s = await context.newCDPSession(page),
    from = await point(hit(page, "D3")),
    to = await point(hit(page, "D1"));
  await touch(s, "touchStart", from);
  await page.waitForTimeout(520);
  await expect(page.getByTestId("drag-ghost")).toBeVisible();
  await slide(s, from, { x: to.x - 12, y: to.y });
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await page.screenshot({
    path: "test-results/2d-prevlacenje.png",
    animations: "disabled",
  });
  await touch(s, "touchEnd");
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "0");
  await expect(hit(page, "D1")).toHaveAttribute("data-offset", "600");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const tab = await point(page.getByRole("button", { name: "Zid B", exact: true })),
    next = await point(hit(page, "D3"));
  await touch(s, "touchStart", next);
  await page.waitForTimeout(520);
  await slide(s, next, tab);
  await page.waitForTimeout(450);
  await expect(
    page.getByRole("button", { name: "Zid B", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const row = (await page.locator("[data-drop-row=base]").boundingBox())!;
  await slide(s, tab, { x: row.x + 40, y: row.y + 20 });
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await touch(s, "touchEnd");
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "0");
  await expect(page.locator(".elevation-hit")).toHaveCount(1);
  await hit(page, "D3").tap();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Pomeri", exact: true })
    .click();
  await page.getByLabel("Zid / grupa").selectOption("A");
  await page.getByLabel("Mesto u redu").fill("2");
  await page.getByRole("button", { name: "Premesti", exact: true }).click();
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "600");
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(hit(page, "D3")).toHaveAttribute("data-offset", "600");
});

test("2D vizuelni dodaci, uređaji i staklo opstaju bez promene cene", async ({
  page,
}) => {
  await openDemo(page);
  await nav(page, "Cena");
  const price = await page.getByTestId("total-price").innerText();
  await nav(page, "Kuhinja");
  await mode(page);
  await hit(page, "D1").tap();
  await page.getByText("Izgled u 2D prikazu", { exact: true }).click();
  await page.getByLabel("Stakleni frontovi").check();
  await page.getByLabel("Smer otvaranja vrata").selectOption("right");
  await page.getByLabel("Ploča za kuvanje iznad elementa").check();
  await save(page);
  await expect(page.locator("[data-front=glass]")).not.toHaveCount(0);
  await expect(
    page.locator(".wall-elevation [data-appliance=hob]"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Otvori i mere 2D prikaza" }).click();
  await page.getByRole("button", { name: "Prozor", exact: true }).click();
  await page.getByLabel("Od početka zida (mm)").fill("100");
  await page.getByLabel("Donja ivica od poda (mm)").fill("500");
  await page.getByRole("button", { name: "Sačuvaj prikaz" }).click();
  await expect(page.locator("[data-object-kind=window]")).toHaveCount(1);
  await page.locator(".elevation-warnings summary").click();
  await expect(page.locator(".elevation-warnings")).toContainText(
    "Prozor se preklapa",
  );
  await page.screenshot({
    path: "test-results/2d-prozor-upozorenje.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await nav(page, "Cena");
  await expect(page.getByTestId("total-price")).toHaveText(price, {
    useInnerText: true,
  });
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(page.locator("[data-object-kind=window]")).toHaveCount(1);
  await expect(page.locator("[data-front=glass]")).not.toHaveCount(0);
  await expect(
    page.locator(".wall-elevation [data-appliance=hob]"),
  ).toHaveCount(1);
});

test("2D zumiranje i dodirni pokret pomeraju crtež bez prevlačenja elementa", async ({
  page,
  context,
}) => {
  await fresh(page);
  const original = Number(
    await page.locator(".wall-elevation").getAttribute("data-scale"),
  );
  await page.getByRole("button", { name: "Uvećaj 2D prikaz" }).click();
  await page.getByRole("button", { name: "Uvećaj 2D prikaz" }).click();
  await page.getByRole("button", { name: "Uvećaj 2D prikaz" }).click();
  await page.getByRole("button", { name: "Uvećaj 2D prikaz" }).click();
  expect(
    Number(await page.locator(".wall-elevation").getAttribute("data-scale")),
  ).toBeGreaterThan(original);
  const s = await context.newCDPSession(page),
    p = await point(hit(page, "D2"));
  await touch(s, "touchStart", p);
  await slide(s, p, { x: p.x - 130, y: p.y });
  await touch(s, "touchEnd");
  await expect
    .poll(() => page.locator(".elevation-scroll").evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(10);
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Uklopi", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.locator(".wall-elevation").getAttribute("data-scale")),
    )
    .toBeLessThanOrEqual(original);
  expect(
    Number(await page.locator(".wall-elevation").getAttribute("data-scale")),
  ).toBeLessThanOrEqual(original);
  await expect(page.locator(".elevation-scroll")).toHaveAttribute(
    "data-fit-all",
    "true",
  );
  expect(
    await page
      .locator(".elevation-scroll")
      .evaluate((e) => e.scrollWidth - e.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  const vertical = await point(hit(page, "D2"));
  await touch(s, "touchStart", vertical);
  await slide(s, vertical, { x: vertical.x, y: vertical.y - 180 });
  await touch(s, "touchEnd");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(30);
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
});

test("2D produkcioni PWA radi i čuva izmene offline", async ({
  page,
  context,
}) => {
  await openDemo(page, "http://localhost:4188/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) resolve();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
    });
  });
  await mode(page);
  await nav(page, "Cena");
  const price = await page.getByTestId("total-price").innerText();
  await nav(page, "Kuhinja");
  await context.setOffline(true);
  await page.reload();
  await nav(page, "Kuhinja");
  await expect(page.locator(".wall-elevation")).toBeVisible();
  await hit(page, "D1").tap();
  await page.getByText("Izgled u 2D prikazu", { exact: true }).click();
  await page.getByLabel("Smer otvaranja vrata").selectOption("right");
  await save(page);
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await nav(page, "Cena");
  await expect(page.getByTestId("total-price")).toHaveText(price, {
    useInnerText: true,
  });
  await page.reload();
  await nav(page, "Kuhinja");
  await expect(page.locator("[data-opening-side=right]")).not.toHaveCount(0);
  await context.setOffline(false);
});
