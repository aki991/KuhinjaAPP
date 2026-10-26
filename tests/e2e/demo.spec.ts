import { test, expect, type Page } from "@playwright/test";
const value = (s: string) =>
  Number(
    s
      .replace(/RSD/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/\s/g, ""),
  );
const nav = async (page: Page, name: string) => {
  const settings = page.getByRole("dialog", {
    name: "Podešavanja i rezervne kopije",
    exact: true,
  });
  if (name === "Cenovnik") {
    if (!(await settings.isVisible()))
      await page
        .locator(".app-header")
        .getByRole("button", { name: "Podešavanja", exact: true })
        .click();
    await settings.getByRole("tab", { name: "Cenovnik", exact: true }).click();
    return;
  }
  if (await settings.isVisible())
    await settings
      .getByRole("button", { name: "Zatvori", exact: true })
      .click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
};
async function openKitchen(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Vaše kuhinje" }),
  ).toBeVisible();
  await page.locator(".continue-project").click();
  await expect(page.locator(".kitchen-view")).toBeVisible();
}
async function optimize(page: Page) {
  await nav(page, "Cena");
  await page
    .getByRole("button", { name: "Promeni materijale i okove", exact: true })
    .click();
}
const choice = (page: Page, group: string, name: string) =>
  page
    .getByRole("group", { name: group, exact: true })
    .getByRole("button", { name, exact: true })
    .click();
const capture = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/redizajn-${name}.png`,
    fullPage: false,
    animations: "disabled",
  });

test("glavni scenario: iste cene, optimizacija, varijante, cenovnik, čuvanje i PDF", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".home-view")).not.toContainText("RSD");
  await capture(page, "pocetna");
  await page.locator(".continue-project").click();
  await expect(page.locator(".kitchen-view")).not.toContainText("RSD");
  await expect(page.getByTestId("total-price")).toHaveCount(0);
  await capture(page, "kuhinja");
  await nav(page, "Cena");
  const initial = value(await page.getByTestId("total-price").innerText());
  expect(initial).toBe(239118.06);
  await capture(page, "cena");
  await page
    .getByRole("button", { name: "Promeni materijale i okove" })
    .click();
  await page
    .getByRole("button", { name: "Sačuvaj varijantu", exact: true })
    .click();
  await page.getByLabel("Naziv varijante").fill("Premium");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj varijantu", exact: true })
    .click();
  await choice(page, "Klizači", "Ekonomični");
  expect(
    initial - value(await page.getByTestId("total-price").innerText()),
  ).toBe(38250);
  await expect(page.getByTestId("price-difference")).toContainText("38.250");
  await capture(page, "optimizacija");
  const economy = value(await page.getByTestId("total-price").innerText());
  await choice(page, "Frontovi", "Univer");
  expect(value(await page.getByTestId("total-price").innerText())).toBeLessThan(
    economy,
  );
  const fronts = value(await page.getByTestId("total-price").innerText());
  await choice(page, "Šarke", "Osnovne");
  expect(value(await page.getByTestId("total-price").innerText())).toBeLessThan(
    fronts,
  );
  await page
    .getByRole("button", { name: "Sačuvaj varijantu", exact: true })
    .click();
  await page.getByLabel("Naziv varijante").fill("Ekonomična");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj varijantu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Uporedi varijante", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Razlika ukupne cene");
  await capture(page, "poredjenje");
  await page.getByRole("button", { name: "Zatvori", exact: true }).click();
  await page.getByText("Sačuvane varijante (2)", { exact: true }).click();
  await page
    .locator(".variant-row")
    .filter({ hasText: "Premium" })
    .getByRole("button", { name: "Primeni" })
    .click();
  expect(value(await page.getByTestId("total-price").innerText())).toBe(
    initial,
  );
  await page.getByRole("button", { name: "Nazad na cenu" }).click();
  await page
    .getByRole("button", { name: "Sačuvaj ponudu", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Projekat sačuvan");
  await nav(page, "Cenovnik");
  await page.getByRole("button", { name: /MDF • Mat kašmir/ }).click();
  await page.getByLabel("Nabavna cena").fill("7200");
  await page.getByRole("button", { name: "Sačuvaj artikal" }).click();
  await nav(page, "Cena");
  expect(value(await page.getByTestId("total-price").innerText())).toBe(
    initial,
  );
  await page.getByText("Opcije obračuna i ponude", { exact: true }).click();
  await page
    .getByRole("button", { name: "Preračunaj po novom cenovniku", exact: true })
    .click();
  await page.getByRole("button", { name: "Potvrdi novi obračun" }).click();
  const repriced = value(await page.getByTestId("total-price").innerText());
  expect(repriced).toBeGreaterThan(initial);
  await page
    .getByRole("button", { name: "Sačuvaj ponudu", exact: true })
    .first()
    .click();
  await expect(page.locator(".toast")).toContainText("Projekat sačuvan");
  await page.reload();
  await nav(page, "Cena");
  expect(value(await page.getByTestId("total-price").innerText())).toBe(
    repriced,
  );
  await page
    .getByRole("button", { name: "Ponuda za mušteriju", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ponuda", exact: true }),
  ).toBeInViewport();
  await expect(page.getByTestId("total-price")).toBeInViewport();
  await expect(page.locator(".price-view")).not.toContainText("Marža");
  await expect(page.locator(".cost-categories")).toHaveCount(0);
  await capture(page, "ponuda");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Napravi PDF" }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await pdf.saveAs("test-results/ponuda-redizajn.pdf");
  expect(errors).toEqual([]);
});

test("dimenzije menjaju šemu, individualni izbor ostaje zaključan", async ({
  page,
}) => {
  await openKitchen(page);
  await page.locator('.elevation-hit[aria-label^="D2,"]').click();
  await page.getByLabel("Širina", { exact: true }).fill("800");
  await page.getByLabel("Zadrži moj izbor").check();
  await capture(page, "izmena-elementa");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(
    page.locator('.elevation-hit[aria-label^="D2,"]'),
  ).toHaveAttribute("data-width", "800");
  await expect(page.getByTestId("total-price")).toHaveCount(0);
  await optimize(page);
  const before = value(await page.getByTestId("total-price").innerText());
  await choice(page, "Klizači", "Ekonomični");
  expect(
    before - value(await page.getByTestId("total-price").innerText()),
  ).toBe(19125);
});

test("Excel povratni uvoz i CSV ručno mapiranje", async ({ page }) => {
  await page.goto("/");
  await nav(page, "Cenovnik");
  await capture(page, "cenovnik");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Preuzmi primer Excel fajla" })
    .click();
  const excel = await download;
  expect(excel.suggestedFilename()).toBe("Primer-cenovnika.xlsx");
  await excel.saveAs("test-results/primer-cenovnika.xlsx");
  await page
    .locator('input[type=file][accept=".xlsx,.csv"]')
    .setInputFiles("test-results/primer-cenovnika.xlsx");
  await expect(page.getByText("28 validnih artikala")).toBeVisible();
  await capture(page, "uvoz");
  await page
    .getByRole("button", { name: "Potvrdi uvoz · 28 artikala" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Uvoz cenovnika", exact: true }),
  ).toHaveCount(0);
  await page.locator('input[type=file][accept=".xlsx,.csv"]').setInputFiles({
    name: "cenovnik.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Code;Naziv;Kategorija;Dobavljač;Jedinica mere;Cena;Valuta;Napomena\nTEST-001;Univer novi;body;Drugi dobavljač;m²;2000;RSD;Test",
    ),
  });
  await page
    .getByRole("dialog", { name: "Uvoz cenovnika", exact: true })
    .getByRole("combobox", { name: "Šifra", exact: true })
    .selectOption("Code");
  await expect(page.getByText("1 validnih artikala")).toBeVisible();
  await page.getByRole("button", { name: "Potvrdi uvoz · 1 artikala" }).click();
  await expect(page.getByRole("button", { name: /Univer novi/ })).toBeVisible();
});

test("mobilni ekrani 360×800, 390×844 i 430×932: bez prelivanja i sitnih kontrola", async ({
  page,
}) => {
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await openKitchen(page);
    await page
      .getByRole("button", { name: "Dodaj element", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Dodaj element", exact: true }),
    ).toBeInViewport();
    await capture(page, `kuhinja-${width}`);
    for (const screen of ["Kuhinja", "Cena", "Cenovnik", "Izgled", "Početna"]) {
      await nav(page, screen);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const small = await page
        .locator("button,input,select,textarea")
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => {
              const e = n as HTMLElement;
              return (
                e.getClientRects().length &&
                getComputedStyle(e).visibility !== "hidden" &&
                (e.textContent?.trim() || e.tagName !== "BUTTON") &&
                parseFloat(getComputedStyle(e).fontSize) < 14
              );
            })
            .map((n) => (n as HTMLElement).outerHTML.slice(0, 180)),
        );
      expect(small).toEqual([]);
      const fields = await page
        .locator("input:not([type=checkbox]):not([type=file]),select,textarea")
        .evaluateAll(
          (nodes) =>
            nodes.filter(
              (n) =>
                (n as HTMLElement).getClientRects().length &&
                parseFloat(getComputedStyle(n).fontSize) < 16,
            ).length,
        );
      expect(fields).toBe(0);
      await capture(page, `${screen.toLowerCase()}-${width}`);
      if (screen === "Cena") {
        const action = await page
          .getByRole("button", {
            name: "Promeni materijale i okove",
            exact: true,
          })
          .boundingBox();
        const navigation = await page.locator(".bottom-nav").boundingBox();
        expect(action!.y + action!.height).toBeLessThanOrEqual(navigation!.y);
      }
    }
    await optimize(page);
    await choice(page, "Klizači", "Ekonomični");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await capture(page, `optimizacija-${width}`);
    const opening = await page
      .getByRole("group", { name: "Otvaranje donjih", exact: true })
      .getByRole("button", { name: "Ručke", exact: true })
      .boundingBox();
    const navigation = await page.locator(".bottom-nav").boundingBox();
    expect(opening!.y + opening!.height).toBeLessThanOrEqual(navigation!.y);
  }
});

test("desktop početna i radni ekran", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openKitchen(page);
  await capture(page, "desktop-kuhinja");
  await page
    .locator(".desktop-sidebar")
    .getByRole("button", { name: "Početna", exact: true })
    .click();
  await capture(page, "desktop-pocetna");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("nova kuhinja: dužina, dodavanje, dupliranje, redosled, zid i ponovno otvaranje", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nova kuhinja", exact: true }).click();
  await page.getByLabel("Naziv projekta").fill("Nova kuhinja test");
  await page.getByLabel("Dužina zida (mm)").fill("2400");
  await page
    .getByRole("combobox", { name: "Tip kuhinje", exact: true })
    .selectOption("L kuhinja");
  await page.getByRole("button", { name: "Dodaj elemente" }).click();
  await expect(page.locator(".wall-length")).toContainText("240");
  await page
    .getByRole("button", { name: "Dodaj element", exact: true })
    .click();
  await capture(page, "biblioteka");
  await page
    .getByRole("button", { name: "Jedna vrata — levo", exact: true })
    .click();
  await page.getByLabel("Širina", { exact: true }).fill("800");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(page.getByTestId("element-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Izmeni D1", exact: true }).click();
  await page.getByRole("button", { name: "Dupliraj", exact: true }).click();
  await expect(page.getByTestId("element-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Izmeni D2" }).click();
  await page.getByRole("button", { name: "Pomeri D2 levo" }).click();
  expect(
    await page
      .locator('.elevation-hit[aria-label^="D2,"]')
      .evaluate((e) => parseFloat((e as HTMLElement).style.left)),
  ).toBe(0);
  await page.locator('.elevation-hit[aria-label^="D2,"]').click();
  await page.getByText("Dodatna podešavanja", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Zid / grupa", exact: true })
    .selectOption("B");
  await page.getByLabel("Mesto u redu").fill("1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(page.getByTestId("element-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Zid B", exact: true }).click();
  await expect(page.getByTestId("element-card")).toContainText("80 cm");
  await expect(page.locator(".elevation-hit")).toHaveCount(1);
  expect(
    await page
      .locator(".elevation-hit")
      .evaluate((e) => parseFloat((e as HTMLElement).style.left)),
  ).toBe(0);
  await page.getByRole("button", { name: "Sačuvaj projekat" }).click();
  await expect(page.locator(".toast")).toContainText("Projekat sačuvan");
  await page.reload();
  await page.locator(".continue-project").click();
  await expect(
    page.getByRole("heading", { name: "Nova kuhinja test" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zid B", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("element-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Izmeni D2" }).click();
  await page.getByRole("button", { name: "Obriši D2" }).click();
  await expect(page.getByTestId("element-card")).toHaveCount(0);
  await expect(page.getByTestId("total-price")).toHaveCount(0);
});

test("produkcioni PWA: manifest, offline ponovno učitavanje, optimizacija i PDF", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:4188/");
  await expect(
    page.getByRole("heading", { name: "Vaše kuhinje" }),
  ).toBeVisible();
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
  const manifest = await page.request.get(
    "http://localhost:4188/manifest.webmanifest",
  );
  expect((await manifest.json()).icons.length).toBeGreaterThanOrEqual(2);
  await page.locator(".continue-project").click();
  await nav(page, "Cena");
  const total = value(await page.getByTestId("total-price").innerText());
  await context.setOffline(true);
  await page.reload();
  await nav(page, "Kuhinja");
  await expect(page.locator(".kitchen-view")).not.toContainText("RSD");
  await nav(page, "Cena");
  expect(value(await page.getByTestId("total-price").innerText())).toBe(total);
  await page
    .getByRole("button", { name: "Promeni materijale i okove" })
    .click();
  await choice(page, "Klizači", "Ekonomični");
  expect(total - value(await page.getByTestId("total-price").innerText())).toBe(
    38250,
  );
  await page.getByRole("button", { name: "Nazad na cenu" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Napravi PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await context.setOffline(false);
});

test("zid: ručna dužina, upozorenje prekoračenja i posebna grupa ostrva", async ({
  page,
}) => {
  await openKitchen(page);
  await page.getByRole("button", { name: "Izmeni dužinu zida" }).click();
  await page.getByLabel("Dužina zida (mm)").fill("3000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("prelaze zid za 80 cm");
  await page.getByRole("button", { name: "Dodaj zid ili ostrvo" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ostrvo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ostrvo", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".wall-measure")).toContainText("Slobodno 300 cm");
  await page
    .getByRole("button", { name: "Dodaj element", exact: true })
    .click();
  await page.getByRole("button", { name: "Ostrvski", exact: true }).click();
  await page
    .getByRole("button", { name: "Ostrvski element sa vratima", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sačuvaj", exact: true })
    .click();
  await expect(page.locator(".elevation-hit")).toHaveCount(1);
  await expect(page.locator(".wall-measure")).toContainText("Zauzeto 90 cm");
});
