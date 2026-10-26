import {
  test,
  expect,
  type Page,
  type Locator,
  type CDPSession,
} from "@playwright/test";
const card = (page: Page, code: string) =>
  page.locator(`.elevation-hit[aria-label^="${code},"]`).first();
const saveModal = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
async function clickInList(locator: Locator) {
  await locator.evaluate((e) => {
    const bottom = e.getBoundingClientRect().bottom;
    window.scrollBy(0, bottom - (innerHeight - 100));
  });
  await locator.click();
}
async function fresh(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova kuhinja", exact: true }).click();
  await page.getByLabel("Naziv projekta").fill("Slaganje test");
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
    await saveModal(page);
  }
  await expect(card(page, "D3")).toBeVisible();
}
async function offsets(page: Page) {
  return page
    .locator(".elevation-hit-row.base .elevation-hit:not(.spacer)")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        code: n.getAttribute("aria-label")!.split(",")[0],
        offset: Number((n as HTMLElement).dataset.offset),
        width: Number((n as HTMLElement).dataset.width),
      })),
    );
}
async function point(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error("Nedostaje kontrola");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function touch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  x = 0,
  y = 0,
) {
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints:
      type === "touchEnd"
        ? []
        : [{ x, y, radiusX: 8, radiusY: 8, force: 1, id: 1 }],
  });
}
async function slideTouch(
  page: Page,
  session: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
) {
  for (let i = 1; i <= steps; i++) {
    await touch(
      session,
      "touchMove",
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await page.waitForTimeout(18);
  }
}

test("600/600/600 → 600/400/600, brisanje i dodavanje bez praznine", async ({
  page,
}) => {
  await fresh(page);
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "1200");
  await card(page, "D2").click();
  await page.getByLabel("Širina", { exact: true }).fill("400");
  await saveModal(page);
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "1000");
  expect((await offsets(page)).map((e) => e.offset)).toEqual([0, 600, 1000]);
  await clickInList(page.getByRole("button", { name: "Izmeni D2" }));
  await clickInList(
    page.getByRole("button", { name: "Obriši D2", exact: true }),
  );
  await expect(card(page, "D2")).toHaveAttribute("data-offset", "600");
  await page
    .getByRole("button", { name: "Dodaj element", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Jedna vrata — levo", exact: true })
    .click();
  await saveModal(page);
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "1200");
  await page.screenshot({
    path: "test-results/slaganje-sirine.png",
    animations: "disabled",
  });
});

test("miš: prevlačenje na početak i kraj, oznaka ubacivanja i Levo/Desno", async ({
  page,
}) => {
  await fresh(page);
  const start = await point(card(page, "D3")),
    target = await point(card(page, "D1"));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x - 20, target.y, { steps: 15 });
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await page.screenshot({
    path: "test-results/slaganje-prevlacenje.png",
    animations: "disabled",
  });
  await page.mouse.up();
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "0");
  await expect(card(page, "D1")).toHaveAttribute("data-offset", "600");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await clickInList(page.getByRole("button", { name: "Izmeni D3" }));
  await clickInList(page.getByRole("button", { name: "Pomeri D3 desno" }));
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "600");
  const a = await point(card(page, "D1")),
    last = (await card(page, "D2").boundingBox())!;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width - 3, last.y + last.height / 2, {
    steps: 15,
  });
  await page.mouse.up();
  await expect(card(page, "D1")).toHaveAttribute("data-offset", "1200");
});

test("telefon: dugi pritisak, promena reda i ponovno otvaranje projekta", async ({
  page,
  context,
}) => {
  await fresh(page);
  const session = await context.newCDPSession(page),
    from = await point(card(page, "D3")),
    to = await point(card(page, "D1"));
  await touch(session, "touchStart", from.x, from.y);
  await page.waitForTimeout(520);
  await expect(page.getByTestId("drag-ghost")).toBeVisible();
  await slideTouch(page, session, from, { x: to.x - 20, y: to.y });
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await touch(session, "touchEnd");
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "0");
  await expect(card(page, "D1")).toHaveAttribute("data-offset", "600");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await expect(page.locator(".toast")).toContainText("Projekat sačuvan");
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "0");
  await expect(card(page, "D1")).toHaveAttribute("data-offset", "600");
  await card(page, "D3").tap();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("telefon: prevlačenje između zidova čuva broj i širine", async ({
  page,
  context,
}) => {
  await fresh(page);
  const session = await context.newCDPSession(page),
    tab = await point(page.getByRole("button", { name: "Zid B", exact: true })),
    from = await point(card(page, "D2"));
  await touch(session, "touchStart", from.x, from.y);
  await page.waitForTimeout(520);
  await slideTouch(page, session, from, tab);
  await page.waitForTimeout(450);
  await expect(
    page.getByRole("button", { name: "Zid B", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const row = (await page.locator("[data-drop-row=base]").boundingBox())!,
    to = { x: row.x + 45, y: row.y + 35 };
  await slideTouch(page, session, tab, to);
  await expect(page.getByTestId("drop-marker")).toBeVisible();
  await touch(session, "touchEnd");
  await expect(card(page, "D2")).toHaveAttribute("data-offset", "0");
  await expect(page.locator(".elevation-hit")).toHaveCount(1);
  await page.getByRole("button", { name: "Zid A", exact: true }).tap();
  await expect(card(page, "D3")).toHaveAttribute("data-offset", "600");
  await expect(page.locator(".elevation-hit")).toHaveCount(2);
  await expect(page.locator('.elevation-hit[data-width="600"]')).toHaveCount(2);
});

test("telefon: običan pokret skroluje stranicu i šemu bez aktiviranja prevlačenja", async ({
  page,
  context,
}) => {
  await fresh(page);
  const session = await context.newCDPSession(page),
    from = await point(card(page, "D1"));
  await touch(session, "touchStart", from.x, from.y);
  await slideTouch(page, session, from, { x: from.x, y: from.y - 210 }, 8);
  await touch(session, "touchEnd");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(40);
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Uvećaj 2D prikaz" }).click();
  const right = await point(card(page, "D3"));
  await touch(session, "touchStart", right.x, right.y);
  await slideTouch(page, session, right, { x: right.x - 170, y: right.y }, 8);
  await touch(session, "touchEnd");
  await expect
    .poll(() => page.locator(".schematic-scroll").evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(15);
  await expect(page.getByTestId("drag-ghost")).toHaveCount(0);
});

test("Razmak je nezavisan od cene i prevlači se između kompatibilnih redova", async ({
  page,
  context,
}) => {
  await fresh(page);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Cena", exact: true })
    .click();
  const total = await page.getByTestId("total-price").innerText();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Kuhinja", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Dodaj element", exact: true })
    .click();
  await page.getByRole("button", { name: "Razmak", exact: true }).click();
  await page.getByLabel("Širina razmaka (mm)").fill("200");
  await saveModal(page);
  await expect(card(page, "R1")).toBeVisible();
  await page.screenshot({
    path: "test-results/slaganje-razmak.png",
    animations: "disabled",
  });
  const session = await context.newCDPSession(page),
    from = await point(card(page, "R1"));
  await touch(session, "touchStart", from.x, from.y);
  await page.waitForTimeout(520);
  const row = (await page.locator("[data-drop-row=wall]").boundingBox())!,
    to = { x: row.x + 40, y: row.y + 15 };
  await slideTouch(page, session, from, to);
  await touch(session, "touchEnd");
  await expect(page.locator(".elevation-hit-row.wall .spacer")).toHaveCount(1);
  await expect(page.locator(".elevation-hit-row.base .spacer")).toHaveCount(0);
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Cena", exact: true })
    .click();
  await expect(page.getByTestId("total-price")).toHaveText(total, {
    useInnerText: true,
  });
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(page.locator(".elevation-hit-row.wall .spacer")).toHaveCount(1);
});

test("nekompatibilan red odbija premeštanje, a prekoračenje ostaje vidljivo", async ({
  page,
}) => {
  await fresh(page);
  const from = await point(card(page, "D1"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 4 });
  const upper = (await page.locator("[data-drop-row=wall]").boundingBox())!;
  await page.mouse.move(upper.x + 45, upper.y + 15, { steps: 15 });
  await expect(page.getByTestId("drop-marker")).toHaveClass(/invalid/);
  await page.mouse.up();
  await expect(page.getByRole("alert")).toContainText("nije kompatibilan");
  await expect(card(page, "D1")).toHaveAttribute("data-offset", "0");
  await page.getByRole("button", { name: "Izmeni dužinu zida" }).click();
  await page.getByLabel("Dužina zida (mm)").fill("1200");
  await saveModal(page);
  await expect(page.getByRole("alert")).toContainText("prelaze zid za 60 cm");
  await expect(card(page, "D3")).toHaveClass(/out-of-bounds/);
  await expect(page.locator('.elevation-hit[data-width="600"]')).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/slaganje-prekoracenje.png",
    animations: "disabled",
  });
});
test("prevlačenje na prekratak zid upozorava pre i posle ispuštanja bez smanjenja širine", async ({
  page,
  context,
}) => {
  await fresh(page);
  await page.getByRole("button", { name: "Zid B", exact: true }).click();
  await page.getByRole("button", { name: "Izmeni dužinu zida" }).click();
  await page.getByLabel("Dužina zida (mm)").fill("500");
  await saveModal(page);
  await page.getByRole("button", { name: "Zid A", exact: true }).click();
  const session = await context.newCDPSession(page),
    from = await point(card(page, "D2")),
    tab = await point(page.getByRole("button", { name: "Zid B", exact: true }));
  await touch(session, "touchStart", from.x, from.y);
  await page.waitForTimeout(520);
  await slideTouch(page, session, from, tab);
  await page.waitForTimeout(450);
  const row = (await page.locator("[data-drop-row=base]").boundingBox())!,
    to = { x: row.x + 45, y: row.y + 30 };
  await slideTouch(page, session, tab, to);
  await expect(page.getByTestId("drop-marker")).toHaveClass(/invalid/);
  await expect(page.locator(".drag-status")).toContainText(
    "Prelazi zid za 10 cm",
  );
  await touch(session, "touchEnd");
  await expect(page.getByRole("alert")).toContainText("prelaze zid za 10 cm");
  await expect(card(page, "D2")).toHaveAttribute("data-width", "600");
  await expect(card(page, "D2")).toHaveAttribute("data-offset", "0");
  await page.screenshot({
    path: "test-results/slaganje-kratak-zid.png",
    animations: "disabled",
  });
});
