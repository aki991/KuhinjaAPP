import { calculateOffer } from "./engine";
import { elementCodes } from "./layout";
import { templates } from "./catalog";
import type { Offer } from "./types";

export interface CutRow {
  code: string;
  element: string;
  part: string;
  material: string;
  width: number;
  height: number;
  thickness: number;
  quantity: number;
  /** Edge banding length of one piece, in metres. */
  edge: number;
}

/** One row per distinct part of every element, quantities already multiplied by the element quantity. */
export function cutList(offer: Offer): CutRow[] {
  const calc = calculateOffer(offer),
    codes = elementCodes(offer.elements, offer.layout),
    material = (id: string) => offer.prices.find((p) => p.id === id)?.name ?? id;
  return calc.elements.flatMap((r) =>
    r.panels.map((p) => ({
      code: codes.get(r.element.id) ?? "",
      element:
        templates.find((t) => t.kind === r.element.kind)?.name ?? r.element.kind,
      part: p.name,
      material: material(p.material),
      width: Math.round(p.width),
      height: Math.round(p.height),
      thickness: p.thickness,
      quantity: p.quantity * r.element.quantity,
      edge: Math.round(p.edge * 1000) / 1000,
    })),
  );
}

export interface MaterialTotal {
  material: string;
  thickness: number;
  pieces: number;
  area: number;
}

export function materialTotals(rows: CutRow[]): MaterialTotal[] {
  const totals = new Map<string, MaterialTotal>();
  for (const r of rows) {
    const key = `${r.material}|${r.thickness}`,
      t = totals.get(key) ?? {
        material: r.material,
        thickness: r.thickness,
        pieces: 0,
        area: 0,
      };
    t.pieces += r.quantity;
    t.area += (r.width * r.height * r.quantity) / 1e6;
    totals.set(key, t);
  }
  return [...totals.values()].sort((a, b) => a.material.localeCompare(b.material));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Semicolon separated with a UTF-8 BOM, which is what Excel with Serbian settings opens correctly. */
export function cutListCsv(offer: Offer) {
  const header = [
    "Element",
    "Naziv elementa",
    "Deo",
    "Materijal",
    "Širina (mm)",
    "Visina (mm)",
    "Debljina (mm)",
    "Komada",
    "Kant po komadu (m)",
  ];
  const rows = cutList(offer).map((r) => [
    r.code,
    r.element,
    r.part,
    r.material,
    r.width,
    r.height,
    r.thickness,
    r.quantity,
    String(r.edge).replace(".", ","),
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}
