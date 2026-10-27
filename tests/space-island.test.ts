import { describe, expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import {
  defaultLayout,
  ensureLayout,
  newSpacer,
  spaceChange,
} from "../src/core/layout";
import { kitchenPlan, islandFootprint } from "../src/core/top-view";
import { calculateOffer } from "../src/core/engine";
import { validateBackup } from "../src/core/backup-validation";

describe("promena prostora i položaj ostrva", () => {
  it("prava → L → U dodaje samo potrebne zidove i zadržava elemente i dužine", () => {
    const o = createOffer();
    o.client.layout = "Prava kuhinja";
    o.layout = defaultLayout("Prava kuhinja", 4100);
    const item = newElement("base1");
    item.placement = { wall: "A", order: 0, offset: 0 };
    o.elements = [item];
    const l = spaceChange(o, "L kuhinja").offer;
    expect(l.layout!.walls.map((w) => [w.id, w.length])).toEqual([
      ["A", 4100],
      ["B", 4100],
    ]);
    l.layout!.walls[1].length = 2600;
    const u = spaceChange(l, "U kuhinja").offer;
    expect(u.layout!.walls.map((w) => [w.id, w.length])).toEqual([
      ["A", 4100],
      ["B", 2600],
      ["C", 4100],
    ]);
    expect(u.elements[0]).toMatchObject(item);
    expect(o.layout!.walls).toHaveLength(1);
  });
  it("uklonjeni zidovi premeštaju elemente, razmake i prepreke bez gubitka podataka", () => {
    const o = createOffer();
    o.layout = defaultLayout("U kuhinja", 3000);
    const a = newElement("base1"),
      b = newElement("drawer3"),
      c = newElement("wall1");
    a.placement = { wall: "A", order: 0, offset: 0 };
    b.placement = { wall: "B", order: 0, offset: 0 };
    c.placement = { wall: "C", order: 0, offset: 0 };
    o.elements = [a, b, c];
    const gap = newSpacer("B", "base", 150);
    gap.placement.order = 1;
    o.layout.spacers = [gap];
    o.elevation!.objects = [
      {
        id: "window",
        kind: "window",
        wall: "C",
        x: 200,
        width: 800,
        height: 800,
        bottom: 900,
      },
    ];
    const { offer, affected } = spaceChange(o, "Prava kuhinja");
    expect(affected).toBe(4);
    expect(offer.elements.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
    expect(offer.elements.map((e) => e.placement?.wall)).toEqual([
      "A",
      "A",
      "A",
    ]);
    expect(offer.layout!.spacers![0].placement.wall).toBe("A");
    expect(offer.elevation!.objects[0]).toMatchObject({ wall: "A", x: 200 });
    expect(offer.elements[1].placement!.offset).toBe(a.width);
    expect(o.elements[1].placement!.wall).toBe("B");
  });
  it("ručni položaj ostrva ostaje isti kroz filtre, čuvanje i obračun", () => {
    const o = createOffer();
    o.layout = defaultLayout("L kuhinja", 4000);
    o.layout.walls.push({ id: "island", name: "Ostrvo", length: 3000 });
    const item = newElement("island");
    item.depth = 400;
    item.placement = { wall: "island", order: 0, offset: 0 };
    o.elements = [item];
    const initial = ensureLayout(o);
    initial.layout!.islandPosition = { x: 1200, y: 1400 };
    expect(islandFootprint(kitchenPlan(initial, "all").walls.find((w) => w.island)!.scene).depth).toBe(400);
    for (const filter of ["all", "base", "wall"] as const)
      expect(
        kitchenPlan(initial, filter).walls.find((w) => w.island),
      ).toMatchObject({ x: 1200, y: 1400 });
    const reopened = ensureLayout(JSON.parse(JSON.stringify(initial)));
    expect(reopened.layout!.islandPosition).toEqual({ x: 1200, y: 1400 });
    expect(calculateOffer(initial).total).toBe(
      calculateOffer({
        ...initial,
        layout: { ...initial.layout!, islandPosition: { x: 2000, y: 2000 } },
      }).total,
    );
    const withWall = structuredClone(initial);
    const wallItem = newElement("base1");
    wallItem.placement = { wall: "A", order: 0, offset: 0 };
    withWall.elements.push(wallItem);
    withWall.layout!.islandPosition = { x: 0, y: 0 };
    expect(kitchenPlan(withWall, "all").warnings.join()).toContain("Ostrvo se preklapa");
    const islandGap = newSpacer("island", "base", 600);
    islandGap.placement.order = 0;
    withWall.layout!.spacers!.push(islandGap);
    withWall.elements.find((e) => e.kind === "island")!.placement!.order = 1;
    expect(kitchenPlan(withWall, "all").warnings.join()).not.toContain("Ostrvo se preklapa");
    const backup = {
      format: "kuhinja-backup",
      version: 1,
      offers: [reopened],
      clients: [],
      products: [],
      suppliers: [],
      settings: [],
      templates: [],
    };
    expect(() => validateBackup(backup as never)).not.toThrow();
    reopened.layout!.islandPosition!.x = -1;
    expect(() => validateBackup(backup as never)).toThrow();
  });
});
