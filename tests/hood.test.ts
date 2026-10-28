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

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReferenceArtwork from "../src/components/elevation/ReferenceArtwork";

it("korpus aspiratora ima boje običnog elementa, samo telo aspiratora ima boju bele tehnike", () => {
  const html = renderToStaticMarkup(
    createElement(ReferenceArtwork, {
      kind: "reference038",
      width: 100,
      height: 100,
      handles: true,
      mirror: false,
      hood: true,
      applianceColor: "black",
    }),
  );
  // okvir korpusa ostaje sivi, a traka aspiratora je crna
  expect(html).toContain('stroke="#686d65"');
  expect(html).not.toContain("E4E6E3");
});

import WallElevation from "../src/components/elevation/WallElevation";

it("slobodna mera do kraja zida se smanjuje za širinu postavljenog elementa", () => {
  const free = (count: number) => {
    const o = createOffer();
    o.layout = { walls: [{ id: "A", name: "Zid A", length: 3200 }], activeWall: "A", version: 3, spacers: [] };
    o.elements = Array.from({ length: count }, () => newElement("base1"));
    const scene = elevationScene(ensureLayout(o), "A");
    const html = renderToStaticMarkup(
      createElement(WallElevation, { scene, scale: 0.1, selected: null }),
    );
    return [...html.matchAll(/data-free-length="(\d+)"/g)].map((m) => Number(m[1]));
  };
  expect(free(1)).toEqual([2600]);
  expect(free(2)).toEqual([2000]);
});
