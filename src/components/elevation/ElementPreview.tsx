import { useMemo } from "react";
import { elevationScene, type ElevationEntry } from "../../core/elevation";
import type { KitchenElement, Offer } from "../../core/types";
import { Cabinet } from "../UI";
import ElementSVG from "./ElementSVG";

/** Front-view drawings of every element, exactly as the kitchen page draws them. */
export function useElementEntries(offer: Offer) {
  return useMemo(() => {
    const entries = new Map<string, ElevationEntry>();
    if (!offer.layout) return entries;
    for (const wall of offer.layout.walls)
      for (const e of elevationScene(offer, wall.id).entries)
        if (e.instance === 0 && !entries.has(e.id)) entries.set(e.id, e);
    return entries;
  }, [offer]);
}

export default function ElementPreview({
  element,
  entry,
  size = 64,
  bare = false,
}: {
  bare?: boolean;
  element: KitchenElement;
  entry?: ElevationEntry;
  size?: number;
}) {
  if (!entry) return <Cabinet kind={element.kind} size={size} />;
  const { width, height } = entry.rect,
    scale = Math.min(size / width, size / height),
    w = width * scale,
    h = height * scale;
  return (
    <svg
      className="wall-elevation element-preview"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <g transform={`translate(${(size - w) / 2} ${(size - h) / 2})`}>
        <ElementSVG
          entry={entry}
          rect={{ x: 0, y: 0, width: w, height: h }}
          selected={false}
          dragging={false}
          thumbnail
          bare={bare}
        />
      </g>
    </svg>
  );
}
