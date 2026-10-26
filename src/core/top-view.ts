import type { ElevationScene } from "./elevation";
import { isSpacer } from "./layout";
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
        (filter === "wall" ? e.row === "wall" : e.row !== "wall"),
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
