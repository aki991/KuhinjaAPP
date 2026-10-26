import type {
  KitchenElement,
  KitchenLayout,
  KitchenWall,
  LayoutItem,
  LayoutLane,
  LayoutRow,
  LayoutSpacer,
  Offer,
  Placement,
} from "./types";
import { uid } from "./catalog";
export const isSpacer = (e: LayoutItem): e is LayoutSpacer =>
  e.kind === "spacer";
export const rowOf = (e: LayoutItem): LayoutRow =>
  isSpacer(e)
    ? e.placement.row === "wall"
      ? "wall"
      : "base"
    : ["worktop", "side", "plinth", "panel"].includes(e.kind)
      ? "extra"
      : ["wall1", "wall2", "lift", "open"].includes(e.kind)
        ? "wall"
        : ["tall", "fridge", "tallOven"].includes(e.kind)
          ? "tall"
          : "base";
export const laneOf = (e: LayoutItem): LayoutLane =>
  rowOf(e) === "tall" ? "base" : (rowOf(e) as LayoutLane);
export const rowName: Record<LayoutRow, string> = {
  base: "Donji",
  wall: "Viseći",
  tall: "Visoki",
  extra: "Ostali",
};
export const sameLane = (a: LayoutItem, b: LayoutItem) =>
  laneOf(a) === laneOf(b);
export const span = (e: LayoutItem) => e.width * e.quantity;
export const endOf = (e: LayoutItem) => (e.placement?.offset || 0) + span(e);
const position = (e: LayoutItem) =>
  e.placement?.order ?? e.placement?.offset ?? 0;
export function defaultLayout(shape: string, length = 3000): KitchenLayout {
  const walls: KitchenWall[] = [{ id: "A", name: "Zid A", length }];
  if (shape.startsWith("L") || shape.startsWith("U"))
    walls.push({ id: "B", name: "Zid B", length });
  if (shape.startsWith("U")) walls.push({ id: "C", name: "Zid C", length });
  if (shape === "Sa ostrvom")
    walls.push({ id: "island", name: "Ostrvo", length });
  return { walls, activeWall: "A", version: 3, spacers: [] };
}
export const allLayoutItems = (
  elements: KitchenElement[],
  layout?: KitchenLayout,
): LayoutItem[] => [...elements, ...(layout?.spacers || [])];
export function orderedLane(
  elements: KitchenElement[],
  layout: KitchenLayout | undefined,
  wall: string,
  row: LayoutLane,
) {
  return allLayoutItems(elements, layout)
    .filter((e) => e.placement?.wall === wall && laneOf(e) === row)
    .sort((a, b) => position(a) - position(b));
}
export function appendPlacement(
  elements: KitchenElement[],
  element: LayoutItem,
  wall: string,
  layout?: KitchenLayout,
): Placement {
  const items = orderedLane(elements, layout, wall, laneOf(element));
  return {
    wall,
    row: laneOf(element),
    order: items.reduce((a, e) => Math.max(a, e.placement?.order ?? 0), -1) + 1,
    offset: items.reduce((a, e) => a + span(e), 0),
  };
}
export function newSpacer(
  wall: string,
  row: "base" | "wall",
  width = 300,
): LayoutSpacer {
  return {
    id: uid(),
    kind: "spacer",
    width,
    quantity: 1,
    placement: { wall, row, order: Number.MAX_SAFE_INTEGER, offset: 0 },
  };
}

/** Recomputes all offsets. This never changes cabinet size, quantity or wall. */
export function packLayout(elements: KitchenElement[], layout: KitchenLayout) {
  const nextElements = structuredClone(elements),
    nextLayout = structuredClone(layout);
  nextLayout.version = 3;
  nextLayout.spacers ||= [];
  const items = allLayoutItems(nextElements, nextLayout);
  for (const wall of nextLayout.walls)
    for (const row of ["base", "wall", "extra"] as LayoutLane[]) {
      let offset = 0;
      const lane = items
        .filter((e) => e.placement?.wall === wall.id && laneOf(e) === row)
        .sort((a, b) => position(a) - position(b));
      lane.forEach((e, order) => {
        e.placement = {
          wall: wall.id,
          row,
          order,
          offset: row === "extra" ? 0 : offset,
        };
        if (row !== "extra") offset += span(e);
      });
    }
  return { elements: nextElements, layout: nextLayout };
}
export function ensureLayout<T extends Offer>(offer: T): T {
  const next = structuredClone(offer),
    legacy = !!next.layout && next.layout.version !== 3;
  next.layout ||= defaultLayout(next.client.layout);
  if (
    next.elements.some((e) => e.kind === "island") &&
    !next.layout.walls.some((w) => w.id === "island")
  )
    next.layout.walls.push({ id: "island", name: "Ostrvo", length: 3000 });
  if (!next.layout.walls.some((w) => w.id === next.layout!.activeWall))
    next.layout.activeWall = next.layout.walls[0].id;
  next.layout.spacers ||= [];
  const placed: KitchenElement[] = [];
  for (const e of next.elements) {
    if (
      !e.placement ||
      !next.layout.walls.some((w) => w.id === e.placement!.wall)
    )
      e.placement = appendPlacement(
        placed,
        e,
        e.kind === "island" ? "island" : next.layout.activeWall,
      );
    placed.push(e);
  }
  if (legacy) {
    // Absolute gaps cannot reveal whether a user intended them: preserve every positive gap.
    for (const wall of next.layout.walls)
      for (const row of ["base", "wall"] as LayoutLane[]) {
        const lane = orderedLane(next.elements, next.layout, wall.id, row).sort(
          (a, b) => (a.placement?.offset || 0) - (b.placement?.offset || 0),
        );
        let legacyEnd = 0,
          order = 0;
        for (const item of lane) {
          const offset = item.placement!.offset;
          if (offset > legacyEnd) {
            const gap = newSpacer(
              wall.id,
              row as "base" | "wall",
              offset - legacyEnd,
            );
            gap.placement.order = order++;
            next.layout.spacers.push(gap);
          }
          if (offset < legacyEnd) {
            const note =
              "Prethodni raspored je imao preklapanje. Elementi su složeni po redosledu; proverite raspored.";
            next.layout.migrationNotes = [
              ...new Set([...(next.layout.migrationNotes || []), note]),
            ];
          }
          legacyEnd = Math.max(legacyEnd, offset + span(item));
          item.placement = { ...item.placement!, row, order: order++ };
        }
      }
  }
  const packed = packLayout(next.elements, next.layout);
  next.elements = packed.elements;
  next.layout = packed.layout;
  if (!offer.layout)
    for (const wall of next.layout.walls)
      wall.length = Math.max(
        wall.length,
        ...allLayoutItems(next.elements, next.layout)
          .filter((e) => e.placement?.wall === wall.id && laneOf(e) !== "extra")
          .map(endOf),
      );
  next.variants = next.variants.map((v) => {
    const normalized = ensureLayout({
      ...next,
      ...v,
      layout: v.layout,
      variants: [],
    });
    return { ...v, elements: normalized.elements, layout: normalized.layout };
  });
  return next;
}
export function wallElements(
  elements: KitchenElement[],
  wall: string,
  layout?: KitchenLayout,
): LayoutItem[] {
  return allLayoutItems(elements, layout)
    .filter((e) => e.placement?.wall === wall)
    .sort((a, b) => {
      const laneOrder = { base: 0, wall: 1, extra: 2 };
      return (
        laneOrder[laneOf(a)] - laneOrder[laneOf(b)] || position(a) - position(b)
      );
    });
}
export function wallUsage(
  elements: KitchenElement[],
  wall: KitchenWall,
  layout?: KitchenLayout,
) {
  const items = wallElements(elements, wall.id, layout).filter(
    (e) => laneOf(e) !== "extra",
  );
  const base = items
      .filter((e) => laneOf(e) === "base")
      .reduce((a, e) => a + span(e), 0),
    upper = items
      .filter((e) => laneOf(e) === "wall")
      .reduce((a, e) => a + span(e), 0),
    occupied = Math.max(base, upper);
  return {
    occupied,
    free: Math.max(0, wall.length - occupied),
    overrun: Math.max(0, occupied - wall.length),
    overlaps: [] as string[],
    extent: Math.max(wall.length, occupied),
    base,
    upper,
  };
}
export const canPlace = (item: LayoutItem, row: LayoutLane) =>
  isSpacer(item) ? row === "base" || row === "wall" : laneOf(item) === row;
export function relocateItem(
  elements: KitchenElement[],
  layout: KitchenLayout,
  id: string,
  wall: string,
  row: LayoutLane,
  index: number,
) {
  const item = allLayoutItems(elements, layout).find((e) => e.id === id);
  if (!item || !layout.walls.some((w) => w.id === wall) || !canPlace(item, row))
    return null;
  const cloneElements = structuredClone(elements),
    cloneLayout = structuredClone(layout),
    items = allLayoutItems(cloneElements, cloneLayout),
    moving = items.find((e) => e.id === id)!;
  const target = orderedLane(cloneElements, cloneLayout, wall, row).filter(
    (e) => e.id !== id,
  );
  target.splice(Math.max(0, Math.min(index, target.length)), 0, moving);
  target.forEach((e, order) => {
    e.placement = { wall, row, order, offset: 0 };
  });
  return packLayout(cloneElements, cloneLayout);
}
export function moveLayoutItem(
  elements: KitchenElement[],
  layout: KitchenLayout,
  id: string,
  direction: -1 | 1,
) {
  const selected = allLayoutItems(elements, layout).find((e) => e.id === id);
  if (!selected?.placement) return null;
  const lane = orderedLane(
      elements,
      layout,
      selected.placement.wall,
      laneOf(selected),
    ),
    index = lane.findIndex((e) => e.id === id),
    target = index + direction;
  if (target < 0 || target >= lane.length) return null;
  return relocateItem(
    elements,
    layout,
    id,
    selected.placement.wall,
    laneOf(selected),
    target,
  );
}
/** Kept for older callers; all real project operations use moveLayoutItem with spacers. */
export function moveElement(
  elements: KitchenElement[],
  id: string,
  direction: -1 | 1,
) {
  const walls = [...new Set(elements.map((e) => e.placement?.wall || "A"))].map(
      (id) => ({ id, name: id, length: 3000 }),
    ),
    layout: KitchenLayout = {
      version: 3,
      walls,
      activeWall: walls[0]?.id || "A",
      spacers: [],
    };
  return moveLayoutItem(elements, layout, id, direction)?.elements || elements;
}
export const displayProject = (name: string) =>
  name.replace(/\s*[—–-]\s*Demo\s*$/i, "");
export function elementCodes(
  elements: KitchenElement[],
  layout?: KitchenLayout,
) {
  const counts = { base: 0, wall: 0, tall: 0, extra: 0, spacer: 0 };
  return new Map(
    allLayoutItems(elements, layout).map((e) => {
      if (isSpacer(e)) return [e.id, `R${++counts.spacer}`];
      const row = rowOf(e);
      return [
        e.id,
        `${{ base: "D", wall: "V", tall: "T", extra: "O" }[row]}${++counts[row]}`,
      ];
    }),
  );
}
