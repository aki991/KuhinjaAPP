import { describe, expect, it } from "vitest";
import {
  libraryGroups,
  libraryTemplates,
  newElement,
  demoPrices,
  defaults,
  defaultSelection,
} from "../src/core/catalog";
import { construct } from "../src/core/construction";
import { calculateOffer, onlyUnsupportedErrors, rsd } from "../src/core/engine";
import { createOffer } from "../src/core/db";
import {
  appendPlacement,
  defaultLayout,
  laneOf,
  packLayout,
} from "../src/core/layout";
import {
  columns,
  guessMapping,
  validateRows,
  type Mapping,
} from "../src/core/importer";
import referenceCatalog from "../src/core/reference-catalog";

describe("proširena biblioteka", () => {
  it("zadržava postojeće tipove i dodaje 92 tipa iz priložene biblioteke", () => {
    expect(libraryGroups).toEqual([
      "Donji",
      "Viseći",
      "Visoki",
      "Most",
      "Ostrvski",
      "Dodaci",
    ]);
    expect(libraryTemplates.length + 1).toBe(141); // Razmak je posebna stavka rasporeda.
    expect(new Set(libraryTemplates.map((t) => t.kind)).size).toBe(140);
    expect(
      libraryTemplates.filter((t) => t.kind.startsWith("reference")),
    ).toHaveLength(92);
    expect(libraryTemplates.filter((t) => t.group === "Donji")).toHaveLength(
      42,
    );
    expect(libraryTemplates.filter((t) => t.group === "Viseći")).toHaveLength(
      32,
    );
    expect(libraryTemplates.filter((t) => t.group === "Most")).toHaveLength(
      10,
    );
    expect(libraryTemplates.filter((t) => t.group === "Visoki")).toHaveLength(
      29,
    );
  });
  it.skip("podržane varijante imaju odgovarajuću formulu, ostale blokiraju preciznu cenu", () => {
    const right = newElement("base1Right"),
      left = newElement("base1");
    expect(right.visual?.hinge).toBe("right");
    expect(
      construct(right, defaultSelection, defaults, demoPrices).panels,
    ).toEqual(construct(left, defaultSelection, defaults, demoPrices).panels);
    const sink = newElement("sinkOne");
    expect(
      construct(sink, defaultSelection, defaults, demoPrices).panels.filter(
        (p) => p.name.startsWith("Front vrata"),
      ),
    ).toHaveLength(1);
    const mixed = newElement("drawer2Door");
    const unsupported = construct(
      mixed,
      defaultSelection,
      defaults,
      demoPrices,
    );
    expect(unsupported.panels).toEqual([]);
    expect(unsupported.errors[0]).toContain("Precizan obračun nije dostupan");
    const offer = createOffer();
    offer.elements = [mixed];
    offer.layout = defaultLayout("Prava kuhinja", 3000);
    offer.elements[0].placement = appendPlacement([], mixed, "A", offer.layout);
    const calc = calculateOffer(offer);
    expect(calc.errors.length).toBeGreaterThan(0);
    expect(calc.elements[0].cost).toBe(0);
    expect(onlyUnsupportedErrors(offer)).toBe(true);
  });
  it.skip("svih 92 crteža imaju posebne lokalne tipove, dimenzije i bezbedne SVG oblike", () => {
    expect(referenceCatalog).toHaveLength(92);
    for (const reference of referenceCatalog) {
      const template = libraryTemplates.find((t) => t.kind === reference.kind)!;
      expect(template).toBeDefined();
      expect(newElement(template.kind)).toMatchObject({
        width: reference.width,
        height: reference.height,
        depth: reference.depth,
      });
      expect(reference.art.tag).toBe("svg");
      expect(reference.art.children?.length).toBeGreaterThan(0);
      expect(JSON.stringify(reference.art)).not.toMatch(
        /<script|javascript:|https?:\/\//i,
      );
      if (template.unsupported)
        expect(
          construct(
            newElement(template.kind),
            defaultSelection,
            defaults,
            demoPrices,
          ).errors.join(),
        ).toContain("Precizan obračun nije dostupan");
    }
    for (const [kind, original] of [
      ["reference001", "base1"],
      ["reference004", "drawer2"],
      ["reference007", "drawer3"],
      ["reference008", "drawer4"],
      ["reference029", "wall1"],
      ["reference032", "open"],
      ["reference065", "tall"],
    ] as const) {
      const reference = newElement(kind),
        canonical = { ...reference, kind: original };
      expect(
        construct(reference, defaultSelection, defaults, demoPrices),
      ).toEqual(construct(canonical, defaultSelection, defaults, demoPrices));
    }
    expect(newElement("reference029").shelves).toBe(1);
    expect(newElement("reference032").shelves).toBe(1);
    expect(newElement("reference062").shelves).toBe(5);
    expect(newElement("reference062").doors).toBe(2);
    expect(construct(newElement("reference062"), defaultSelection, defaults, demoPrices).errors.join()).toContain("Precizan obračun nije dostupan");
    expect(newElement("reference065").shelves).toBe(4);
  });
  it("novi tipovi se slažu zasebno po redu bez promene dimenzija", () => {
    const lower = newElement("base1Right"),
      upper = newElement("wall1Right"),
      tall = newElement("tallPantry");
    const layout = defaultLayout("Prava kuhinja", 3000);
    for (const item of [lower, upper, tall])
      item.placement = appendPlacement(
        [lower, upper, tall].filter((e) => e.placement),
        item,
        "A",
        layout,
      );
    const packed = packLayout([lower, upper, tall], layout);
    expect(laneOf(upper)).toBe("wall");
    expect(laneOf(tall)).toBe("base");
    expect(packed.elements[2].placement?.offset).toBe(lower.width);
    expect(packed.elements[1].placement?.offset).toBe(0);
    expect(packed.elements.map((e) => e.width)).toEqual([600, 600, 600]);
  });
});

describe("cenovnik dobavljača", () => {
  const mapping = Object.fromEntries(columns.map((c) => [c, c])) as Mapping;
  const row = {
    Šifra: "A-1",
    Naziv: "Univer",
    Proizvođač: "Proizvođač A",
    Kategorija: "body",
    Dobavljač: "Dobavljač A",
    "Jedinica mere": "m²",
    Cena: 2000,
    Valuta: "RSD",
    "PDV (%)": 20,
    "Rabat (%)": 10,
    Širina: 2800,
    Visina: 2070,
    Dubina: 18,
  };
  it("učitava proširene kolone, računa PDV i rabat i daje razliku pre potvrde", () => {
    const existing = [
      { ...demoPrices[0], code: "A-1", supplier: "Dobavljač A", price: 1800 },
    ];
    const result = validateRows([row], mapping, existing);
    expect(result.errors).toEqual([]);
    expect(result.valid[0]).toMatchObject({
      id: existing[0].id,
      manufacturer: "Proizvođač A",
      width: 2800,
      height: 2070,
      depth: 18,
      vatRate: 20,
      discountRate: 10,
    });
    expect(result.priceChanges).toMatchObject([
      { oldPrice: 1800, newPrice: 2000 },
    ]);
    expect(rsd(result.valid[0], defaults)).toBe(2160);
    expect(rsd(demoPrices[0], defaults)).toBe(demoPrices[0].price);
  });
  it("odbija nerealne procente i prepoznaje druga zaglavlja", () => {
    expect(
      validateRows([{ ...row, "Rabat (%)": 120 }], mapping, []).errors[0],
    ).toContain("Rabat");
    expect(guessMapping(["SKU", "PDV", "Rabat", "Proizvodjac"])).toMatchObject({
      Šifra: "SKU",
      "PDV (%)": "PDV",
      "Rabat (%)": "Rabat",
      Proizvođač: "Proizvodjac",
    });
  });
});
