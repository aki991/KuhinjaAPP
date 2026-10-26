import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import {
  defaultLayout,
  ensureLayout,
  moveLayoutItem,
  newSpacer,
  relocateItem,
  orderedLane,
} from "../src/core/layout";
import {
  defaultElevation,
  elevationScene,
  ensureElevation,
  fitElevation,
  intersects,
  subtractRect,
  toScreen,
} from "../src/core/elevation";
import { calculateOffer } from "../src/core/engine";
import type { ElementKind, Offer } from "../src/core/types";
import WallElevation from "../src/components/elevation/WallElevation";
function project(kinds: ElementKind[] = ["base1", "base1", "base1"]): Offer {
  const o = createOffer();
  o.layout = defaultLayout("L kuhinja", 3000);
  o.elements = kinds.map((kind, i) => ({
    ...newElement(kind, o.selection),
    id: `e${i}`,
    placement: { wall: "A", offset: 0, order: i },
  }));
  return ensureElevation(ensureLayout(o));
}
describe("Zajednička geometrija 2D elevacije", () => {
  it("600/600/600 -> 600/400/600 koristi iste pozicije kao jednostavni prikaz, bez mutiranja projekta", () => {
    const o = project();
    o.elements.forEach((e) => (e.width = 600));
    const before = structuredClone(o);
    expect(elevationScene(o, "A").entries.map((e) => e.rect.x)).toEqual([
      0, 600, 1200,
    ]);
    expect(o).toEqual(before);
    o.elements[1].width = 400;
    const scene = elevationScene(o, "A");
    expect(scene.entries.map((e) => e.rect.x)).toEqual([0, 600, 1000]);
    expect(scene.entries.map((e) => e.rect.x)).toEqual(
      orderedLane(ensureLayout(o).elements, o.layout, "A", "base").map(
        (e) => e.placement!.offset,
      ),
    );
  });
  it("pomeranje, brisanje, dodavanje i prelazak na drugi zid koriste postojeće funkcije", () => {
    let o = project();
    o.elements.forEach((e) => (e.width = 600));
    o = { ...o, ...moveLayoutItem(o.elements, o.layout!, "e2", -1)! };
    expect(
      elevationScene(o, "A").entries.find((e) => e.id === "e2")!.rect.x,
    ).toBe(600);
    o.elements = o.elements.filter((e) => e.id !== "e0");
    expect(
      elevationScene(o, "A").entries.find((e) => e.id === "e2")!.rect.x,
    ).toBe(0);
    o.elements.push({
      ...newElement("base2", o.selection),
      id: "added",
      placement: { wall: "A", offset: 9999, order: 99 },
    });
    expect(
      elevationScene(o, "A").entries.find((e) => e.id === "added")!.rect.x,
    ).toBe(1200);
    o = { ...o, ...relocateItem(o.elements, o.layout!, "e2", "B", "base", 0)! };
    expect(elevationScene(o, "B").entries[0].rect.x).toBe(0);
    expect(
      elevationScene(o, "A").entries.find((e) => e.id === "e1")!.rect.x,
    ).toBe(0);
  });
  it("iste razmere širine i visine, nezavisni redovi, namerni razmak i količina", () => {
    const o = project(["base1", "base2", "wall1"]);
    o.elements[0].width = 600;
    o.elements[1].width = 800;
    o.elements[2].height = 900;
    o.elements[2].quantity = 2;
    const spacer = newSpacer("A", "base", 200);
    spacer.placement.order = 1;
    o.elements[1].placement!.order = 2;
    o.layout!.spacers = [spacer];
    const s = elevationScene(o, "A");
    expect(s.entries.find((e) => e.id === "e1")!.rect.x).toBe(800);
    expect(s.entries.filter((e) => e.id === "e2").map((e) => e.rect.x)).toEqual(
      [0, o.elements[2].width],
    );
    const a = toScreen(
        s.entries.find((e) => e.id === "e0")!.rect,
        0.2,
        s.height,
      ),
      b = toScreen(s.entries.find((e) => e.id === "e1")!.rect, 0.2, s.height);
    expect(b.width / a.width).toBeCloseTo(800 / 600);
    expect(
      toScreen(s.entries.find((e) => e.id === "e2")!.rect, 0.2, s.height)
        .height,
    ).toBe(180);
    expect(fitElevation(s, 360)).toBeGreaterThan(0);
  });
  it("radna ploča prati stvarnu visinu korpusa, viseći razmak i nogice", () => {
    const o = project(["base1", "worktop", "wall1"]);
    o.elements[0].height = 780;
    o.elements[1].height = 38;
    o.elements[1].width = 1200;
    o.elevation!.toeKick = 120;
    o.elevation!.upperGap = 550;
    const s = elevationScene(o, "A");
    expect(s.entries.find((e) => e.id === "e0")!.rect.y).toBe(120);
    expect(s.entries.find((e) => e.id === "e1")!.rect.y).toBe(900);
    expect(s.entries.find((e) => e.id === "e2")!.rect.y).toBe(1488);
    o.elements[0].visual = { bottom: 200 };
    const raised = elevationScene(o, "A");
    expect(raised.entries.find((e) => e.id === "e1")!.rect.y).toBe(980);
    expect(raised.entries.find((e) => e.id === "e2")!.rect.y).toBe(1568);
    o.elements[1].visual = { bottom: 1100 };
    expect(
      elevationScene(o, "A").entries.find((e) => e.id === "e2")!.rect.y,
    ).toBe(1688);
  });
  it("ne crta viseći front preko visokog elementa i zadržava stvarne koordinate", () => {
    const o = project(["tall", "wall2"]);
    o.elements[0].width = 600;
    o.elements[0].height = 2200;
    o.elements[1].width = 800;
    const s = elevationScene(o, "A"),
      upper = s.entries.find((e) => e.id === "e1")!,
      tall = s.entries.find((e) => e.id === "e0")!;
    expect(upper.rect.x).toBe(0);
    expect(upper.visible.length).toBeGreaterThan(0);
    expect(upper.visible.every((r) => !intersects(r, tall.rect))).toBe(true);
    expect(s.warnings.join()).toContain("se preklapaju");
    const original = { x: 0, y: 0, width: 100, height: 100 },
      hole = { x: 20, y: 20, width: 30, height: 40 },
      pieces = subtractRect(original, hole);
    expect(pieces.reduce((a, r) => a + r.width * r.height, 0)).toBe(8800);
    expect(pieces.every((r) => !intersects(r, hole))).toBe(true);
  });
  it("prozori, vrata i prepreke pripadaju zidu, upozoravaju bez menjanja cene", () => {
    const o = project(["base1"]);
    const price = calculateOffer(o).total;
    o.elevation!.objects = [
      {
        id: "window",
        wall: "A",
        kind: "window",
        x: 200,
        width: 600,
        height: 700,
        bottom: 200,
      },
      {
        id: "door",
        wall: "B",
        kind: "door",
        x: 0,
        width: 800,
        height: 2100,
        bottom: 0,
      },
    ];
    const s = elevationScene(o, "A");
    expect(s.objects.map((o) => o.id)).toEqual(["window"]);
    expect(s.warnings.join()).toContain("Prozor se preklapa");
    expect(calculateOffer(o).total).toBe(price);
  });
  it("razlikuje vrata, fioke i aparate; GOLA i push nemaju klasične ručke", () => {
    const o = project(["base1", "drawer3", "oven", "fridge", "sink"]);
    o.elements[0].visual = { hinge: "right", glass: true };
    o.elements[1].visual = { hob: true };
    const render = () =>
      renderToStaticMarkup(
        <WallElevation
          scene={elevationScene(o, "A")}
          scale={0.2}
          selected={null}
        />,
      );
    let svg = render();
    expect(svg).toContain('data-opening-side="right"');
    expect(svg).toContain('data-front="glass"');
    expect(svg.match(/data-front="drawer"/g)).toHaveLength(3);
    for (const device of ["oven", "fridge", "sink", "hob"])
      expect(svg).toContain(`data-appliance="${device}"`);
    o.selection.opening = "gola";
    svg = render();
    expect(svg).not.toContain('class="technical-handle"');
    expect(svg).toContain('data-gola="horizontal"');
    o.selection.opening = "push";
    svg = render();
    expect(svg).not.toContain('class="technical-handle"');
    expect(svg).not.toContain("data-gola");
  });
  it("vizuelna podešavanja ne dodaju uređaje, materijal ili okove u kalkulaciju", () => {
    const o = ensureElevation(ensureLayout(createOffer(true))),
      cost = calculateOffer(o);
    const snapshot = structuredClone(o);
    o.elements.forEach(
      (e) =>
        (e.visual = {
          hinge: "right",
          glass: true,
          appliance: "dishwasher",
          hob: true,
          bottom: 200,
        }),
    );
    o.elevation = { ...defaultElevation(), toeKick: 130, upperGap: 500 };
    elevationScene(o, "A");
    expect(calculateOffer(o)).toEqual(cost);
    expect(snapshot.elements.some((e) => e.visual)).toBe(false);
  });
});
