import type {
  ElevationConfig,
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
import { isFreestanding, templates, uid } from "./catalog";
export const isSpacer = (e: LayoutItem): e is LayoutSpacer =>
  e.kind === "spacer";
/** Bridge cabinets sit above the wall cabinets, so they never use up wall-row length. */
export const isBridge = (e: LayoutItem) =>
  !isSpacer(e) &&
  (["wallBridgeFridge", "wallBridgeOven"].includes(e.kind) ||
    !!templates.find((t) => t.kind === e.kind)?.bridge);
export const rowOf = (e: LayoutItem): LayoutRow =>
  isSpacer(e)
    ? e.placement.row === "wall"
      ? "wall"
      : "base"
    : ["worktop", "side", "plinth", "panel", "filler"].includes(e.kind) ||
        isBridge(e)
      ? "extra"
      : // A tall free-standing appliance (fridge) is a tall cabinet: it does not set the height of the base row.
        isFreestanding(e.kind) && e.height >= 1500
        ? "tall"
        : templates.find((t) => t.kind === e.kind)?.group === "Gornji"
        ? "wall"
        : templates.find((t) => t.kind === e.kind)?.group === "Visoki"
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
export const connectedWalls = (layout: KitchenLayout) =>
  layout.walls.filter((w) => !w.id.startsWith("island")).slice(0, 3);
export interface JunctionReservation {
  wall: string;
  row: "base" | "wall";
  edge: "start" | "end";
  size: number;
  source: string;
  sourceWall: string;
}
/** A corner footprint belongs to one cabinet, never an extra priced element. */
export function junctionReservations(
  elements: KitchenElement[],
  layout: KitchenLayout,
) {
  const walls = connectedWalls(layout),
    reservations: JunctionReservation[] = [];
  const corner = (item: LayoutItem | undefined) =>
    item &&
    (["corner", "cornerBlind", "wallCorner"].includes(item.kind) ||
      templates.find((t) => t.kind === item.kind)?.corner);
  for (let i = 1; i < walls.length; i++) {
    const previous = walls[i - 1],
      next = walls[i];
    for (const row of ["base", "wall"] as const) {
      const before = orderedLane(elements, layout, previous.id, row),
        after = orderedLane(elements, layout, next.id, row),
        last = before.at(-1),
        first = after[0];
      const reserve = (
        wall: string,
        edge: "start" | "end",
        source: LayoutItem,
        sourceWall: string,
      ) => {
        if (!isSpacer(source))
          reservations.push({
            wall,
            row,
            edge,
            size: source.depth,
            source: source.id,
            sourceWall,
          });
      };
      if (corner(last)) reserve(next.id, "start", last!, previous.id);
      else if (corner(first)) reserve(previous.id, "end", first, next.id);
      else if (last && !isSpacer(last)) {
        const start = reservations
          .filter(
            (r) =>
              r.wall === previous.id && r.row === row && r.edge === "start",
          )
          .reduce((max, r) => Math.max(max, r.size), 0);
        const nextDepth = first && !isSpacer(first) ? first.depth : 0;
        const used = before.reduce(
          (sum, item) => sum + span(item) + (item.placement?.gap ?? 0),
          0,
        );
        if (
          start + used > previous.length - nextDepth ||
          start + used >= previous.length
        )
          reserve(next.id, "start", last, previous.id);
      }
    }
  }
  return reservations;
}
export function reservedLength(
  reservations: JunctionReservation[],
  wall: string,
  row: "base" | "wall",
  edge: "start" | "end",
) {
  return reservations
    .filter((r) => r.wall === wall && r.row === row && r.edge === edge)
    .reduce((max, r) => Math.max(max, r.size), 0);
}
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
/** Changing a room never discards cabinets, gaps or wall objects. */
export function spaceChange(offer: Offer, shape: string) {
  const next = structuredClone(offer),
    layout = next.layout!;
  if (shape === "Slobodan raspored") return { offer: next, affected: 0 };
  const required = shape.startsWith("U")
    ? ["A", "B", "C"]
    : shape.startsWith("L")
      ? ["A", "B"]
      : ["A"];
  const removed = layout.walls.filter(
    (w) => w.id !== "island" && !required.includes(w.id),
  );
  const ids = new Set(removed.map((w) => w.id));
  const items = allLayoutItems(next.elements, layout);
  const affectedItems = items.filter((item) =>
    ids.has(item.placement?.wall || ""),
  );
  const affectedObjects = (next.elevation?.objects || []).filter((object) =>
    ids.has(object.wall),
  );
  const affected = affectedItems.length + affectedObjects.length;
  const nextOrder = { base: 0, wall: 0, extra: 0 };
  for (const row of ["base", "wall", "extra"] as LayoutLane[])
    nextOrder[row] = orderedLane(next.elements, layout, "A", row).length;
  for (const item of affectedItems.sort(
    (a, b) =>
      (a.placement?.wall || "").localeCompare(b.placement?.wall || "") ||
      position(a) - position(b),
  )) {
    const row = laneOf(item);
    item.placement = { wall: "A", row, order: nextOrder[row]++, offset: 0 };
  }
  for (const object of affectedObjects) object.wall = "A";
  const oldWalls = layout.walls;
  layout.walls = required.map(
    (id) =>
      oldWalls.find((w) => w.id === id) || {
        id,
        name: `Zid ${id}`,
        length: oldWalls.find((w) => w.id === "A")?.length || 3000,
      },
  );
  const island = oldWalls.find((w) => w.id === "island");
  if (island || shape === "Sa ostrvom")
    layout.walls.push(island || { id: "island", name: "Ostrvo", length: 3000 });
  if (!layout.walls.some((w) => w.id === layout.activeWall))
    layout.activeWall = "A";
  if (affected)
    layout.migrationNotes = [
      ...new Set([
        ...(layout.migrationNotes || []),
        "Stavke sa uklonjenih zidova premeštene su na zid A. Proverite raspored i položaj prepreka.",
      ]),
    ];
  const packed = packLayout(next.elements, layout, next.elevation);
  return { offer: { ...next, ...packed }, affected };
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

/**
 * Wall lengths a lane cannot use: tall cabinets block the upper row, and wall objects
 * (windows, doors, columns, niches) block every row whose height band they cross.
 */
export function blockedSpans(
  items: LayoutItem[],
  wall: string,
  row: "base" | "wall",
  elevation?: Partial<ElevationConfig>,
) {
  const toeKick = elevation?.toeKick ?? 100,
    onWall = items.filter(
      (e): e is KitchenElement => !isSpacer(e) && e.placement?.wall === wall,
    ),
    lower = onWall.filter((e) => laneOf(e) === "base" && rowOf(e) !== "tall"),
    baseTop = lower.length
      ? Math.max(...lower.map((e) => (e.visual?.bottom ?? toeKick) + e.height))
      : toeKick + 720,
    worktop = Math.max(
      0,
      ...onWall.filter((e) => e.kind === "worktop").map((e) => e.height),
    ),
    upperBottom = baseTop + worktop + (elevation?.upperGap ?? 600),
    upperTop =
      upperBottom +
      Math.max(720, ...onWall.filter((e) => laneOf(e) === "wall").map((e) => e.height)),
    [bandBottom, bandTop] = row === "base" ? [0, baseTop] : [upperBottom, upperTop];
  const spans = (elevation?.objects || [])
    .filter(
      (o) =>
        o.wall === wall && o.bottom < bandTop && o.bottom + o.height > bandBottom,
    )
    .map((o) => ({ start: o.x, end: o.x + o.width }));
  if (row === "wall")
    for (const e of onWall.filter((e) => rowOf(e) === "tall"))
      spans.push({ start: e.placement!.offset, end: endOf(e) });
  return spans.sort((a, b) => a.start - b.start);
}
/** Moves a start offset past every blocked span the item would overlap. */
function freeOffset(offset: number, size: number, spans: { start: number; end: number }[]) {
  for (const s of spans)
    if (offset < s.end && offset + size > s.start) offset = s.end;
  return offset;
}
/** Recomputes all offsets. This never changes cabinet size, quantity or wall. */
export function packLayout(
  elements: KitchenElement[],
  layout: KitchenLayout,
  elevation?: Partial<ElevationConfig>,
) {
  const nextElements = structuredClone(elements),
    nextLayout = structuredClone(layout);
  nextLayout.version = 3;
  nextLayout.spacers ||= [];
  const items = allLayoutItems(nextElements, nextLayout);
  const reservations = junctionReservations(nextElements, nextLayout);
  for (const wall of nextLayout.walls)
    for (const row of ["base", "wall", "extra"] as LayoutLane[]) {
      let offset =
        row === "extra"
          ? 0
          : reservedLength(reservations, wall.id, row, "start");
      const lane = items
        .filter((e) => e.placement?.wall === wall.id && laneOf(e) === row)
        .sort((a, b) => position(a) - position(b));
      // Base is packed first, so tall cabinets already have their final offsets here.
      const spans =
        row === "extra" ? [] : blockedSpans(items, wall.id, row, elevation);
      lane.forEach((e, order) => {
        const gap = row === "extra" ? 0 : (e.placement?.gap ?? 0);
        if (row !== "extra") offset = freeOffset(offset + gap, span(e), spans);
        e.placement = {
          wall: wall.id,
          row,
          order,
          offset: row === "extra" ? 0 : offset,
          ...(gap > 0 ? { gap } : {}),
        };
        if (row !== "extra") offset += span(e);
      });
    }
  return {
    elements: syncAutoWorktops(nextElements, nextLayout),
    layout: nextLayout,
  };
}
/** Base cabinets that stand under the worktop (appliances that stand alone do not). */
const underWorktop = (e: LayoutItem): e is KitchenElement =>
  !isSpacer(e) &&
  !e.autoTopFor &&
  laneOf(e) === "base" &&
  rowOf(e) === "base" &&
  !isFreestanding(e.kind) &&
  templates.find((t) => t.kind === e.kind)?.group === "Donji";
/**
 * An automatic worktop is one piece per wall, as long as the sum of its base cabinets.
 * Older projects had one top per cabinet; those are merged into the wall's single top.
 */
function syncAutoWorktops(elements: KitchenElement[], layout: KitchenLayout) {
  const dropped = new Set<string>();
  for (const wall of layout.walls) {
    const tops = elements.filter(
      (e) => e.autoTopFor && e.placement?.wall === wall.id,
    );
    if (!tops.length) continue;
    const cabinets = elements.filter(
      (e) => underWorktop(e) && e.placement?.wall === wall.id,
    );
    if (!cabinets.length) {
      for (const top of tops) dropped.add(top.id);
      continue;
    }
    // Cabinets that touch share a worktop; an empty place between them splits it.
    const runs: { start: number; end: number }[] = [];
    for (const cabinet of [...cabinets].sort(
      (a, b) => a.placement!.offset - b.placement!.offset,
    )) {
      const last = runs.at(-1);
      if (last && cabinet.placement!.offset - last.end <= 1)
        last.end = Math.max(last.end, endOf(cabinet));
      else runs.push({ start: cabinet.placement!.offset, end: endOf(cabinet) });
    }
    const ordered = [...tops].sort(
      (a, b) => (a.visual?.offset ?? 0) - (b.visual?.offset ?? 0),
    );
    runs.forEach((run, i) => {
      let top = ordered[i];
      if (!top) {
        top = structuredClone(ordered[0]);
        top.id = uid();
        top.placement = {
          wall: wall.id,
          row: "extra",
          order: 1000 + i,
          offset: 0,
        };
        elements.push(top);
      }
      top.autoTopFor = wall.id;
      top.quantity = 1;
      top.width = run.end - run.start;
      top.visual = { ...top.visual, offset: run.start };
    });
    for (const extra of ordered.slice(runs.length)) dropped.add(extra.id);
  }
  // A top whose wall no longer exists goes away with it.
  for (const e of elements)
    if (e.autoTopFor && !layout.walls.some((w) => w.id === e.placement?.wall))
      dropped.add(e.id);
  return dropped.size ? elements.filter((e) => !dropped.has(e.id)) : elements;
}
export function ensureLayout<T extends Offer>(offer: T): T {
  const next = structuredClone(offer),
    legacy = !!next.layout && next.layout.version !== 3;
  next.layout ||= defaultLayout(next.client.layout);
  if (
    next.elements.some(
      (e) => templates.find((t) => t.kind === e.kind)?.group === "Ostrvski",
    ) &&
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
        templates.find((t) => t.kind === e.kind)?.group === "Ostrvski"
          ? "island"
          : next.layout.activeWall,
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
  const packed = packLayout(next.elements, next.layout, next.elevation);
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
      .reduce((a, e) => a + span(e) + (e.placement?.gap ?? 0), 0),
    upper = items
      .filter((e) => laneOf(e) === "wall")
      .reduce((a, e) => a + span(e) + (e.placement?.gap ?? 0), 0),
    reservations = junctionReservations(
      elements,
      layout || { walls: [wall], activeWall: wall.id },
    ),
    reservedBase =
      reservedLength(reservations, wall.id, "base", "start") +
      reservedLength(reservations, wall.id, "base", "end"),
    reservedUpper =
      reservedLength(reservations, wall.id, "wall", "start") +
      reservedLength(reservations, wall.id, "wall", "end"),
    occupied = Math.max(base + reservedBase, upper + reservedUpper);
  return {
    occupied,
    free: Math.max(0, wall.length - occupied),
    overrun: Math.max(0, occupied - wall.length),
    overlaps: [] as string[],
    extent: Math.max(wall.length, occupied),
    base: base + reservedBase,
    upper: upper + reservedUpper,
    freeBase: Math.max(0, wall.length - base - reservedBase),
    reservedBase,
    reservedUpper,
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
  elevation?: Partial<ElevationConfig>,
) {
  const item = allLayoutItems(elements, layout).find((e) => e.id === id);
  if (!item || !layout.walls.some((w) => w.id === wall) || !canPlace(item, row))
    return null;
  const cloneElements = structuredClone(elements),
    cloneLayout = structuredClone(layout),
    items = allLayoutItems(cloneElements, cloneLayout),
    moving = items.find((e) => e.id === id)!;
  const before = moving.placement,
    oldLane = before
      ? orderedLane(cloneElements, cloneLayout, before.wall, laneOf(moving))
      : [],
    oldIndex = oldLane.findIndex((e) => e.id === id);
  const target = orderedLane(cloneElements, cloneLayout, wall, row).filter(
    (e) => e.id !== id,
  );
  const at = Math.max(0, Math.min(index, target.length)),
    // Saving an element where it already stands keeps its own gap; moving it starts without one.
    stays =
      !!before && before.wall === wall && laneOf(moving) === row && oldIndex === at;
  target.splice(at, 0, moving);
  target.forEach((e, order) => {
    const gap = e.id === id && !stays ? 0 : (e.placement?.gap ?? 0);
    e.placement = { wall, row, order, offset: 0, ...(gap > 0 ? { gap } : {}) };
  });
  return packLayout(cloneElements, cloneLayout, elevation);
}
/** Gives the space of a removed or moved-away item to the next item of its lane, so the others stay put. */
function carryGap(items: LayoutItem[], leaving: LayoutItem) {
  const where = leaving.placement;
  if (!where) return;
  const lane = items
    .filter((e) => e.placement?.wall === where.wall && laneOf(e) === laneOf(leaving))
    .sort((a, b) => position(a) - position(b));
  const next = lane[lane.findIndex((e) => e.id === leaving.id) + 1];
  if (next?.placement)
    next.placement.gap =
      (next.placement.gap ?? 0) + (where.gap ?? 0) + span(leaving);
}
/** Removes an element but leaves its place empty; removing a spacer closes the gap as before. */
export function removeItem(
  elements: KitchenElement[],
  layout: KitchenLayout,
  id: string,
  elevation?: Partial<ElevationConfig>,
) {
  const packed = packLayout(elements, layout, elevation),
    items = allLayoutItems(packed.elements, packed.layout),
    target = items.find((e) => e.id === id);
  if (!target) return null;
  if (!isSpacer(target)) carryGap(items, target);
  const rest = packed.elements.filter((e) => e.id !== id),
    spacers = (packed.layout.spacers ?? []).filter((e) => e.id !== id);
  return packLayout(rest, { ...packed.layout, spacers }, elevation);
}
export type PlaceResult =
  | { elements: KitchenElement[]; layout: KitchenLayout; offset: number }
  | { error: string };
/**
 * Puts an item at an exact distance from the start of the wall (the other items stay where they are).
 * A small overlap is moved to the nearest free place; a real clash returns an error.
 */
export function placeAt(
  elements: KitchenElement[],
  layout: KitchenLayout,
  id: string,
  wall: string,
  row: LayoutLane,
  want: number,
  elevation?: Partial<ElevationConfig>,
): PlaceResult {
  const packed = packLayout(elements, layout, elevation),
    items = allLayoutItems(packed.elements, packed.layout),
    moving = items.find((e) => e.id === id),
    target = packed.layout.walls.find((w) => w.id === wall);
  if (!moving || !target || row === "extra" || !canPlace(moving, row))
    return { error: "Element se ne može postaviti na to mesto." };
  const reservations = junctionReservations(packed.elements, packed.layout),
    min = reservedLength(reservations, wall, row, "start"),
    width = span(moving),
    max =
      target.length - reservedLength(reservations, wall, row, "end") - width;
  if (max < min) return { error: "Element je širi od slobodnog prostora na zidu." };
  // The lane it leaves keeps its place empty.
  if (moving.placement && (moving.placement.wall !== wall || laneOf(moving) !== row))
    carryGap(items, moving);
  const lane = items.filter(
    (e) => e.id !== id && e.placement?.wall === wall && laneOf(e) === row,
  );
  const reals = lane
    .filter((e) => !isSpacer(e))
    .sort((a, b) => (a.placement?.offset ?? 0) - (b.placement?.offset ?? 0));
  const fits = (start: number) =>
    start >= min - 0.5 &&
    start <= max + 0.5 &&
    reals.every(
      (r) =>
        start + width <= (r.placement?.offset ?? 0) + 0.5 ||
        start >= (r.placement?.offset ?? 0) + span(r) - 0.5,
    );
  let start = Math.round(Math.max(min, Math.min(max, want)));
  if (!fits(start)) {
    const candidates = reals
      .flatMap((r) => [
        (r.placement?.offset ?? 0) + span(r),
        (r.placement?.offset ?? 0) - width,
      ])
      .filter(fits)
      .sort((a, b) => Math.abs(a - start) - Math.abs(b - start));
    if (!candidates.length || Math.abs(candidates[0] - start) > 200)
      return { error: "Na tom mestu već stoji drugi element." };
    start = Math.round(candidates[0]);
  }
  const sorted = [
    ...reals.map((r) => ({ item: r, at: r.placement!.offset })),
    { item: moving, at: start },
  ].sort((a, b) => a.at - b.at);
  const spacerIds = new Set(lane.filter(isSpacer).map((e) => e.id));
  let cursor = min;
  sorted.forEach(({ item, at }, order) => {
    const gap = Math.max(0, Math.round(at - cursor));
    item.placement = {
      wall,
      row,
      order,
      offset: 0,
      ...(gap > 0 ? { gap } : {}),
    };
    cursor = at + span(item);
  });
  const layoutOut = {
    ...packed.layout,
    spacers: (packed.layout.spacers ?? []).filter((s) => !spacerIds.has(s.id)),
  };
  const result = packLayout(packed.elements, layoutOut, elevation),
    placed = allLayoutItems(result.elements, result.layout).find(
      (e) => e.id === id,
    );
  if (!placed?.placement || Math.abs(placed.placement.offset - start) > 1)
    return {
      error: "Na tom mestu je prepreka (prozor, vrata ili visoki element).",
    };
  return { ...result, offset: placed.placement.offset };
}
export function moveLayoutItem(
  elements: KitchenElement[],
  layout: KitchenLayout,
  id: string,
  direction: -1 | 1,
  elevation?: Partial<ElevationConfig>,
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
    elevation,
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
