import {
  elementCodes,
  isSpacer,
  laneOf,
  packLayout,
  wallUsage,
} from "./layout";
import type {
  ElevationConfig,
  KitchenElement,
  LayoutItem,
  LayoutLane,
  Offer,
  Opening,
  VisualAppliance,
  WallObject,
} from "./types";
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ElevationEntry {
  key: string;
  id: string;
  instance: number;
  item: LayoutItem;
  code: string;
  row: LayoutLane;
  rect: Rect;
  opening: Opening;
  appliance: VisualAppliance;
  hob: boolean;
  counterTop: number;
  visible: Rect[];
  conflict: boolean;
}
export interface ElevationScene {
  wall: string;
  length: number;
  roomHeight: number;
  entries: ElevationEntry[];
  objects: WallObject[];
  extent: number;
  height: number;
  baseTop: number;
  upperBottom: number;
  warnings: string[];
  config: ElevationConfig;
}
export const defaultElevation = (): ElevationConfig => ({
  version: 1,
  toeKick: 100,
  upperGap: 600,
  wallHeight: 2600,
  objects: [],
});
export function ensureElevation<T extends Offer>(offer: T): T {
  const next = structuredClone(offer);
  next.elevation = {
    ...defaultElevation(),
    ...next.elevation,
    objects: next.elevation?.objects || [],
  };
  next.variants = next.variants.map((v) => ({
    ...v,
    elevation: {
      ...defaultElevation(),
      ...v.elevation,
      objects: v.elevation?.objects || [],
    },
  }));
  return next;
}
export const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
export function subtractRect(source: Rect, cut: Rect): Rect[] {
  if (!intersects(source, cut)) return [source];
  const x0 = Math.max(source.x, cut.x),
    x1 = Math.min(source.x + source.width, cut.x + cut.width),
    y0 = Math.max(source.y, cut.y),
    y1 = Math.min(source.y + source.height, cut.y + cut.height);
  return [
    { x: source.x, y: source.y, width: x0 - source.x, height: source.height },
    {
      x: x1,
      y: source.y,
      width: source.x + source.width - x1,
      height: source.height,
    },
    { x: x0, y: source.y, width: x1 - x0, height: y0 - source.y },
    { x: x0, y: y1, width: x1 - x0, height: source.y + source.height - y1 },
  ].filter((r) => r.width > 0 && r.height > 0);
}
const typeAppliance = (e: KitchenElement): VisualAppliance =>
  e.visual?.appliance && e.visual.appliance !== "auto"
    ? e.visual.appliance
    : e.kind === "oven" || e.kind === "tallOven"
      ? "oven"
      : e.kind === "sink"
        ? "sink"
        : e.kind === "fridge"
          ? "fridge"
          : "none";
/** Uses the same packed X positions as the simple view. Y is visual only, measured from the floor. */
export function elevationScene(offer: Offer, wallId: string): ElevationScene {
  const { elements, layout } = packLayout(offer.elements, offer.layout!),
    wall = layout.walls.find((w) => w.id === wallId) || layout.walls[0],
    config = { ...defaultElevation(), ...offer.elevation },
    items: LayoutItem[] = [...elements, ...(layout.spacers || [])].filter(
      (e) => e.placement?.wall === wall.id,
    ),
    codes = elementCodes(elements, layout),
    warnings: string[] = [];
  const lower = items.filter(
    (e): e is KitchenElement =>
      !isSpacer(e) &&
      laneOf(e) === "base" &&
      !["tall", "tallOven", "fridge"].includes(e.kind),
  );
  const baseTop = lower.length
      ? Math.max(
          ...lower.map((e) => (e.visual?.bottom ?? config.toeKick) + e.height),
        )
      : config.toeKick + 720,
    tops = items.filter(
      (e): e is KitchenElement => !isSpacer(e) && e.kind === "worktop",
    ),
    maxTop = Math.max(0, ...tops.map((e) => e.height));
  let upperBottom = baseTop + maxTop + config.upperGap;
  const entries: ElevationEntry[] = [];
  function entry(item: LayoutItem, instance: number, rect: Rect) {
    const selection =
      !isSpacer(item) && item.locked ? item.selection : offer.selection;
    return {
      key: `${item.id}-${instance}`,
      id: item.id,
      instance,
      item,
      code: codes.get(item.id) || "",
      row: laneOf(item),
      rect,
      opening: selection.opening,
      appliance: isSpacer(item) ? ("none" as const) : typeAppliance(item),
      hob: !isSpacer(item) && !!item.visual?.hob,
      counterTop: rect.y + rect.height,
      visible: [rect],
      conflict: false,
    };
  }
  for (const item of items.filter((e) => laneOf(e) !== "extra"))
    for (let i = 0; i < item.quantity; i++) {
      const row = laneOf(item),
        height = isSpacer(item)
          ? row === "wall"
            ? Math.max(
                720,
                ...items
                  .filter((e) => !isSpacer(e) && laneOf(e) === "wall")
                  .map((e) => (e as KitchenElement).height),
              )
            : Math.max(720, ...lower.map((e) => e.height))
          : item.height;
      const bottom =
        !isSpacer(item) && item.visual?.bottom !== undefined
          ? item.visual.bottom
          : row === "wall"
            ? upperBottom
            : config.toeKick;
      entries.push(
        entry(item, i, {
          x: item.placement!.offset + i * item.width,
          y: bottom,
          width: item.width,
          height,
        }),
      );
    }
  let topOffset = 0,
    plinthOffset = 0;
  for (const item of items
    .filter((e): e is KitchenElement => !isSpacer(e) && laneOf(e) === "extra")
    .sort((a, b) => (a.placement?.order || 0) - (b.placement?.order || 0))) {
    for (let i = 0; i < item.quantity; i++) {
      const x =
        item.visual?.offset !== undefined
          ? item.visual.offset +
            i * (item.kind === "side" ? item.depth : item.width)
          : item.kind === "worktop"
            ? topOffset
            : item.kind === "plinth"
              ? plinthOffset
              : wallUsage(elements, wall, layout).base +
                i * (item.kind === "side" ? item.depth : item.width);
      const beneath = entries.filter(
          (e) =>
            !isSpacer(e.item) &&
            e.row === "base" &&
            !["tall", "fridge", "tallOven"].includes(e.item.kind) &&
            e.rect.x < x + item.width &&
            e.rect.x + e.rect.width > x,
        ),
        supportedTop = beneath.length
          ? Math.max(...beneath.map((e) => e.rect.y + e.rect.height))
          : baseTop;
      const rect = {
        x,
        y: item.visual?.bottom ?? (item.kind === "worktop" ? supportedTop : 0),
        width: item.kind === "side" ? item.depth : item.width,
        height: item.height,
      };
      entries.push(entry(item, i, rect));
      if (item.kind === "worktop") {
        topOffset = x + item.width;
        if (new Set(beneath.map((e) => e.rect.y + e.rect.height)).size > 1)
          warnings.push(
            "Donji elementi imaju različite visine. Proverite oslonac radne ploče.",
          );
      }
      if (item.kind === "plinth") plinthOffset = x + item.width;
    }
  }
  const actualTop = Math.max(
    baseTop,
    ...entries
      .filter((e) => e.item.kind === "worktop")
      .map((e) => e.rect.y + e.rect.height),
  );
  upperBottom = actualTop + config.upperGap;
  for (const e of entries.filter((e) => e.row === "wall"))
    if (isSpacer(e.item) || e.item.visual?.bottom === undefined) {
      e.rect.y = upperBottom;
      e.counterTop = e.rect.y + e.rect.height;
    }
  for (const e of entries.filter((e) => e.row === "base")) {
    const covering = entries.filter(
      (t) =>
        !isSpacer(t.item) &&
        t.item.kind === "worktop" &&
        e.rect.x + e.rect.width / 2 >= t.rect.x &&
        e.rect.x + e.rect.width / 2 <= t.rect.x + t.rect.width,
    );
    e.counterTop = covering.length
      ? Math.max(...covering.map((t) => t.rect.y + t.rect.height))
      : e.rect.y + e.rect.height;
  }
  const tall = entries.filter(
    (e) =>
      !isSpacer(e.item) && ["tall", "fridge", "tallOven"].includes(e.item.kind),
  );
  for (const e of entries.filter(
    (e) => e.row === "wall" && !isSpacer(e.item),
  )) {
    for (const t of tall)
      if (intersects(e.rect, t.rect)) {
        e.conflict = true;
        e.visible = e.visible.flatMap((r) => subtractRect(r, t.rect));
        warnings.push(
          `${e.code} i ${t.code} se preklapaju. Proverite raspored ili dodajte razmak u visećem redu.`,
        );
      }
  }
  const objects = config.objects.filter((o) => o.wall === wall.id);
  for (const object of objects) {
    if (
      object.x + object.width > wall.length ||
      object.bottom + object.height > config.wallHeight
    )
      warnings.push(
        `${{ window: "Prozor", door: "Vrata", column: "Stub", niche: "Niša" }[object.kind]} izlazi iz zadatih mera zida.`,
      );
    const rect = {
      x: object.x,
      y: object.bottom,
      width: object.width,
      height: object.height,
    };
    for (const e of entries.filter(
      (e) => !isSpacer(e.item) && e.item.kind !== "plinth",
    ))
      if (intersects(rect, e.rect)) {
        e.conflict = true;
        warnings.push(
          `${{ window: "Prozor", door: "Vrata", column: "Stub", niche: "Niša" }[object.kind]} se preklapa sa ${e.code}. Proverite položaj.`,
        );
      }
  }
  for (const e of entries) {
    if (e.rect.x + e.rect.width > wall.length) {
      e.conflict = true;
      warnings.push(`${e.code} prelazi dužinu zida.`);
    }
    if (e.rect.y + e.rect.height > config.wallHeight) {
      e.conflict = true;
      warnings.push(`${e.code} prelazi zadatu visinu zida.`);
    }
  }
  const extent = Math.max(
      wall.length,
      ...entries.map((e) => e.rect.x + e.rect.width),
      ...objects.map((o) => o.x + o.width),
    ),
    height = Math.max(
      config.wallHeight,
      ...entries.map(
        (e) => e.rect.y + e.rect.height + (e.appliance === "sink" ? 280 : 0),
      ),
      ...objects.map((o) => o.bottom + o.height),
    );
  return {
    wall: wall.id,
    length: wall.length,
    roomHeight: config.wallHeight,
    entries,
    objects,
    extent,
    height,
    baseTop,
    upperBottom,
    warnings: [...new Set(warnings)],
    config,
  };
}
export function toScreen(
  rect: Rect,
  scale: number,
  sceneHeight: number,
  margin = { left: 44, top: 44 },
): Rect {
  return {
    x: margin.left + rect.x * scale,
    y: margin.top + (sceneHeight - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}
export const elevationMargins = { left: 32, right: 12, top: 40, bottom: 64 };

/** Camera bounds only. Wall/obstacle coordinates and the packed layout stay intact. */
export function kitchenBounds(scene: ElevationScene): Rect {
  if (!scene.entries.length)
    return {
      x: 0,
      y: 0,
      width: Math.min(2000, scene.length),
      height: scene.baseTop,
    };
  const left = Math.min(...scene.entries.map((e) => e.rect.x));
  const bottom = Math.min(
    ...scene.entries.map((e) => (e.row === "base" ? 0 : e.rect.y)),
  );
  const right = Math.max(...scene.entries.map((e) => e.rect.x + e.rect.width));
  const top = Math.max(
    ...scene.entries.map((e) =>
      Math.max(
        e.rect.y + e.rect.height,
        e.appliance === "sink"
          ? e.counterTop + 280
          : e.hob || e.appliance === "hob"
            ? e.counterTop + 80
            : 0,
      ),
    ),
  );
  return {
    x: left,
    y: bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, top - bottom),
  };
}

/** Fit the kitchen, never the room. Wide runs keep readable fronts and can pan. */
export function fitElevation(
  scene: ElevationScene,
  width: number,
  maxHeight = 420,
) {
  const bounds = kitchenBounds(scene);
  const availableWidth = Math.max(
    120,
    width - elevationMargins.left - elevationMargins.right,
  );
  const byWidth = availableWidth / bounds.width;
  // 600 mm fronts start around 84 px, close to the simple diagram's 96 px.
  // Short runs can fill the width; the height limit concerns actual cabinets only.
  const narrowest = Math.min(
    600,
    ...scene.entries
      .filter((e) => !isSpacer(e.item) && e.row !== "extra")
      .map((e) => e.rect.width),
  );
  const minimum = Math.max(0.14, Math.min(0.24, 56 / Math.max(1, narrowest)));
  const readable = bounds.width <= 2400 ? Math.min(minimum, byWidth) : minimum;
  return Math.max(
    0.025,
    Math.min(
      0.3,
      Math.max(byWidth, readable),
      Math.max(
        140,
        maxHeight - elevationMargins.top - elevationMargins.bottom,
      ) / bounds.height,
    ),
  );
}

export function elevationCamera(
  scene: ElevationScene,
  width: number,
  maxHeight: number,
  zoom = 1,
  fullscreen = false,
) {
  const bounds = kitchenBounds(scene),
    top = fullscreen ? 96 : elevationMargins.top,
    bottom = fullscreen ? 40 : elevationMargins.bottom,
    fitted = fullscreen
      ? Math.max(
          0.025,
          Math.min(
            0.65,
            (width - elevationMargins.left - elevationMargins.right) /
              bounds.width,
            (maxHeight - top - bottom) / bounds.height,
          ),
        )
      : fitElevation(scene, width, maxHeight);
  const scale = Math.min(0.65, fitted * zoom);
  const viewportHeight = fullscreen
    ? maxHeight
    : Math.min(
        maxHeight,
        Math.max(
          180,
          Math.ceil(
            bounds.height * fitted +
              elevationMargins.top +
              elevationMargins.bottom,
          ),
        ),
      );
  const left = Math.max(
    elevationMargins.left,
    elevationMargins.left +
      (width -
        elevationMargins.left -
        elevationMargins.right -
        bounds.width * scale) /
        2 -
      bounds.x * scale,
  );
  const verticalShift = fullscreen
    ? Math.max(
        0,
        (viewportHeight + top - bottom) / 2 -
          (top + (scene.height - bounds.y - bounds.height / 2) * scale),
      )
    : 0;
  const margin = { left, top: top + verticalShift };
  const canvasWidth = Math.max(
    width,
    Math.ceil(left + scene.extent * scale + elevationMargins.right),
  );
  const canvasHeight = Math.max(
    fullscreen ? viewportHeight : 0,
    Math.ceil(margin.top + scene.height * scale + bottom),
  );
  const focusLeft =
    bounds.width * scale <=
    width - elevationMargins.left - elevationMargins.right
      ? left +
        (bounds.x + bounds.width / 2) * scale -
        (width + elevationMargins.left - elevationMargins.right) / 2
      : left + bounds.x * scale - elevationMargins.left;
  const focusTop =
    margin.top + (scene.height - bounds.y - bounds.height) * scale - top;
  return {
    bounds,
    fitted,
    scale,
    margin,
    viewportHeight,
    canvasWidth,
    canvasHeight,
    focusLeft: Math.max(0, focusLeft),
    focusTop: Math.max(
      0,
      fullscreen
        ? margin.top +
            (scene.height - bounds.y - bounds.height / 2) * scale -
            (top + (viewportHeight - top - bottom) / 2)
        : bounds.y === 0
          ? canvasHeight - viewportHeight
          : focusTop,
    ),
  };
}
