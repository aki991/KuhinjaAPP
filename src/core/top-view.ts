import { elevationScene, type ElevationScene } from "./elevation";
import {
  isBridge,
  connectedWalls,
  isSpacer,
  junctionReservations,
  packLayout,
} from "./layout";
import type { Offer } from "./types";
import { templates } from "./catalog";
export type TopFilter = "base" | "wall" | "all";
export function topViewEntries(scene: ElevationScene, filter: TopFilter) {
  const baseDepth = Math.max(
    560,
    ...scene.entries
      .filter((e) => e.row === "base" && !isSpacer(e.item))
      .map((e) => (isSpacer(e.item) ? 560 : e.item.depth)),
  );
  return scene.entries
    .filter(
      (e) =>
        filter === "all" ||
        (filter === "wall"
          ? e.row === "wall" || isBridge(e.item)
          : e.row !== "wall" && !isBridge(e.item)),
    )
    .map((e) => {
      const item = e.item,
        depth = isSpacer(item)
          ? e.row === "wall"
            ? 320
            : baseDepth
          : item.depth;
      return {
        entry: e,
        x: e.rect.x,
        y:
          !isSpacer(item) && item.kind === "plinth"
            ? Math.max(0, baseDepth - depth)
            : 0,
        width:
          !isSpacer(item) && item.kind === "side" ? item.width : e.rect.width,
        depth,
      };
    })
    .sort(
      (a, b) =>
        Number(a.entry.row !== "extra") - Number(b.entry.row !== "extra") ||
        Number(a.entry.row === "wall") - Number(b.entry.row === "wall"),
    );
}

export function islandFootprint(scene: ElevationScene) {
  const entries = topViewEntries(scene, "all");
  return {
    width: Math.max(0, ...entries.map((e) => e.x + e.width)) || scene.length,
    depth: Math.max(0, ...entries.map((e) => e.y + e.depth)) || 600,
  };
}
export interface PlanWall {
  scene: ElevationScene;
  name: string;
  x: number;
  y: number;
  angle: number;
  island: boolean;
  entries: ReturnType<typeof topViewEntries>;
}
export function planPoint(
  wall: Pick<PlanWall, "x" | "y" | "angle">,
  x: number,
  y: number,
) {
  const a = (wall.angle * Math.PI) / 180;
  return {
    x: wall.x + x * Math.cos(a) - y * Math.sin(a),
    y: wall.y + x * Math.sin(a) + y * Math.cos(a),
  };
}
/** A→B→C is a connected clockwise chain; islands have their own footprint. */
export function kitchenPlan(offer: Offer, filter: TopFilter) {
  const packed = packLayout(offer.elements, offer.layout!),
    normalized = { ...offer, ...packed },
    connected = connectedWalls(packed.layout),
    reservations = junctionReservations(packed.elements, packed.layout),
    walls: PlanWall[] = [];
  let x = 0,
    y = 0;
  for (const [i, wall] of connected.entries()) {
    const scene = elevationScene(normalized, wall.id);
    walls.push({
      scene,
      name: wall.name,
      x,
      y,
      angle: i * 90,
      island: false,
      entries: topViewEntries(scene, filter),
    });
    const end = planPoint({ x, y, angle: i * 90 }, wall.length, 0);
    x = end.x;
    y = end.y;
  }
  const bodyDepth = Math.max(
      600,
      ...packed.elements
        .filter((e) => e.placement?.wall !== "island")
        .map((e) => e.depth),
    ),
    roomWidth = connected[0]?.length || 3000,
    roomHeight = connected[1]?.length || 0;
  let detachedY = Math.max(bodyDepth, roomHeight) + 1000;
  for (const wall of packed.layout.walls.filter(
    (w) =>
      !connected.some((c) => c.id === w.id) &&
      // An island wall with no elements is leftover data, not something to draw.
      !(
        w.id.startsWith("island") &&
        ![...packed.elements, ...(packed.layout.spacers || [])].some(
          (e) => e.placement?.wall === w.id,
        )
      ),
  )) {
    const originalScene = elevationScene(normalized, wall.id),
      actualWidth = Math.max(
        0,
        ...originalScene.entries.map((e) => e.rect.x + e.rect.width),
      ),
      scene =
        wall.id.startsWith("island") && actualWidth > 0
          ? { ...originalScene, length: actualWidth }
          : originalScene,
      entries = topViewEntries(scene, filter),
      width = Math.max(scene.length, ...entries.map((e) => e.x + e.width)),
      depth = islandFootprint(scene).depth,
      inside =
        walls.every((w) => !w.island) &&
        roomWidth >= width + 2 * bodyDepth + 1200 &&
        roomHeight >= depth + 2 * bodyDepth + 1200;
    const custom =
      wall.id === "island" ? packed.layout.islandPosition : undefined;
    walls.push({
      scene,
      name: wall.name,
      x: custom?.x ?? (inside ? (roomWidth - width) / 2 : 0),
      y: custom?.y ?? (inside ? (roomHeight - depth) / 2 : detachedY),
      angle: 0,
      island: wall.id.startsWith("island"),
      entries,
    });
    if (!inside) detachedY += depth + 1000;
  }
  const points = walls.flatMap((wall) => {
    const extent = Math.max(
        wall.scene.length,
        ...wall.entries.map((e) => e.x + e.width),
      ),
      depth = Math.max(320, ...wall.entries.map((e) => e.y + e.depth));
    return [
      planPoint(wall, 0, 0),
      planPoint(wall, extent, 0),
      planPoint(wall, 0, depth),
      planPoint(wall, extent, depth),
    ];
  });
  const minX = Math.min(0, ...points.map((p) => p.x)),
    minY = Math.min(0, ...points.map((p) => p.y)),
    maxX = Math.max(1, ...points.map((p) => p.x)),
    maxY = Math.max(1, ...points.map((p) => p.y));
  const warnings = walls.flatMap((w) =>
    w.scene.warnings.map((message) => `${w.name}: ${message}`),
  );
  const island = walls.find((w) => w.island);
  if (island && packed.layout.islandPosition) {
    const base = topViewEntries(island.scene, "base").filter(
      (entry) => !isSpacer(entry.entry.item) && entry.entry.row !== "extra",
    );
    const rect = (
      wall: PlanWall,
      entry: ReturnType<typeof topViewEntries>[number],
    ) => {
      const points = [
        planPoint(wall, entry.x, entry.y),
        planPoint(wall, entry.x + entry.width, entry.y + entry.depth),
      ];
      return {
        left: Math.min(...points.map((p) => p.x)),
        right: Math.max(...points.map((p) => p.x)),
        top: Math.min(...points.map((p) => p.y)),
        bottom: Math.max(...points.map((p) => p.y)),
      };
    };
    const crosses = base.some((i) =>
      walls
        .filter((w) => !w.island)
        .some((w) =>
          topViewEntries(w.scene, "base").some((e) => {
            if (isSpacer(e.entry.item) || e.entry.row === "extra") return false;
            const a = rect(island, i),
              b = rect(w, e);
            return (
              a.left < b.right - 0.001 &&
              a.right > b.left + 0.001 &&
              a.top < b.bottom - 0.001 &&
              a.bottom > b.top + 0.001
            );
          }),
        ),
    );
    if (crosses)
      warnings.push(
        "Ostrvo se preklapa sa elementom uz zid. Proverite položaj ostrva.",
      );
    const islandDepth = islandFootprint(island.scene).depth;
    if (
      island.x + island.scene.length > roomWidth ||
      (connected.length > 2 && island.y + islandDepth > roomHeight)
    )
      warnings.push(
        "Ostrvo izlazi iz prostora između zidova. Proverite udaljenosti.",
      );
  }
  for (const r of reservations.filter((r) => r.edge === "start")) {
    const source = walls.find((w) => w.scene.wall === r.sourceWall),
      entries = source?.scene.entries.filter((e) => e.id === r.source) || [];
    if (
      source &&
      entries.some(
        (e) =>
          ["corner", "cornerBlind", "wallCorner"].includes(e.item.kind) ||
          templates.find((t) => t.kind === e.item.kind)?.corner,
      ) &&
      Math.max(...entries.map((e) => e.rect.x + e.rect.width)) <
        source.scene.length
    )
      warnings.push(
        `${source.name}: ugaoni element nije uz spoj zidova. Proverite dužinu zida ili dodajte namerni razmak ispred ugla.`,
      );
  }
  return {
    walls,
    reservations,
    warnings: [...new Set(warnings)],
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}
