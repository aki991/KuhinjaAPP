import { expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { calculateOffer } from "../src/core/engine";
import { ensureLayout } from "../src/core/layout";

it("automatska radna ploča je jedan komad, zbir donjih elemenata na zidu", () => {
  const o = createOffer(),
    cabinets = [newElement("base1"), newElement("base2"), newElement("drawer3")];
  // Old projects: one automatic top per cabinet.
  const tops = cabinets.map((c) => {
    const top = newElement("worktop");
    top.autoTopFor = c.id;
    top.width = c.width;
    return top;
  });
  o.elements = [...cabinets, ...tops];
  const n = ensureLayout(o),
    worktops = n.elements.filter((e) => e.kind === "worktop");
  expect(worktops).toHaveLength(1);
  expect(worktops[0].width).toBe(cabinets.reduce((a, c) => a + c.width * c.quantity, 0));
  expect(worktops[0].autoTopFor).toBe("A");
  expect(calculateOffer(n).errors).toEqual([]);
  // Without cabinets the generated top disappears.
  n.elements = n.elements.filter((e) => e.kind === "worktop");
  expect(ensureLayout(n).elements).toHaveLength(0);
});

import { cutList, cutListCsv } from "../src/core/cutlist";
it("krojna lista ima delove svih elemenata, množi količine i pravi CSV", () => {
  const o = createOffer(true),
    rows = cutList(ensureLayout(o));
  expect(rows.length).toBeGreaterThan(20);
  expect(rows.every((r) => r.width > 0 && r.height > 0 && r.quantity > 0)).toBe(true);
  expect(rows.some((r) => r.part === "Front fioke 1")).toBe(true);
  const csv = cutListCsv(ensureLayout(o));
  expect(csv.split("\r\n")[0]).toContain("Širina (mm);Visina (mm)");
  expect(csv.split("\r\n")).toHaveLength(rows.length + 1);
});

import { drillingDxf, wtInput } from "../src/core/cnc";
it("DXF za bušenje ima obrise, kružne rupe po slojevima i ispravan kraj; WTINPUT ima red po delu", () => {
  const o = ensureLayout(createOffer(true)),
    dxf = drillingDxf(o);
  expect(dxf.startsWith("0\r\nSECTION")).toBe(true);
  expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  expect(dxf).toContain("DRILL_D35_Z12.5"); // hinge cups on the doors
  expect(dxf).toContain("DRILL_D5_Z13"); // system holes on the sides
  expect(dxf).toContain("CIRCLE");
  const rows = wtInput(o).trim().split("\r\n");
  expect(rows[0]).toContain("Duzina\tSirina");
  expect(rows).toHaveLength(cutList(o).length + 1);
});

import { syncPrices } from "../src/core/prices";
it("cena iz cenovnika postaje stvarna cena u projektu i u varijantama", () => {
  const o = createOffer(true),
    id = o.selection.body,
    price = o.prices.find((p) => p.id === id)!.price;
  const products = structuredClone(o.prices).map((p) =>
    p.id === id ? { ...p, price: price * 2 } : p,
  );
  const next = syncPrices(o, products);
  expect(next.prices.find((p) => p.id === id)!.price).toBe(price * 2);
  expect(next.variants[0].prices.find((p) => p.id === id)!.price).toBe(price * 2);
  expect(calculateOffer(next).total).toBeGreaterThan(calculateOffer(o).total);
  expect(syncPrices(next, products)).toBe(next); // nothing to change: same object
});
