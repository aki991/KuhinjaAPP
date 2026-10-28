import { describe, expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { elevationScene } from "../src/core/elevation";
import { ensureLayout } from "../src/core/layout";

describe("Aspirator", () => {
  it("viseći za aspirator je visok 720 zajedno sa telom aparata i poravnat sa susednim", () => {
    const o = createOffer();
    o.elements = [newElement("wall1"), newElement("reference038")];
    const s = elevationScene(ensureLayout(o), "A"),
      normal = s.entries[0],
      hood = s.entries[1];
    expect(hood.rect.height).toBe(680);
    expect(hood.rect.y + hood.rect.height).toBe(normal.rect.y + normal.rect.height);
    expect(hood.visible[0].y).toBe(normal.rect.y);
  });
  it("samostojeća dekorativna napa je u visećem redu i ne pomera ostale elemente", () => {
    const o = createOffer();
    o.elements = [newElement("freeHood"), newElement("wall1")];
    const n = ensureLayout(o),
      s = elevationScene(n, "A");
    expect(s.entries.every((e) => e.row === "wall")).toBe(true);
    expect(s.entries[1].rect.x).toBe(n.elements[0].width);
  });
});

describe("Most", () => {
  it("veća visina mosta raste nadole, gornja ivica ostaje", () => {
    const make = (height: number) => {
      const o = createOffer(),
        bridge = newElement("wallBridgeFridge");
      bridge.height = height;
      o.elements = [newElement("wall1"), bridge];
      const e = elevationScene(ensureLayout(o), "A").entries.find(
        (x) => x.item.kind === "wallBridgeFridge",
      )!;
      return e.rect.y + e.rect.height;
    };
    expect(make(700)).toBe(make(400));
  });
});
