import { describe, it, expect } from "vitest";
import {
  columns,
  guessMapping,
  parseNumber,
  validateRows,
  type Mapping,
} from "../src/core/importer";
import { demoPrices } from "../src/core/catalog";
const mapping = Object.fromEntries(columns.map((c) => [c, c])) as Mapping;
const row = {
  Šifra: "NEW",
  Naziv: "Novi univer",
  Kategorija: "Korpus / pločasti materijali",
  Dobavljač: "Dobavljač B",
  "Jedinica mere": "m²",
  Cena: "1.850,50",
  Valuta: "RSD",
  Napomena: "Primer",
};
describe("Uvoz i validacija cenovnika", () => {
  it("mapira srpsku latinicu bez dijakritike", () =>
    expect(guessMapping(["Sifra", "Naziv", "Dobavljac"])["Dobavljač"]).toBe(
      "Dobavljac",
    ));
  it.each([
    ["1.850,50", 1850.5],
    ["1,850.50", 1850.5],
    ["1850,50", 1850.5],
    ["1850.50", 1850.5],
  ])("parsira %s", (a, b) => expect(parseNumber(a)).toBe(b));
  it("ne prihvata praznu cenu ili tekst", () => {
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("12abc")).toBeNaN();
  });
  it("prihvata validne podatke i RSD", () => {
    const r = validateRows([row], mapping, []);
    expect(r.errors).toEqual([]);
    expect(r.valid[0].price).toBe(1850.5);
  });
  it("odbija pogrešnu jedinicu, valutu i negativnu cenu", () => {
    expect(
      validateRows(
        [{ ...row, "Jedinica mere": "kom", Valuta: "USD", Cena: -1 }],
        mapping,
        [],
      ).errors[0],
    ).toMatch(/jedinica|zahteva/);
  });
  it("tabla zahteva obe dimenzije", () => {
    expect(
      validateRows([{ ...row, "Jedinica mere": "tabla" }], mapping, []).errors
        .length,
    ).toBe(1);
    expect(
      validateRows(
        [
          {
            ...row,
            "Jedinica mere": "tabla",
            "Širina table": 2800,
            "Visina table": 2070,
          },
        ],
        mapping,
        [],
      ).valid.length,
    ).toBe(1);
  });
  it("duplikat u fajlu blokira uvoz", () =>
    expect(validateRows([row, row], mapping, []).errors[0]).toContain(
      "duplikat",
    ));
  it("postojeći artikal istog dobavljača ažurira stabilan ID", () => {
    const p = demoPrices[0],
      r = validateRows(
        [{ ...row, Šifra: p.code, Dobavljač: p.supplier }],
        mapping,
        demoPrices,
      );
    expect(r.errors).toEqual([]);
    expect(r.duplicates.length).toBe(1);
    expect(r.valid[0].id).toBe(p.id);
  });
  it("isti materijal drugog dobavljača ima zaseban artikal", () => {
    const r = validateRows(
      [{ ...row, Šifra: demoPrices[0].code }],
      mapping,
      demoPrices,
    );
    expect(r.duplicates).toEqual([]);
    expect(r.valid[0].id).not.toBe(demoPrices[0].id);
  });
  it("klizač mora biti u kompletima a šarka po komadu", () => {
    expect(
      validateRows(
        [{ ...row, Kategorija: "slide", "Jedinica mere": "kom" }],
        mapping,
        [],
      ).errors[0],
    ).toContain("kompletu");
    expect(
      validateRows(
        [{ ...row, Kategorija: "hinge", "Jedinica mere": "komplet" }],
        mapping,
        [],
      ).errors[0],
    ).toContain("komadu");
  });
  it("uvoz novog okova dobija klasu, a MDF materijal odgovarajući tip", () => {
    const r = validateRows(
      [
        {
          ...row,
          Naziv: "Klizač Premium",
          Kategorija: "slide",
          "Jedinica mere": "komplet",
        },
        { ...row, Šifra: "MDF-X", Naziv: "MDF lakirani", Kategorija: "front" },
      ],
      mapping,
      [],
    );
    expect(r.valid[0].tier).toBe("premium");
    expect(r.valid[1].kind).toBe("lacquer");
  });
});
