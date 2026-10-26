import { describe, it, expect } from "vitest";
import { newElement } from "../src/core/catalog";
import { createOffer } from "../src/core/db";
import { calculateOffer } from "../src/core/engine";
import {
  appendPlacement,
  defaultLayout,
  ensureLayout,
  moveLayoutItem,
  newSpacer,
  orderedLane,
  packLayout,
  relocateItem,
  wallUsage,
} from "../src/core/layout";
import type { KitchenLayout } from "../src/core/types";
const three = () => {
  const o = createOffer();
  o.layout = defaultLayout("L kuhinja", 2400);
  o.elements = [newElement("base1"), newElement("base1"), newElement("base1")];
  return ensureLayout(o);
};
describe("Automatsko slaganje", () => {
  it("600/600/600 → 600/400/600: treći se pomera tačno 200 mm ulevo", () => {
    const o = three();
    expect(o.elements.map((e) => e.placement!.offset)).toEqual([0, 600, 1200]);
    o.elements[1].width = 400;
    const result = ensureLayout(o);
    expect(result.elements.map((e) => e.placement!.offset)).toEqual([
      0, 600, 1000,
    ]);
    expect(result.layout!.spacers).toEqual([]);
    expect(
      wallUsage(result.elements, result.layout!.walls[0], result.layout).free,
    ).toBe(800);
  });
  it("povećanje širine pomera naredne bez menjanja zidova, širina ili količina drugih", () => {
    const o = three();
    o.elements[0].width = 800;
    const n = ensureLayout(o);
    expect(n.elements.map((e) => e.placement!.offset)).toEqual([0, 800, 1400]);
    expect(n.elements.map((e) => e.width)).toEqual([800, 600, 600]);
    expect(
      n.elements.every((e) => e.quantity === 1 && e.placement!.wall === "A"),
    ).toBe(true);
  });
  it("brisanje srednjeg elementa popunjava njegovo mesto", () => {
    const o = three(),
      n = ensureLayout({
        ...o,
        elements: o.elements.filter((_, i) => i !== 1),
      });
    expect(n.elements.map((e) => e.placement!.offset)).toEqual([0, 600]);
  });
  it("dodavanje ide iza namernog razmaka i poslednjeg elementa", () => {
    const o = three(),
      gap = newSpacer("A", "base", 200);
    gap.placement.order = 3;
    o.layout!.spacers = [gap];
    o.elements.push({
      ...newElement("base1"),
      placement: appendPlacement(
        o.elements,
        newElement("base1"),
        "A",
        o.layout,
      ),
    });
    const n = ensureLayout(o);
    expect(n.elements[3].placement!.offset).toBe(2000);
  });
  it("donji i viseći redovi se slažu nezavisno", () => {
    const o = three();
    o.elements.push({
      ...newElement("wall1"),
      placement: { wall: "A", row: "wall", order: 0, offset: 999 },
    });
    o.elements[1].width = 400;
    const n = ensureLayout(o);
    expect(n.elements[2].placement!.offset).toBe(1000);
    expect(n.elements[3].placement!.offset).toBe(0);
  });
  it("razmak se menja i briše bez uticaja na cenu i broj ormara", () => {
    const o = three(),
      total = calculateOffer(o).total,
      gap = newSpacer("A", "base", 200);
    gap.placement.order = 0.5;
    o.layout!.spacers = [gap];
    let n = ensureLayout(o);
    expect(n.elements[1].placement!.offset).toBe(800);
    n.layout!.spacers![0].width = 100;
    n = ensureLayout(n);
    expect(n.elements[1].placement!.offset).toBe(700);
    expect(calculateOffer(n).total).toBe(total);
    n.layout!.spacers = [];
    n = ensureLayout(n);
    expect(n.elements[1].placement!.offset).toBe(600);
    expect(n.elements.length).toBe(3);
  });
  it("stari ručni vodeći i srednji razmaci postaju zasebne stavke", () => {
    const o = three();
    delete o.layout!.version;
    o.elements[0].placement = { wall: "A", offset: 100 };
    o.elements[1].placement = { wall: "A", offset: 900 };
    o.elements[2].placement = { wall: "A", offset: 1500 };
    const n = ensureLayout(o);
    expect(n.layout!.spacers!.map((s) => s.width)).toEqual([100, 200]);
    expect(n.elements.map((e) => e.placement!.offset)).toEqual([
      100, 900, 1500,
    ]);
    const again = ensureLayout(n);
    expect(again.layout!.spacers).toEqual(n.layout!.spacers);
    expect(calculateOffer(n).total).toBe(calculateOffer(o).total);
  });
  it("stara preklapanja ostavljaju napomenu, bez brisanja ormara", () => {
    const o = three();
    delete o.layout!.version;
    o.elements[1].placement = { wall: "A", offset: 400 };
    const n = ensureLayout(o);
    expect(n.layout!.migrationNotes?.length).toBe(1);
    expect(n.elements.length).toBe(3);
    expect(n.elements[1].placement!.offset).toBe(600);
  });
  it("promena reda i zida čuva dimenzije, individualni izbor i cenu", () => {
    const o = three();
    o.elements[1].locked = true;
    const n = relocateItem(
      o.elements,
      o.layout!,
      o.elements[1].id,
      "B",
      "base",
      0,
    )!;
    expect(n.elements.map((e) => e.placement!.offset)).toEqual([0, 0, 600]);
    expect(n.elements[1].placement!.wall).toBe("B");
    expect(n.elements[1].locked).toBe(true);
    expect(calculateOffer({ ...o, ...n }).total).toBe(calculateOffer(o).total);
  });
  it("nekompatibilan red odbija se; razmak može između donjeg i visećeg reda", () => {
    const o = three();
    expect(
      relocateItem(o.elements, o.layout!, o.elements[0].id, "A", "wall", 0),
    ).toBeNull();
    const s = newSpacer("A", "base", 150);
    o.layout!.spacers = [s];
    const n = relocateItem(o.elements, o.layout!, s.id, "B", "wall", 0)!;
    expect(n.layout.spacers![0].placement).toMatchObject({
      wall: "B",
      row: "wall",
      order: 0,
      offset: 0,
    });
  });
  it("prevlačenje na početak/sredinu/kraj i Levo/Desno koriste isti redosled", () => {
    const o = three(),
      [a, b, c] = o.elements;
    let n = relocateItem(o.elements, o.layout!, c.id, "A", "base", 0)!;
    expect(
      orderedLane(n.elements, n.layout, "A", "base").map((e) => e.id),
    ).toEqual([c.id, a.id, b.id]);
    n = moveLayoutItem(n.elements, n.layout, c.id, 1)!;
    expect(
      orderedLane(n.elements, n.layout, "A", "base").map((e) => e.id),
    ).toEqual([a.id, c.id, b.id]);
    n = relocateItem(n.elements, n.layout, a.id, "A", "base", 99)!;
    expect(
      orderedLane(n.elements, n.layout, "A", "base").map((e) => e.id),
    ).toEqual([c.id, b.id, a.id]);
  });
  it("prekoračenje ne menja širine i ne seli na drugi zid", () => {
    const o = three();
    o.layout!.walls[0].length = 1200;
    const n = ensureLayout(o),
      u = wallUsage(n.elements, n.layout!.walls[0], n.layout);
    expect(u.overrun).toBe(600);
    expect(
      n.elements.every((e) => e.placement!.wall === "A" && e.width === 600),
    ).toBe(true);
  });
  it("količina ostaje grupa sa ukupnom širinom", () => {
    const o = three();
    o.elements[0].quantity = 2;
    const n = ensureLayout(o);
    expect(n.elements.map((e) => e.placement!.offset)).toEqual([0, 1200, 1800]);
    expect(n.elements[0].quantity).toBe(2);
  });
});
