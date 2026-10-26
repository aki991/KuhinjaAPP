import { describe, it, expect } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { calculateOffer } from "../src/core/engine";
import {
  appendPlacement,
  defaultLayout,
  ensureLayout,
  moveElement,
  rowOf,
  wallUsage,
  packLayout,
  relocateItem,
  moveLayoutItem,
  newSpacer,
} from "../src/core/layout";
describe("Shematski raspored bez uticaja na konstrukciju", () => {
  it("stari projekat i sve varijante zadržavaju iste ukupne cene", () => {
    const old = createOffer(true),
      before = calculateOffer(old),
      after = ensureLayout(old);
    expect(calculateOffer(after)).toEqual({
      ...before,
      elements: before.elements.map((r, i) => ({
        ...r,
        element: after.elements[i],
      })),
    });
    expect(after.prices).toEqual(old.prices);
    expect(after.variants[0].prices).toEqual(old.variants[0].prices);
    expect(after.elements.every((e) => e.placement?.wall === "A")).toBe(true);
    expect(
      calculateOffer({ ...after, ...after.variants[0], variants: [] }).total,
    ).toBe(before.total);
  });
  it("L/U kuhinje i ostrvo imaju odvojene zidove", () => {
    expect(defaultLayout("L kuhinja").walls.map((w) => w.id)).toEqual([
      "A",
      "B",
    ]);
    expect(defaultLayout("U kuhinja").walls.map((w) => w.id)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(defaultLayout("Sa ostrvom").walls.map((w) => w.id)).toEqual([
      "A",
      "island",
    ]);
  });
  it("viseći elementi se poravnavaju sa početkom donjeg reda", () => {
    const o = createOffer();
    o.elements = [
      newElement("base1"),
      newElement("wall1"),
      newElement("base2"),
    ];
    const n = ensureLayout(o);
    expect(n.elements.map((e) => e.placement?.offset)).toEqual([0, 0, 600]);
  });
  it("radna ploča, sokla i viseći red ne dupliraju zauzetu širinu", () => {
    const o = createOffer();
    o.elements = [
      newElement("base1"),
      newElement("oven"),
      newElement("wall1"),
      newElement("worktop"),
      newElement("plinth"),
    ];
    const n = ensureLayout(o),
      u = wallUsage(n.elements, n.layout!.walls[0]);
    expect(u.occupied).toBe(1200);
    expect(u.free).toBe(1800);
    expect(rowOf(n.elements[3])).toBe("extra");
  });
  it("količina i visoki elementi se računaju u isti donji red", () => {
    const e = {
        ...newElement("base1"),
        quantity: 2,
        placement: { wall: "A", offset: 0 },
      },
      t = newElement("tall");
    t.placement = appendPlacement([e], t, "A");
    expect(t.placement.offset).toBe(1200);
    expect(
      wallUsage([e, t], { id: "A", name: "Zid A", length: 3000 }).occupied,
    ).toBe(1800);
  });
  it("zidovi su nezavisni, a višak i slobodna mesta su tačni", () => {
    const e = { ...newElement("base2"), placement: { wall: "B", offset: 400 } };
    expect(
      wallUsage([e], { id: "A", name: "Zid A", length: 1000 }).occupied,
    ).toBe(0);
    const u = wallUsage([e], { id: "B", name: "Zid B", length: 1000 });
    expect(u.occupied).toBe(800);
    expect(u.free).toBe(200);
    expect(u.overrun).toBe(0);
  });
  it("novi obračun zauzetosti koristi širine umesto zastarelih koordinata", () => {
    const a = { ...newElement("base1"), placement: { wall: "A", offset: 0 } },
      b = { ...newElement("base2"), placement: { wall: "A", offset: 400 } };
    const u = wallUsage([a, b], { id: "A", name: "Zid A", length: 3000 });
    expect(u.occupied).toBe(1400);
    expect(u.overlaps.length).toBe(0);
  });
  it("redosled menja samo pozicije i zadržava iznose, zaključavanje i listu elemenata", () => {
    const o = ensureLayout(createOffer(true)),
      e = o.elements[1];
    e.locked = true;
    const moved = moveElement(o.elements, e.id, -1);
    expect(moved.map((e) => e.id)).toEqual(o.elements.map((e) => e.id));
    expect(moved.find((x) => x.id === e.id)?.placement?.offset).toBe(0);
    expect(moved.find((x) => x.id === e.id)?.locked).toBe(true);
    expect(calculateOffer({ ...o, elements: moved }).total).toBe(
      calculateOffer(o).total,
    );
  });
  it("promena širine se odmah odražava na zauzetost", () => {
    const o = ensureLayout(createOffer());
    o.elements = [
      { ...newElement("base1"), placement: { wall: "A", offset: 0 } },
    ];
    expect(wallUsage(o.elements, o.layout!.walls[0]).occupied).toBe(600);
    o.elements[0].width = 800;
    expect(wallUsage(o.elements, o.layout!.walls[0]).occupied).toBe(800);
  });
});
