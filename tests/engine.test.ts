import { describe, it, expect } from "vitest";
import {
  demoElements,
  demoPrices,
  defaults,
  defaultSelection,
  newElement,
  templates,
} from "../src/core/catalog";
import {
  calculate,
  calculateOffer,
  repriceOffer,
  salePrice,
  unitPrice,
} from "../src/core/engine";
import { construct, hingesForHeight } from "../src/core/construction";
import { createOffer } from "../src/core/db";
const calc = (
  elements = demoElements(),
  sel = defaultSelection,
  prices = demoPrices,
  s = defaults,
) => calculate(elements, sel, prices, s);
describe("Konstrukcioni model", () => {
  it("računa eksplicitne panele donjeg elementa", () => {
    const r = construct(newElement("base1"), defaultSelection, defaults);
    expect(r.errors).toEqual([]);
    expect(r.panels.find((p) => p.name === "Dno")).toMatchObject({
      width: 564,
      height: 560,
      quantity: 1,
    });
    expect(
      r.panels.find((p) => p.name === "Gornja vezna letva")?.quantity,
    ).toBe(2);
    expect(r.panels.find((p) => p.name === "Front vrata 1")).toMatchObject({
      width: 596,
      height: 716,
    });
  });
  it("računa proverenu površinu panela i kant trake", () => {
    const r = calc([newElement("base1")]);
    expect(r.area).toBeCloseTo(2.3957, 5);
    expect(r.edge).toBeCloseTo(6.32, 5);
  });
  it("promena širine 600 na 800 menja panele, kant i cenu", () => {
    const e = newElement("base1"),
      a = calc([e]),
      b = calc([{ ...e, width: 800 }]);
    expect(b.area).toBeGreaterThan(a.area);
    expect(b.edge).toBeGreaterThan(a.edge);
    expect(b.total).toBeGreaterThan(a.total);
    expect(b.elements[0].panels.find((p) => p.name === "Dno")?.width).toBe(764);
  });
  it("količina množi potrošnju i okove", () => {
    const e = newElement("drawer3"),
      a = calc([e]),
      b = calc([{ ...e, quantity: 2 }]);
    expect(b.area).toBeCloseTo(a.area * 2);
    expect(b.slideCount).toBe(6);
    expect(b.edge).toBeCloseTo(a.edge * 2);
  });
  it.each([
    [900, 2],
    [901, 3],
    [1600, 3],
    [1601, 4],
    [2000, 4],
    [2001, 5],
  ])("visina fronta %i daje %i šarki", (h, n) =>
    expect(hingesForHeight(h)).toBe(n),
  );
  it("broj kompleta klizača jednak je broju fioka", () => {
    expect(
      calc([
        newElement("drawer2"),
        newElement("drawer3"),
        newElement("drawer4"),
      ]).slideCount,
    ).toBe(9);
  });
  it("sudopera nema leđa a rerna nema front ni šarke", () => {
    const sink = calc([newElement("sink")]),
      oven = calc([newElement("oven")]);
    expect(sink.elements[0].panels.some((p) => p.name === "Leđa")).toBe(false);
    expect(oven.hingeCount).toBe(0);
    expect(
      oven.elements[0].panels.some(
        (p) => p.material === defaultSelection.front,
      ),
    ).toBe(false);
  });
  it("svaki podržani šablon prolazi sa standardnim dimenzijama", () => {
    for (const t of templates.filter((t) => !t.unsupported))
      expect(calc([newElement(t.kind)]).errors, t.name).toEqual([]);
  });
  it.skip("ne podržava precizan ugaoni element", () =>
    expect(calc([newElement("corner")]).errors.length).toBeGreaterThan(0));
  it("odbija nemoguće dimenzije fioke i prevelike količine", () => {
    expect(
      calc([{ ...newElement("drawer4"), height: 80 }]).errors.length,
    ).toBeGreaterThan(0);
    expect(
      calc([{ ...newElement("base1"), quantity: 101 }]).errors.length,
    ).toBeGreaterThan(0);
  });
});
describe("Trenutna optimizacija", () => {
  it("demo ima 6 klizača: premium u ekonomične tačno −30.600 trošak / −38.250 prodajna", () => {
    const a = calc(),
      b = calc(demoElements(), { ...defaultSelection, slide: "slide-economy" });
    expect(a.slideCount).toBe(6);
    expect(a.hardware - b.hardware).toBe(30600);
    expect(a.total - b.total).toBe(38250);
    expect(a.material).toBe(b.material);
  });
  it("12 klizača menja nabavni trošak za tačno 61.200", () => {
    const e = { ...newElement("drawer3"), quantity: 4 };
    expect(
      calc([e]).hardware -
        calc([e], { ...defaultSelection, slide: "slide-economy" }).hardware,
    ).toBe(61200);
  });
  it("promena klizača ne menja ormare bez fioka", () => {
    const e = [newElement("base1"), newElement("tall"), newElement("oven")];
    expect(calc(e).total).toBe(
      calc(e, { ...defaultSelection, slide: "slide-economy" }).total,
    );
  });
  it("zaključan element zadržava svoj model", () => {
    const e = newElement("drawer3");
    e.locked = true;
    const a = calc([e]),
      b = calc([e], {
        ...defaultSelection,
        slide: "slide-economy",
        front: "front-univer",
      });
    expect(b.total).toBe(a.total);
  });
  it("mešani zaključani i slobodni fiokari: menja samo slobodni", () => {
    const e = newElement("drawer3");
    e.locked = true;
    const list = [e, newElement("drawer3")];
    expect(
      calc(list).hardware -
        calc(list, { ...defaultSelection, slide: "slide-economy" }).hardware,
    ).toBe(15300);
  });
  it("front MDF u univer menja samo materijal i prodajnu cenu", () => {
    const e = [newElement("base1")],
      a = calc(e),
      b = calc(e, { ...defaultSelection, front: "front-univer" });
    expect(a.hardware).toBe(b.hardware);
    expect(a.area).toBe(b.area);
    expect(a.material - b.material).toBeCloseTo(
      0.596 * 0.716 * 1.1 * (6200 - 2400),
      2,
    );
  });
  it("GOLA zasebno obračunava profile, završetke i konstrukcione letve", () => {
    const c = calc([newElement("drawer3")], {
      ...defaultSelection,
      opening: "gola",
    });
    expect(c.errors).toEqual([]);
    expect(c.usage.find((u) => u.product.id === "gola")?.quantity).toBeCloseTo(
      1.8,
    );
    expect(c.usage.find((u) => u.product.id === "gola-end")?.quantity).toBe(6);
    expect(c.handleCount).toBe(0);
    expect(
      c.elements[0].panels.find((p) => p.name === "GOLA konstrukciona letva")
        ?.quantity,
    ).toBe(3);
  });
  it.skip("GOLA za visoki ormar blokira precizan obračun, zaključane ručke su podržane", () => {
    const e = newElement("tall");
    expect(
      calc([e], { ...defaultSelection, opening: "gola" }).errors.length,
    ).toBeGreaterThan(0);
    e.locked = true;
    expect(calc([e], { ...defaultSelection, opening: "gola" }).errors).toEqual(
      [],
    );
  });
});
describe("Cene i profit", () => {
  it("snimak cena ostaje nepromenjen, eksplicitno preračunavanje menja iznos", () => {
    const o = createOffer(true),
      old = calculateOffer(o).total,
      prices = demoPrices.map((p) =>
        p.id === "front-mdf" ? { ...p, price: p.price + 1000 } : p,
      );
    expect(calculateOffer(o).total).toBe(old);
    const revised = repriceOffer(o, prices);
    expect(calculateOffer(revised).total).toBeGreaterThan(old);
    prices[0].price = 1;
    expect(revised.prices[0].price).not.toBe(1);
    expect(calculateOffer(o).total).toBe(old);
  });
  it("20% marže dává 125, 20% doplate daje 120", () => {
    expect(salePrice(100, { ...defaults, margin: 20 })).toBe(125);
    expect(
      salePrice(100, { ...defaults, profitMode: "markup", markup: 20 }),
    ).toBe(120);
  });
  it("EUR konverzija koristi samo ručni kurs", () => {
    expect(
      unitPrice(
        { ...demoPrices[0], currency: "EUR", price: 10 },
        { ...defaults, eurRate: 117 },
        "area",
      ),
    ).toBe(1170);
  });
  it("cena po tabli se deli sa eksplicitnom površinom, cele table se odvojeno obračunavaju", () => {
    const prices = demoPrices.map((p) =>
      p.id === "body-white"
        ? {
            ...p,
            unit: "tabla" as const,
            price: 11592,
            sheetWidth: 2800,
            sheetHeight: 2070,
          }
        : p,
    );
    expect(unitPrice(prices[0], defaults, "area")).toBeCloseTo(2000);
    const a = calc([newElement("base1")], defaultSelection, prices),
      b = calc([newElement("base1")], defaultSelection, prices, {
        ...defaults,
        purchaseMode: "sheets",
      });
    const u = b.usage.find((u) => u.product.id === "body-white")!;
    expect(u.sheets).toBe(1);
    expect(u.cost).toBe(11592);
    expect(b.material).toBeGreaterThan(a.material);
  });
  it("odbija panel koji ne staje na tablu", () => {
    const prices = demoPrices.map((p) =>
      p.id === "body-white"
        ? {
            ...p,
            unit: "tabla" as const,
            price: 1000,
            sheetWidth: 500,
            sheetHeight: 500,
          }
        : p,
    );
    expect(
      calc([newElement("base1")], defaultSelection, prices).errors.some((x) =>
        x.includes("ne staje"),
      ),
    ).toBe(true);
  });
  it("odvojeno uračunava cenu lakiranja po m²", () => {
    const p = demoPrices.find((p) => p.id === "front-lacquer")!;
    expect(unitPrice(p, defaults, "area")).toBe(10300);
  });
  it("promena cene rada koristi cenovnik", () => {
    const a = calc(),
      prices = demoPrices.map((p) =>
        p.id === "labor-assembly" ? { ...p, price: p.price + 800 } : p,
      ),
      b = calc(demoElements(), defaultSelection, prices);
    expect(b.total - a.total).toBe(1000);
  });
});
