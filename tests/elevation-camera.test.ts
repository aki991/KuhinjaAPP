import { describe, it, expect } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { defaultLayout, ensureLayout } from "../src/core/layout";
import {
  elevationCamera,
  elevationScene,
  kitchenBounds,
  toScreen,
} from "../src/core/elevation";
import type { ElementKind } from "../src/core/types";

function kitchen(
  widths: number[],
  length = widths.reduce((a, w) => a + w, 0),
  upper = false,
) {
  const o = createOffer();
  o.layout = defaultLayout("L kuhinja", length);
  o.elements = widths.map((w, i) => ({
    ...newElement("base1", o.selection),
    width: w,
    id: `base-${i}`,
    placement: { wall: "A", offset: 0, order: i },
  }));
  if (upper)
    widths.forEach((w, i) =>
      o.elements.push({
        ...newElement("wall1", o.selection),
        width: w,
        id: `upper-${i}`,
        placement: { wall: "A", offset: 0, order: i },
      }),
    );
  return ensureLayout(o);
}
describe("Kamera 2D prikaza usmerena na kuhinju", () => {
  it("fullscreen uklapa stvarni okvir u portrait i landscape sa prostorom za kontrole", () => {
    const scene = elevationScene(
      kitchen([600, 400, 600, 400], 2000, true),
      "A",
    );
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [932, 430],
    ]) {
      const c = elevationCamera(scene, width, height, 1, true);
      expect(c.viewportHeight).toBe(height);
      for (const e of scene.entries) {
        const r = toScreen(e.rect, c.scale, scene.height, c.margin);
        expect(r.y - c.focusTop).toBeGreaterThanOrEqual(95);
        expect(r.y + r.height - c.focusTop).toBeLessThanOrEqual(height - 39);
        expect(r.width / r.height).toBeCloseTo(e.rect.width / e.rect.height);
      }
      expect(c.bounds.width * c.scale).toBeLessThanOrEqual(width - 44);
    }
  });
  for (const width of [320, 350, 390]) {
    it(`2000 mm koristi širinu ${width}px, bez praznog prostora cele prostorije`, () => {
      const o = kitchen([600, 400, 600, 400]),
        snapshot = structuredClone(o),
        scene = elevationScene(o, "A"),
        c = elevationCamera(scene, width, 420);
      expect(c.bounds.width * c.scale).toBeCloseTo(width - 44);
      expect(c.viewportHeight).toBeLessThan(270);
      expect(c.bounds.height).toBe(820);
      expect((c.bounds.width * c.scale) / width).toBeGreaterThan(0.85);
      for (const e of scene.entries) {
        const r = toScreen(e.rect, c.scale, scene.height, c.margin);
        expect(r.width / r.height).toBeCloseTo(e.rect.width / e.rect.height);
        expect(r.y - c.focusTop).toBeGreaterThanOrEqual(38);
        expect(r.y + r.height - c.focusTop).toBeLessThan(c.viewportHeight - 40);
      }
      expect(o).toEqual(snapshot);
    });
  }
  it("3200 mm prikazuje stvarni razmak dva reda bez smanjivanja na visinu zida", () => {
    const o = kitchen([600, 800, 600, 600, 600], 3200, true),
      scene = elevationScene(o, "A"),
      c = elevationCamera(scene, 320, 416);
    const base = toScreen(
        scene.entries.find((e) => e.row === "base")!.rect,
        c.scale,
        scene.height,
        c.margin,
      ),
      upper = toScreen(
        scene.entries.find((e) => e.row === "wall")!.rect,
        c.scale,
        scene.height,
        c.margin,
      );
    expect(base.y - upper.y - upper.height).toBeCloseTo(600 * c.scale);
    expect(base.width).toBeGreaterThan(80);
    expect(c.viewportHeight).toBeLessThanOrEqual(416);
    expect(c.canvasWidth).toBeGreaterThan(320);
    expect(c.bounds.height * c.scale + 104).toBeLessThanOrEqual(416);
  });
  it("4500 mm zadržava čitljive frontove uz horizontalno pomeranje", () => {
    const scene = elevationScene(
        kitchen([600, 600, 600, 600, 600, 600, 600, 300]),
        "A",
      ),
      c = elevationCamera(scene, 320, 416);
    expect(c.scale).toBeGreaterThanOrEqual(0.14);
    expect(c.canvasWidth).toBeGreaterThan(320);
    expect(c.viewportHeight).toBeLessThan(270);
  });
  it("visina prostorije i udaljene prepreke ne menjaju razmeru ili početni položaj elemenata u kadru", () => {
    const o = kitchen([600, 400, 600, 400]),
      initial = elevationScene(o, "A"),
      baseline = elevationCamera(initial, 320, 416);
    for (const height of [1800, 2600, 4000, 10000]) {
      o.elevation!.wallHeight = height;
      o.elevation!.objects = [
        {
          id: "far",
          wall: "A",
          kind: "window",
          x: 15000,
          width: 2000,
          height: 2000,
          bottom: 7000,
        },
      ];
      const scene = elevationScene(o, "A"),
        c = elevationCamera(scene, 320, 416),
        r = toScreen(scene.entries[0].rect, c.scale, scene.height, c.margin),
        original = toScreen(
          initial.entries[0].rect,
          baseline.scale,
          initial.height,
          baseline.margin,
        );
      expect(c.scale).toBe(baseline.scale);
      expect(c.viewportHeight).toBe(baseline.viewportHeight);
      expect(
        Math.abs(r.y - c.focusTop - (original.y - baseline.focusTop)),
      ).toBeLessThan(1);
      expect(scene.objects[0].bottom).toBe(7000);
      expect(scene.entries[0].rect).toEqual(initial.entries[0].rect);
    }
  });
  it("visoki elementi staju u razumnu visinu; samo viseći red ne zahteva prostor do poda", () => {
    const o = kitchen([600, 800], 2000, true);
    o.elements[1] = {
      ...newElement("tall", o.selection),
      id: "tall",
      height: 2400,
      placement: { wall: "A", offset: 0, order: 1 },
    };
    const scene = elevationScene(o, "A"),
      c = elevationCamera(scene, 320, 416);
    expect(c.bounds.height).toBe(2500);
    expect(c.bounds.height * c.scale + 104).toBeLessThanOrEqual(416);
    const upperOnly = kitchen([600, 600]);
    upperOnly.elements.forEach((e) => {
      e.kind = "wall1" as ElementKind;
      e.height = 720;
    });
    const upper = elevationScene(upperOnly, "A");
    expect(kitchenBounds(upper).height).toBe(720);
    expect(kitchenBounds(upper).y).toBe(1420);
  });
  it("zumiranje čuva proporcije i veličinu kontejnera, Uklopi je ponovljiv", () => {
    const scene = elevationScene(kitchen([600, 400, 600, 400]), "A"),
      a = elevationCamera(scene, 320, 416),
      b = elevationCamera(scene, 320, 416, 2);
    expect(b.scale / a.scale).toBe(2);
    expect(b.viewportHeight).toBe(a.viewportHeight);
    expect(b.canvasWidth).toBeGreaterThan(a.canvasWidth);
    expect(elevationCamera(scene, 320, 416)).toEqual(a);
  });
});
