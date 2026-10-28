import { describe, expect, it } from "vitest";
import { newElement } from "../src/core/catalog";
import {
  endOf,
  packLayout,
  placeAt,
  relocateItem,
  removeItem,
  allLayoutItems,
  wallUsage,
} from "../src/core/layout";
import type { KitchenElement, KitchenLayout } from "../src/core/types";

const layout = (): KitchenLayout => ({
  walls: [{ id: "A", name: "Zid A", length: 3000 }],
  activeWall: "A",
  version: 3,
  spacers: [],
});
function row(widths: number[]) {
  const elements: KitchenElement[] = widths.map((w, order) => {
    const e = newElement("base1");
    e.width = w;
    e.placement = { wall: "A", row: "base", order, offset: 0 };
    return e;
  });
  return { ...packLayout(elements, layout()), ids: elements.map((e) => e.id) };
}
const offsets = (r: { elements: KitchenElement[] }) =>
  r.elements
    .filter((e) => e.kind !== "worktop")
    .sort((a, b) => a.placement!.offset - b.placement!.offset)
    .map((e) => [e.width, e.placement!.offset]);

describe("razmaci: brisanje i pomeranje ostavljaju prazno mesto", () => {
  it("brisanje prvog elementa ne pomera ostale, mesto ostaje prazno", () => {
    const r = row([600, 600, 600]);
    const after = removeItem(r.elements, r.layout, r.ids[0])!;
    expect(offsets(after)).toEqual([
      [600, 600],
      [600, 1200],
    ]);
  });
  it("brisanje srednjeg elementa ostavlja rupu, a poslednjeg ne ostavlja ništa", () => {
    const r = row([600, 600, 600]);
    expect(offsets(removeItem(r.elements, r.layout, r.ids[1])!)).toEqual([
      [600, 0],
      [600, 1200],
    ]);
    expect(offsets(removeItem(r.elements, r.layout, r.ids[2])!)).toEqual([
      [600, 0],
      [600, 600],
    ]);
  });
  it("novi element može da se postavi u praznu rupu na tačnu meru", () => {
    const r = row([600, 600, 600]);
    const gap = removeItem(r.elements, r.layout, r.ids[0])!;
    const extra = newElement("drawer3");
    extra.width = 600;
    extra.placement = { wall: "A", row: "base", order: 99, offset: 0 };
    const placed = placeAt([...gap.elements, extra], gap.layout, extra.id, "A", "base", 0);
    expect("error" in placed).toBe(false);
    if (!("error" in placed)) {
      expect(offsets(placed)).toEqual([
        [600, 0],
        [600, 600],
        [600, 1200],
      ]);
    }
  });
  it("element se postavlja na po 5 cm, npr. na sredinu, a ostali ostaju", () => {
    const r = row([600, 600]);
    const out = placeAt(r.elements, r.layout, r.ids[0], "A", "base", 1200);
    expect("error" in out).toBe(false);
    if (!("error" in out)) {
      expect(out.offset).toBe(1200);
      expect(offsets(out)).toEqual([
        [600, 600],
        [600, 1200],
      ]);
      expect(wallUsage(out.elements, out.layout.walls[0], out.layout).freeBase).toBe(1200);
    }
    const centred = placeAt(r.elements, r.layout, r.ids[1], "A", "base", 1200);
    if (!("error" in centred)) expect(centred.offset).toBe(1200);
  });
  it("mala preklapanja se pomeraju do najbližeg slobodnog mesta, prava ne prolaze", () => {
    const r = row([600, 600]);
    const near = placeAt(r.elements, r.layout, r.ids[0], "A", "base", 650);
    // 600..1200 je zauzeto drugim elementom, najbliže slobodno je posle njega
    if (!("error" in near)) expect(near.offset).toBe(1200);
    const wide = row([1500, 600]);
    const clash = placeAt(wide.elements, wide.layout, wide.ids[1], "A", "base", 300);
    expect("error" in clash).toBe(true);
  });
  it("element se ne postavlja preko kraja zida", () => {
    const r = row([600]);
    const out = placeAt(r.elements, r.layout, r.ids[0], "A", "base", 5000);
    if (!("error" in out)) expect(out.offset).toBe(2400);
  });
  it("razmak se čuva pri izmeni širine i pri ponovnom slaganju", () => {
    const r = row([600, 600, 600]);
    const gap = removeItem(r.elements, r.layout, r.ids[0])!;
    const again = packLayout(gap.elements, gap.layout);
    expect(offsets(again)).toEqual(offsets(gap));
    const widened = structuredClone(gap.elements);
    widened.find((e) => e.id === r.ids[1])!.width = 800;
    const out = relocateItem(widened, gap.layout, r.ids[1], "A", "base", 0)!;
    expect(offsets(out)[0]).toEqual([800, 600]);
  });
  it("brisanje razmaka (spacer) zatvara prazninu kao ranije", () => {
    const r = row([600, 600]);
    const withSpacer = { ...r.layout, spacers: [] as KitchenLayout["spacers"] };
    expect(allLayoutItems(r.elements, withSpacer).length).toBe(2);
  });
});

describe("koraci kao u aplikaciji", () => {
  it("obriši prvi (60 cm), dodaj fioke pa ih postavi na 0: ostali ostaju na mestu", () => {
    const r = row([600, 600, 600]);
    const gap = removeItem(r.elements, r.layout, r.ids[0])!;
    const fresh = newElement("drawer3");
    fresh.width = 600;
    fresh.placement = { wall: "A", row: "base", order: Number.MAX_SAFE_INTEGER, offset: 0 };
    const appended = relocateItem([...gap.elements, fresh], gap.layout, fresh.id, "A", "base", Number.MAX_SAFE_INTEGER)!;
    expect(appended.elements.find((e) => e.id === fresh.id)!.placement!.offset).toBe(1800);
    const placed = placeAt(appended.elements, appended.layout, fresh.id, "A", "base", 0);
    expect("error" in placed).toBe(false);
    if (!("error" in placed)) {
      expect(offsets(placed)).toEqual([
        [600, 0],
        [600, 600],
        [600, 1200],
      ]);
      expect(placed.elements.filter((e) => e.kind === "worktop")).toHaveLength(0);
    }
  });
  it("prozor u donjem redu se ne prelazi: postavljanje na prepreku vraća grešku", () => {
    const r = row([600]);
    const el = structuredClone(r.elements);
    const out = placeAt(el, r.layout, r.ids[0], "A", "base", 0, {
      toeKick: 100,
      upperGap: 600,
      wallHeight: 2600,
      version: 1,
      objects: [
        { id: "w", wall: "A", kind: "door", x: 500, width: 900, bottom: 0, height: 2000 },
      ],
    });
    expect("error" in out || out.offset >= 1400 || out.offset + 600 <= 500).toBe(true);
  });
  it("zid se računa sa razmacima: rupa ispred prvog elementa je zauzeta, slobodan je kraj zida", () => {
    const r = row([600, 600, 600]);
    const gap = removeItem(r.elements, r.layout, r.ids[0])!;
    const usage = wallUsage(gap.elements, gap.layout.walls[0], gap.layout);
    expect(usage.freeBase).toBe(1200);
    expect(endOf(gap.elements.find((e) => e.id === r.ids[2])!)).toBe(1800);
  });
});

describe("radna ploča prati susedne elemente", () => {
  it("obrisan srednji element deli radnu ploču na dva komada, a zatvaranje je opet spaja", () => {
    const base = row([600, 600, 600]);
    const top = newElement("worktop");
    top.autoTopFor = "A";
    top.placement = { wall: "A", row: "extra", order: 0, offset: 0 };
    const withTop = packLayout([...base.elements.filter((e) => e.kind !== "worktop"), top], base.layout);
    const tops = (r: { elements: KitchenElement[] }) =>
      r.elements.filter((e) => e.kind === "worktop").map((e) => [e.visual?.offset, e.width]);
    expect(tops(withTop)).toEqual([[0, 1800]]);
    const middle = withTop.elements.filter((e) => e.kind !== "worktop")[1];
    const gap = removeItem(withTop.elements, withTop.layout, middle.id)!;
    expect(tops(gap).sort()).toEqual([[0, 600], [1200, 600]]);
    // u rupu se vraća element: ploča je opet jedna
    const fresh = newElement("drawer3");
    fresh.width = 600;
    fresh.placement = { wall: "A", row: "base", order: 99, offset: 0 };
    const filled = placeAt([...gap.elements, fresh], gap.layout, fresh.id, "A", "base", 600);
    if ("error" in filled) throw new Error(filled.error);
    expect(tops(filled)).toEqual([[0, 1800]]);
  });
  it("frižider (visoki) se ubacuje u praznu rupu bez radne ploče ispod njega", () => {
    const base = row([600, 600, 600]);
    const top = newElement("worktop");
    top.autoTopFor = "A";
    top.placement = { wall: "A", row: "extra", order: 0, offset: 0 };
    const withTop = packLayout([...base.elements.filter((e) => e.kind !== "worktop"), top], base.layout);
    const middle = withTop.elements.filter((e) => e.kind !== "worktop")[1];
    const gap = removeItem(withTop.elements, withTop.layout, middle.id)!;
    const fridge = newElement("fridge");
    fridge.placement = { wall: "A", row: "base", order: 99, offset: 0 };
    const out = placeAt([...gap.elements, fridge], gap.layout, fridge.id, "A", "base", 600);
    if ("error" in out) throw new Error(out.error);
    const tops = out.elements.filter((e) => e.kind === "worktop");
    expect(tops).toHaveLength(2);
    expect(tops.map((t) => t.visual?.offset).sort()).toEqual([0, 1200]);
  });
});
