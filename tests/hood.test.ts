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

it("slobodna mera u visećem redu ne prolazi preko frižidera", () => {
  const o = createOffer();
  o.layout = { walls: [{ id: "A", name: "Zid A", length: 3000 }], activeWall: "A", version: 3, spacers: [] };
  o.elements = [newElement("fridge"), newElement("base1"), newElement("wall1")];
  const scene = elevationScene(ensureLayout(o), "A");
  const html = renderToStaticMarkup(createElement(WallElevation, { scene, scale: 0.1, selected: null }));
  const free = [...html.matchAll(/data-free-length="([0-9]+)"/g)].map((m) => Number(m[1]));
  // donji red: 3000 - 600 - 600 = 1800; viseći red: od kraja visećeg (1200) do zida = 1800, bez 600 iznad frižidera
  expect(free).toEqual([1800, 1800]);
});

it("deo zida koji zauzima ugaoni element susednog zida je sivo polje sa imenom tog zida", () => {
  const o = createOffer();
  o.layout = {
    walls: [
      { id: "A", name: "Zid A", length: 2400 },
      { id: "B", name: "Zid B", length: 2400 },
    ],
    activeWall: "A",
    version: 3,
    spacers: [],
  };
  const corner = newElement("reference014");
  corner.placement = { wall: "A", row: "base", order: 1, offset: 0 };
  const a = newElement("base1");
  a.placement = { wall: "A", row: "base", order: 0, offset: 0 };
  a.width = 1350;
  const b = newElement("base1");
  b.placement = { wall: "B", row: "base", order: 0, offset: 0 };
  o.elements = [a, corner, b];
  const scene = elevationScene(ensureLayout(o), "B");
  const html = renderToStaticMarkup(createElement(WallElevation, { scene, scale: 0.1, selected: null }));
  expect(html).toContain('data-occupied-by="Zid A"');
  expect(html).toContain(">Zid A<");
});

it("prazno mesto posle obrisanog elementa ima svoju meru u prikazu spreda", async () => {
  const { removeItem, packLayout } = await import("../src/core/layout");
  const o = createOffer();
  o.layout = { walls: [{ id: "A", name: "Zid A", length: 3000 }], activeWall: "A", version: 3, spacers: [] };
  o.elements = [newElement("base1"), newElement("base1"), newElement("base1")];
  const ready = ensureLayout(o),
    packed = packLayout(ready.elements, ready.layout!);
  const after = removeItem(packed.elements, packed.layout, packed.elements[1].id)!;
  const scene = elevationScene({ ...o, elements: after.elements, layout: after.layout }, "A");
  const html = renderToStaticMarkup(createElement(WallElevation, { scene, scale: 0.1, selected: null }));
  const free = [...html.matchAll(/data-free-length="([0-9]+)"/g)].map((m) => Number(m[1]));
  // rupa od 600 usred reda i 1200 do kraja zida
  expect(free.sort((a, b) => a - b)).toEqual([600, 1200]);
});

it("ugaoni element ima iste boje okvira i linija kao ostali frontovi", () => {
  for (const kind of ["reference014", "reference035", "reference001"]) {
    const html = renderToStaticMarkup(
      createElement(ReferenceArtwork, { kind, width: 100, height: 100, handles: true, mirror: false }),
    );
    expect(html, kind).toContain("#a69472");
    expect(html, kind).not.toContain("#686d65");
  }
});

it("vrata elemenata iz kataloga crtaju se istom komponentom kao ostala vrata", () => {
  const html = (kind: string, handles = true) =>
    renderToStaticMarkup(
      createElement(ReferenceArtwork, { kind, width: 100, height: 100, handles, mirror: false }),
    );
  for (const kind of ["reference014", "reference035", "reference001"]) {
    const out = html(kind);
    expect(out, kind).toContain('data-front="door"');
    expect(out, kind).toContain("front-frame");
    expect(out, kind).toContain("front-inset");
    expect(out, kind).toContain("door-opening");
    expect(out, kind).toContain("technical-handle");
    // stara crtež-ručka i isprekidana linija iz kataloga se ne crtaju
    expect(out, kind).not.toContain("reference-handle");
    expect(out, kind).not.toContain("24 16");
    expect(html(kind, false), kind).not.toContain("technical-handle");
  }
});

import catalogRecords from "../src/core/reference-catalog";

it("svi elementi iz kataloga se crtaju bez greške, a vrata i fioke istim dizajnom", () => {
  let door = 0,
    drawer = 0;
  for (const record of catalogRecords) {
    const out = renderToStaticMarkup(
      createElement(ReferenceArtwork, { kind: record.kind, width: 100, height: 100, handles: true, mirror: false }),
    );
    expect(out.length, record.kind).toBeGreaterThan(50);
    if (out.includes('data-front="door"')) door++;
    if (out.includes('data-front="drawer"')) drawer++;
  }
  expect(door).toBeGreaterThan(20);
  expect(drawer).toBeGreaterThan(5);
});
