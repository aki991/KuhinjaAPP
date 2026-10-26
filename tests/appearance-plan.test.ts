import { describe, it, expect } from "vitest";
import { createOffer } from "../src/core/db";
import { calculateOffer } from "../src/core/engine";
import { newElement } from "../src/core/catalog";
import { defaultLayout, ensureLayout, newSpacer } from "../src/core/layout";
import {
  containedElevationCamera,
  elevationScene,
  toScreen,
} from "../src/core/elevation";
import { topViewEntries } from "../src/core/top-view";
import { effectiveSelection } from "../src/core/opening";
import { productAppearance, validAppearance } from "../src/core/appearance";
describe("Uklapanje, plan i izbor izgleda", () => {
  it("cela kuhinja sa visokim elementima staje u 360 px bez promene dimenzija i obračuna", () => {
    const o = ensureLayout(createOffer(true)),
      copy = structuredClone(o),
      scene = elevationScene(o, "A"),
      c = containedElevationCamera(scene, 328, 416, 148);
    expect(c.canvasWidth).toBe(328);
    expect(c.canvasHeight).toBe(c.viewportHeight);
    expect(c.focusLeft).toBe(0);
    expect(c.focusTop).toBe(0);
    for (const e of scene.entries) {
      const r = toScreen(e.rect, c.scale, scene.height, c.margin);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(c.canvasWidth + 0.001);
      expect(r.y + r.height).toBeLessThanOrEqual(c.canvasHeight);
    }
    expect(o).toEqual(copy);
    expect(calculateOffer(o).total).toBe(calculateOffer(copy).total);
  });
  it("pogled odozgo koristi stvarnu dubinu, redosled, količinu i razmake; filteri su nezavisni", () => {
    const o = createOffer();
    o.layout = defaultLayout("Prava kuhinja", 3000);
    o.elements = [
      {
        ...newElement("base1"),
        id: "b",
        quantity: 2,
        depth: 560,
        placement: { wall: "A", offset: 0, order: 0 },
      },
      {
        ...newElement("wall1"),
        id: "w",
        depth: 320,
        placement: { wall: "A", offset: 0, order: 0 },
      },
    ];
    const gap = newSpacer("A", "base", 200);
    gap.placement.order = 1;
    o.layout.spacers = [gap];
    const scene = elevationScene(ensureLayout(o), "A"),
      copy = structuredClone(scene);
    const base = topViewEntries(scene, "base"),
      wall = topViewEntries(scene, "wall");
    expect(base).toHaveLength(3);
    expect(wall).toHaveLength(1);
    expect(wall[0].depth).toBe(320);
    expect(
      base
        .filter((e) => e.entry.id === "b")
        .map((e) => [e.x, e.width, e.depth]),
    ).toEqual([
      [0, 600, 560],
      [600, 600, 560],
    ]);
    expect(base.find((e) => e.entry.id === gap.id)!.x).toBe(1200);
    expect(topViewEntries(scene, "all")).toHaveLength(4);
    expect(scene).toEqual(copy);
  });
  it("front kao korpus koristi njegov materijal i cenu; zaključani front ostaje nezavisan", () => {
    const o = createOffer(true),
      before = calculateOffer(o);
    o.elements[0].locked = true;
    o.selection.frontMode = "body";
    o.selection.body = "body-oak";
    const c = calculateOffer(o);
    expect(c.errors).toEqual([]);
    expect(effectiveSelection(o.elements[0], o.selection).front).toBe(
      "front-mdf",
    );
    expect(effectiveSelection(o.elements[1], o.selection).front).toBe(
      "body-oak",
    );
    expect(
      c.elements[1].panels
        .filter((p) => p.name.startsWith("Front"))
        .every((p) => p.material === "body-oak"),
    ).toBe(true);
    expect(c.total).not.toBe(before.total);
  });
  it("zasebna ručica visećih ne menja GOLA donjih, broj mehanizama ili individualni izbor", () => {
    const o = createOffer(true);
    o.selection.opening = "gola";
    o.selection.wallHandle = "handle-alt";
    o.prices.push({
      ...o.prices.find((p) => p.id === "handle")!,
      id: "handle-alt",
      price: 800,
    });
    const c = calculateOffer(o);
    expect(c.errors).toEqual([]);
    expect(
      c.elements[5].hardware.find((h) => h.label === "Ručke")!.product,
    ).toBe("handle-alt");
    expect(c.elements[0].hardware.some((h) => h.label === "Ručke")).toBe(false);
    expect(c.usage.find((u) => u.product.id === "handle-alt")!.quantity).toBe(
      4,
    );
  });
  it("RAL boja i položaj ručice ne menjaju potrošnju ni cenu izabranog lakiranog artikla", () => {
    const o = createOffer(true);
    o.selection.front = "front-lacquer";
    o.selection.frontMode = "ral";
    const before = calculateOffer(o);
    o.selection.ralColor = "#193847";
    o.selection.ralCode = "Test";
    o.selection.handlePosition = "horizontal";
    expect(calculateOffer(o)).toEqual(before);
    const scene = elevationScene(ensureLayout(o), "A");
    expect(
      scene.entries.find((e) => e.id === o.elements[0].id)!.finish!.front.color,
    ).toBe("#193847");
  });
  it("nova radna ploča nasleđuje izabranu debljinu, a neispravni vizuelni podaci se odbijaju", () => {
    const o = createOffer();
    o.selection.worktopThickness = 28;
    expect(newElement("worktop", o.selection).height).toBe(28);
    expect(validAppearance({ color: "#102030", texture: "wood" })).toBe(true);
    expect(
      validAppearance({ color: "url(https://example.org)", texture: "solid" }),
    ).toBe(false);
    expect(
      validAppearance({
        color: "#ffffff",
        texture: "solid",
        image: "data:image/svg+xml;base64,AAAA",
      }),
    ).toBe(false);
    expect(
      productAppearance(o.prices.find((p) => p.id === "body-oak")).texture,
    ).toBe("wood");
  });
});
