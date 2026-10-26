import { categories, uid } from "./catalog";
import type { Product, Unit } from "./types";
export const columns = [
  "Šifra",
  "Naziv",
  "Kategorija",
  "Dobavljač",
  "Jedinica mere",
  "Cena",
  "Valuta",
  "Napomena",
  "Širina table",
  "Visina table",
] as const;
export type ColumnName = (typeof columns)[number];
export type Mapping = Record<ColumnName, string>;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj")
    .toLowerCase()
    .trim();
export function guessMapping(headers: string[]): Mapping {
  return Object.fromEntries(
    columns.map((c) => [
      c,
      headers.find((h) => normalize(h) === normalize(c)) || "",
    ]),
  ) as Mapping;
}
export function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  let text = String(value ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!text) return NaN;
  if (text.includes(",") && text.includes(".")) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else text = text.replace(",", ".");
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
}
export function validateRows(
  rows: Record<string, unknown>[],
  mapping: Mapping,
  existing: Product[],
) {
  const valid: Product[] = [],
    errors: string[] = [],
    duplicates: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const get = (c: ColumnName) => row[mapping[c]],
      str = (c: ColumnName) => String(get(c) ?? "").trim();
    const code = str("Šifra"),
      name = str("Naziv"),
      supplier = str("Dobavljač"),
      price = parseNumber(get("Cena")),
      currency = str("Valuta").toUpperCase();
    const rawUnit = normalize(str("Jedinica mere"));
    const units: Record<string, Unit> = {
      m2: "m²",
      "m²": "m²",
      komad: "kom",
      kom: "kom",
      metar: "m",
      m: "m",
      tabla: "tabla",
      komplet: "komplet",
    };
    const unit = units[rawUnit];
    const catText = normalize(str("Kategorija"));
    const category = Object.entries(categories).find(
      ([key, label]) =>
        normalize(key) === catText || normalize(label) === catText,
    )?.[0] as Product["category"] | undefined;
    const key = `${code.toLowerCase()}|${supplier.toLowerCase()}`;
    const prev = existing.find(
      (p) =>
        p.code.toLowerCase() === code.toLowerCase() &&
        p.supplier.toLowerCase() === supplier.toLowerCase(),
    );
    const rowErrors: string[] = [];
    if (!code || !name || !supplier)
      rowErrors.push("nedostaje šifra, naziv ili dobavljač");
    if (!Number.isFinite(price) || price < 0)
      rowErrors.push("cena mora biti nenegativan broj");
    if (!unit) rowErrors.push("nepoznata jedinica mere");
    if (!category) rowErrors.push("nepoznata kategorija");
    if (!["RSD", "EUR"].includes(currency))
      rowErrors.push("valuta mora biti RSD ili EUR");
    const sheetWidth = parseNumber(get("Širina table")),
      sheetHeight = parseNumber(get("Visina table"));
    if (unit === "tabla" && (!(sheetWidth > 0) || !(sheetHeight > 0)))
      rowErrors.push("cena po tabli zahteva širinu i visinu table u mm");
    if (unit === "tabla" && sheetWidth * sheetHeight > 30e6)
      rowErrors.push("dimenzije table su prevelike");
    const areaCats = ["body", "front", "back", "worktop"],
      meterCats = ["edge", "gola"];
    if (
      category &&
      areaCats.includes(category) &&
      unit !== "m²" &&
      unit !== "tabla"
    )
      rowErrors.push("pločasti materijal zahteva m² ili tablu");
    if (category && meterCats.includes(category) && unit !== "m")
      rowErrors.push("traka/profil zahteva metre");
    if (
      category &&
      !areaCats.includes(category) &&
      !meterCats.includes(category) &&
      category !== "labor" &&
      unit !== "kom" &&
      unit !== "komplet"
    )
      rowErrors.push("okov zahteva komad ili komplet");
    if (category && ["slide", "lift"].includes(category) && unit !== "komplet")
      rowErrors.push("klizači i podizni mehanizmi zahtevaju cenu po kompletu");
    if (
      category &&
      ["hinge", "handle", "leg", "push", "golaEnd"].includes(category) &&
      unit !== "kom"
    )
      rowErrors.push("ovaj okov zahteva cenu po komadu");
    if (seen.has(key))
      rowErrors.push("duplikat šifre i dobavljača unutar fajla");
    seen.add(key);
    if (prev && prev.unit !== unit)
      rowErrors.push(
        "jedinica se razlikuje od postojećeg artikla; koristite novu šifru",
      );
    if (prev && prev.category !== category)
      rowErrors.push(
        "kategorija se razlikuje od postojećeg artikla; koristite novu šifru",
      );
    if (rowErrors.length) {
      errors.push(`Red ${i + 2}: ${rowErrors.join("; ")}.`);
      return;
    }
    if (prev)
      duplicates.push(
        `Red ${i + 2}: ${code} / ${supplier} — ažurira postojeću cenu.`,
      );
    const text = normalize(name),
      tier =
        prev?.tier ||
        (/premium|\bpro\b/.test(text)
          ? "premium"
          : /ekonomic|osnov|basic|roller/.test(text)
            ? "economy"
            : "standard");
    const kind =
      prev?.kind ||
      (/lakiran/.test(text) ? "lacquer" : /mdf/.test(text) ? "mdf" : "univer");
    valid.push({
      ...prev,
      id: prev?.id || uid(),
      code,
      name,
      category: category!,
      supplier,
      manufacturer: prev?.manufacturer || "",
      unit,
      price,
      currency: currency as Product["currency"],
      active: true,
      note: str("Napomena"),
      ...(["slide", "hinge", "lift"].includes(category!) ? { tier } : {}),
      ...(category === "front" ? { kind } : {}),
      ...(unit === "tabla" ? { sheetWidth, sheetHeight } : {}),
    });
  });
  return { valid, errors, duplicates };
}
