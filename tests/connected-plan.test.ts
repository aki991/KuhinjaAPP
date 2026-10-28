import { describe, expect, it } from "vitest";
import { newElement } from "../src/core/catalog";
import { createOffer } from "../src/core/db";
import { calculateOffer } from "../src/core/engine";
import { elevationScene, freeUpperLength } from "../src/core/elevation";
import {
  defaultLayout,
  ensureLayout,
  junctionReservations,
  packLayout,
  relocateItem,
  wallUsage,
} from "../src/core/layout";
import { kitchenPlan, planPoint } from "../src/core/top-view";
import type { ElementKind } from "../src/core/types";

function fixture(shape = "L kuhinja") {
  const o = createOffer();
  o.client.layout = shape;
  o.layout = defaultLayout(shape, 2400);
  o.elements = [];
  const add = (
    kind: ElementKind,
    wall: string,
    order: number,
    width?: number,
    depth?: number,
  ) => {
    const e = newElement(kind);
    e.id = `${wall}-${kind}-${order}`;
    if (width) e.width = width;
    if (depth) e.depth = depth;
    e.placement = { wall, order, offset: 0 };
    o.elements.push(e);
    return e;
  };
  return { o, add };
}
describe("Povezani zidovi i ugaono zauzeće", () => {
  it("slobodan viseći prostor računa visoki element i ne broji preklapanje dvaput", () => {
    const { o, add } = fixture();
    add("tall", "A", 0, 600);
    let normalized = ensureLayout(o);
    expect(
      freeUpperLength(
        elevationScene(normalized, "A"),
        normalized.elements,
        normalized.layout!,
      ),
    ).toBe(1800);
    add("wall1", "A", 0, 600);
    add("wallBridgeFridge", "A", 1, 400);
    normalized = ensureLayout(o);
    expect(
      freeUpperLength(
        elevationScene(normalized, "A"),
        normalized.elements,
        normalized.layout!,
      ),
    ).toBe(1200); // Viseći počinje posle visokog; most ne troši dužinu visećeg reda.
  });
  it("sprečava fizičko preklapanje običnih elemenata u spoju i pre potpunog popunjavanja A", () => {
    const { o, add } = fixture();
    add("base2", "A", 0, 2200);
    add("base1", "B", 0);
    const n = ensureLayout(o);
    expect(n.elements[1].placement!.offset).toBe(560);
    expect(wallUsage(n.elements, n.layout!.walls[1], n.layout).base).toBe(1160);
  });
  it("L ugao zauzima stvarnu dubinu na B, bez lažnog elementa ili duplog obračuna", () => {
    const { o, add } = fixture();
    add("base1", "A", 0, 1500);
    const corner = add("corner", "A", 1, 900, 900);
    const b = add("base1", "B", 0);
    const normalized = ensureLayout(o),
      plan = kitchenPlan(normalized, "all");
    expect(
      normalized.elements.find((e) => e.id === b.id)!.placement!.offset,
    ).toBe(900);
    expect(
      wallUsage(
        normalized.elements,
        normalized.layout!.walls[1],
        normalized.layout,
      ),
    ).toMatchObject({ base: 1500, reservedBase: 900, free: 900 });
    expect(plan.walls.map((w) => [w.scene.wall, w.x, w.y, w.angle])).toEqual([
      ["A", 0, 0, 0],
      ["B", 2400, 0, 90],
    ]);
    expect(planPoint(plan.walls[0], 2400, 0)).toEqual({ x: 2400, y: 0 });
    expect(plan.reservations).toContainEqual({
      wall: "B",
      row: "base",
      edge: "start",
      size: 900,
      source: corner.id,
      sourceWall: "A",
    });
    expect(normalized.elements).toHaveLength(3);
    expect(calculateOffer(normalized).cost).toBe(
      calculateOffer({
        ...normalized,
        layout: defaultLayout("Prava kuhinja", 10000),
      }).cost,
    );
  });
  it("dubina, brisanje i premeštanje izvora ponovo računaju zauzeće bez trajnog razmaka", () => {
    const { o, add } = fixture();
    const corner = add("cornerBlind", "A", 0, 900, 650),
      b = add("base1", "B", 0);
    expect(ensureLayout(o).elements[1].placement!.offset).toBe(650);
    corner.depth = 720;
    expect(ensureLayout(o).elements[1].placement!.offset).toBe(720);
    expect(packLayout([b], o.layout!).elements[0].placement!.offset).toBe(0);
    const moved = relocateItem(
      o.elements,
      o.layout!,
      corner.id,
      "B",
      "base",
      1,
    )!;
    expect(moved.elements.find((e) => e.id === b.id)!.placement!.offset).toBe(
      0,
    );
  });
  it("donji i viseći ugao zasebno rezervišu redove i upozoravaju na prekratak zid", () => {
    const { o, add } = fixture();
    add("corner", "A", 0, 900, 900);
    add("wallCorner", "A", 0, 600, 600);
    add("base1", "B", 0, 1800);
    add("wall1", "B", 0);
    const n = ensureLayout(o);
    expect(n.elements[2].placement!.offset).toBe(900);
    expect(n.elements[3].placement!.offset).toBe(600);
    expect(wallUsage(n.elements, n.layout!.walls[1], n.layout).overrun).toBe(
      300,
    );
    expect(
      elevationScene(n, "B").entries.find((e) => e.id === n.elements[2].id)!
        .conflict,
    ).toBe(true);
  });
  it("ugaoni na početku B rezerviše kraj A i označava preklapanje", () => {
    const { o, add } = fixture();
    add("base1", "A", 0, 2000);
    add("corner", "B", 0, 900, 900);
    const n = ensureLayout(o);
    expect(junctionReservations(n.elements, n.layout!)[0]).toMatchObject({
      wall: "A",
      edge: "end",
      size: 900,
    });
    expect(wallUsage(n.elements, n.layout!.walls[0], n.layout).overrun).toBe(
      500,
    );
    expect(elevationScene(n, "A").warnings.join()).toContain(
      "ugaonim elementom susednog zida",
    );
  });
  it("U povezuje A→B→C, oba ugla i ostrvo; izbor aktivnog zida ne menja plan", () => {
    const { o, add } = fixture("U kuhinja");
    add("base1", "A", 0, 1500);
    add("corner", "A", 1, 900, 900);
    add("base1", "B", 0, 600);
    add("corner", "B", 1, 900, 900);
    add("base1", "C", 0);
    o.layout!.walls.push({ id: "island", name: "Ostrvo", length: 900 });
    add("island", "island", 0);
    const n = ensureLayout(o),
      before = structuredClone(n),
      plan = kitchenPlan(n, "all");
    expect(n.elements[2].placement!.offset).toBe(900);
    expect(n.elements[4].placement!.offset).toBe(900);
    expect(plan.walls.map((w) => w.scene.wall)).toEqual([
      "A",
      "B",
      "C",
      "island",
    ]);
    expect(planPoint(plan.walls[1], 2400, 0)).toEqual({ x: 2400, y: 2400 });
    expect(plan.walls[2]).toMatchObject({ x: 2400, y: 2400, angle: 180 });
    expect(plan.walls[3].island).toBe(true);
    expect(plan.bounds.height).toBeGreaterThan(2400);
    n.layout!.activeWall = "C";
    expect(kitchenPlan(n, "all")).toEqual(plan);
    n.layout!.activeWall = before.layout!.activeWall;
    expect(n).toEqual(before);
  });
});
