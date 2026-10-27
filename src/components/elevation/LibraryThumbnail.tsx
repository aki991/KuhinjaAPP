import { useMemo } from "react";
import { newElement, type Template } from "../../core/catalog";
import { elevationScene } from "../../core/elevation";
import { defaultLayout, newSpacer, isSpacer } from "../../core/layout";
import type { Offer, LayoutItem } from "../../core/types";
import ElementSVG from "./ElementSVG";
import { HobSVG, SinkSVG } from "./ApplianceSVG";

/** Uses the same renderer and selected finishes as the elevation and item cards. */
export default function LibraryThumbnail({
  template,
  element,
  offer,
}: {
  template?: Template;
  element?: LayoutItem;
  offer: Offer;
}) {
  const entry = useMemo(() => {
    const layout = defaultLayout(
      "Prava kuhinja",
      Math.max(3000, element?.width || template?.width || 0),
    );
    const item = element ? structuredClone(element) : template
      ? newElement(template.kind, offer.selection)
      : newSpacer("A", "base");
    item.id = `preview-${template?.kind || "spacer"}`;
    item.placement = {
      wall: "A",
      row: isSpacer(item) ? (item.placement.row || "base") : template?.group === "Viseći" ? "wall" : "base",
      offset: 0,
      order: 0,
    };
    if (isSpacer(item)) layout.spacers = [item];
    const scene = elevationScene(
      {
        ...offer,
        elements: isSpacer(item) ? [] : [item],
        layout,
        variants: [],
      },
      "A",
    );
    return scene.entries[0];
  }, [
    template,
    element,
    offer.selection,
    offer.prices,
    offer.settings,
    offer.elevation,
  ]);
  if (!entry) return null;
  const scale = Math.min(
    82 / Math.max(entry.rect.width, 1),
    68 / Math.max(entry.rect.height, 1),
  );
  const width = Math.max(2, entry.rect.width * scale),
    height = Math.max(2, entry.rect.height * scale);
  const rect = {
    x: (100 - width) / 2,
    y: 8 + (68 - height) / 2,
    width,
    height,
  };
  return (
    <svg viewBox={element ? `${rect.x - 5} ${rect.y - 12} ${width + 10} ${height + 17}` : "0 0 100 84"} className="library-thumbnail" aria-hidden="true">
      <ElementSVG
        entry={entry}
        rect={rect}
        selected={false}
        dragging={false}
        thumbnail
      />
      {entry.appliance === "sink" && (
        <SinkSVG x={rect.x + width * 0.2} y={rect.y} width={width * 0.6} />
      )}
      {(entry.hob || entry.appliance === "hob") && (
        <HobSVG x={rect.x + width * 0.12} y={rect.y} width={width * 0.76} />
      )}
    </svg>
  );
}
