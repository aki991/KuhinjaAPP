import { useEffect, useMemo, useRef, useState } from "react";
import { rowOf, isSpacer, isBridge } from "../../core/layout";
const groupOf = (e: LayoutItem) =>
  isBridge(e)
    ? "Most"
    : { base: "Donji", wall: "Viseći", tall: "Visoki", extra: "Ostali" }[
        rowOf(e)
      ];
import type { LayoutItem } from "../../core/types";
import type { ElevationScene } from "../../core/elevation";
import ElementSVG from "./ElementSVG";
import { HobSVG, SinkSVG } from "./ApplianceSVG";
import { number } from "../UI";
import { templates } from "../../core/catalog";
export default function ElementStrip({
  items,
  scene,
  selected,
  onPick,
  hidden = false,
}: {
  items: LayoutItem[];
  scene: ElevationScene;
  selected: string | null;
  onPick: (e: LayoutItem) => void;
  hidden?: boolean;
}) {
  const [filter, setFilter] = useState("Svi"),
    root = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () =>
      ["Donji", "Viseći", "Visoki", "Most", "Ostali"].filter((g) =>
        items.some((e) => groupOf(e) === g),
      ),
    [items],
  );
  useEffect(() => {
    if (selected && !hidden) {
      setFilter("Svi");
      requestAnimationFrame(() => {
        const card = [
          ...(root.current?.querySelectorAll<HTMLElement>("[data-item-id]") ||
            []),
        ].find((e) => e.dataset.itemId === selected);
        if (card && root.current) {
          const list = card.parentElement!;
          list.scrollTo({
            left: card.offsetLeft - (list.clientWidth - card.clientWidth) / 2,
            behavior: "smooth",
          });
        }
      });
    }
  }, [selected, hidden]);
  useEffect(() => setFilter("Svi"), [scene.wall]);
  return (
    <div
      className="element-strip"
      ref={root}
      aria-label="Elementi na izabranom zidu"
    >
      {groups.length > 1 && (
        <div
          className="element-strip-filters"
          role="group"
          aria-label="Vrste elemenata"
        >
          {["Svi", ...groups].map((g) => (
            <button
              key={g}
              aria-pressed={filter === g}
              onClick={() => setFilter(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}
      <div className="element-strip-scroll">
        {items
          .filter(
            (e) =>
              filter === "Svi" || groupOf(e) === filter,
          )
          .map((item) => {
            const entry = scene.entries.find((e) => e.id === item.id)!;
            if (!entry) return null;
            const scale = Math.min(
                70 / Math.max(1, entry.rect.width),
                56 / Math.max(1, entry.rect.height),
              ),
              w = Math.max(2, entry.rect.width * scale),
              h = Math.max(2, entry.rect.height * scale),
              r = {
                x: (86 - w) / 2,
                y: 10 + (56 - h) / 2,
                width: w,
                height: h,
              };
            return (
              <button
                key={item.id}
                className={`element-strip-card ${selected === item.id ? "selected" : ""}`}
                data-testid="element-card"
                data-item-id={item.id}
                aria-label={`Izmeni ${entry.code}`}
                aria-pressed={selected === item.id}
                onClick={() => onPick(item)}
              >
                <span className="strip-code">
                  {entry.code}
                  {item.quantity > 1 && <small> ×{item.quantity}</small>}
                </span>
                <svg
                  width="86"
                  height="70"
                  viewBox="0 0 86 70"
                  className="element-miniature"
                  aria-label={
                    isSpacer(item)
                      ? "Razmak"
                      : templates.find((t) => t.kind === item.kind)?.name
                  }
                >
                  <ElementSVG
                    entry={entry}
                    rect={r}
                    selected={false}
                    dragging={false}
                    thumbnail
                  />
                  {entry.appliance === "sink" && (
                    <SinkSVG x={r.x + w * 0.2} y={r.y} width={w * 0.6} />
                  )}
                  {(entry.hob || entry.appliance === "hob") && (
                    <HobSVG x={r.x + w * 0.12} y={r.y} width={w * 0.76} />
                  )}
                </svg>
                <strong>
                  {number(item.width / 10)} <small>cm</small>
                </strong>
              </button>
            );
          })}
      </div>
    </div>
  );
}
