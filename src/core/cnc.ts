import { calculateOffer } from "./engine";
import { hingesForHeight } from "./construction";
import { effectiveSelection } from "./opening";
import { cutList } from "./cutlist";
import type { KitchenElement, Offer, Panel, Selection } from "./types";

/**
 * Demo exports for a cutting shop and a CNC drill. The drilling rules below are common
 * workshop conventions (32 mm system, Ø35 hinge cups), not a specific machine's standard,
 * and the WTINPUT text is a plain parts list: check both against the shop's own format.
 */
interface Hole {
  x: number;
  y: number;
  diameter: number;
  depth: number;
}

const FRONT_EDGE = 37; // distance of the system-hole columns from the panel edges
const PITCH = 32;

/** Holes for one piece, in panel coordinates: origin bottom-left, x = width, y = height. */
export function panelHoles(
  panel: Panel,
  element: KitchenElement,
  sel: Selection,
): Hole[] {
  const holes: Hole[] = [],
    { width: w, height: h } = panel;
  if (/^(Leva|Desna) stranica$/.test(panel.name) && w > 2 * FRONT_EDGE) {
    // System holes for shelf pins and fittings, two columns, every 32 mm.
    for (let y = 64; y <= h - 64; y += PITCH)
      for (const x of [FRONT_EDGE, w - FRONT_EDGE])
        holes.push({ x, y, diameter: 5, depth: 13 });
  }
  const door = /^Front vrata (\d+)$/.exec(panel.name);
  if (door) {
    // Hinge cups Ø35 on the hinge side, 100 mm from the ends.
    const index = Number(door[1]) - 1,
      right =
        element.doors === 1
          ? element.visual?.hinge === "right"
          : index % 2 === 1,
      x = right ? w - 22.5 : 22.5,
      count = hingesForHeight(h);
    for (let i = 0; i < count; i++)
      holes.push({
        x,
        y: 100 + (i * (h - 200)) / (count - 1),
        diameter: 35,
        depth: 12.5,
      });
  }
  if (/^Front (vrata|fioke)/.test(panel.name) && sel.opening === "handles") {
    // Two Ø5 handle holes, 128 mm apart.
    const vertical = !!door && w < h;
    for (const d of [-64, 64])
      holes.push(
        vertical
          ? { x: w / 2, y: h * 0.75 + d, diameter: 5, depth: panel.thickness }
          : { x: w / 2 + d, y: Math.min(h - 40, 40), diameter: 5, depth: panel.thickness },
      );
  }
  return holes;
}

const num = (n: number) => n.toFixed(3);
const layerName = (h: Hole) => `DRILL_D${h.diameter}_Z${h.depth}`;

function dxfDocument(layers: Map<string, number>, entities: string[]) {
  const out: string[] = [];
  const add = (...rows: (string | number)[]) =>
    rows.forEach((r) => out.push(String(r)));
  add(0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1009", 0, "ENDSEC");
  add(0, "SECTION", 2, "TABLES");
  add(0, "TABLE", 2, "LTYPE", 70, 1);
  add(0, "LTYPE", 2, "CONTINUOUS", 70, 0, 3, "Solid line", 72, 65, 73, 0, 40, 0);
  add(0, "ENDTAB");
  add(0, "TABLE", 2, "LAYER", 70, layers.size);
  for (const [name, color] of layers)
    add(0, "LAYER", 2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  add(0, "ENDTAB", 0, "ENDSEC");
  add(0, "SECTION", 2, "ENTITIES");
  out.push(...entities);
  add(0, "ENDSEC", 0, "EOF");
  return out.join("\r\n");
}

/** All pieces on one drawing, each with its outline and drilled circles; layers carry diameter and depth. */
export function drillingDxf(offer: Offer) {
  const calc = calculateOffer(offer),
    layers = new Map<string, number>([
      ["PANEL", 7],
      ["LABEL", 3],
    ]),
    entities: string[] = [];
  const add = (...rows: (string | number)[]) =>
    rows.forEach((r) => entities.push(String(r)));
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    add(0, "LINE", 8, "PANEL", 10, num(x1), 20, num(y1), 11, num(x2), 21, num(y2));
  const GAP = 80,
    ROW = 6000;
  let cursorX = 0,
    cursorY = 0,
    rowHeight = 0,
    colorIndex = 1;
  for (const result of calc.elements) {
    const element = result.element,
      sel = effectiveSelection(element, offer.selection);
    for (const panel of result.panels) {
      const pieces = panel.quantity * element.quantity;
      for (let n = 0; n < pieces; n++) {
        if (cursorX > 0 && cursorX + panel.width > ROW) {
          cursorX = 0;
          cursorY -= rowHeight + GAP;
          rowHeight = 0;
        }
        const x0 = cursorX,
          y0 = cursorY - panel.height;
        line(x0, y0, x0 + panel.width, y0);
        line(x0 + panel.width, y0, x0 + panel.width, y0 + panel.height);
        line(x0 + panel.width, y0 + panel.height, x0, y0 + panel.height);
        line(x0, y0 + panel.height, x0, y0);
        add(
          0, "TEXT", 8, "LABEL", 10, num(x0 + 10), 20, num(y0 + panel.height - 30),
          40, 18, 1, `${panel.name} ${Math.round(panel.width)}x${Math.round(panel.height)}`,
        );
        for (const hole of panelHoles(panel, element, sel)) {
          const name = layerName(hole);
          if (!layers.has(name)) layers.set(name, (colorIndex++ % 6) + 1);
          add(
            0, "CIRCLE", 8, name, 10, num(x0 + hole.x), 20, num(y0 + hole.y),
            40, num(hole.diameter / 2),
          );
        }
        cursorX += panel.width + GAP;
        rowHeight = Math.max(rowHeight, panel.height);
      }
    }
  }
  return dxfDocument(layers, entities);
}

/**
 * Plain parts list for the cutting shop: one tab-separated line per distinct part.
 * Length is the larger side; grain runs along the length.
 */
export function wtInput(offer: Offer) {
  const header = [
    "Naziv",
    "Materijal",
    "Debljina",
    "Duzina",
    "Sirina",
    "Komada",
    "Rotacija",
    "Kant_m",
    "Element",
  ].join("\t");
  const rows = cutList(offer).map((r) =>
    [
      r.part,
      r.material,
      r.thickness,
      Math.max(r.width, r.height),
      Math.min(r.width, r.height),
      r.quantity,
      0,
      r.edge.toFixed(3),
      r.code,
    ].join("\t"),
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}
