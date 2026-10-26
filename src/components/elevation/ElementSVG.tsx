import { isSpacer } from "../../core/layout";
import type { ElevationEntry, Rect } from "../../core/elevation";
import { ApplianceSVG } from "./ApplianceSVG";
const golaKinds = ["base1", "base2", "drawer2", "drawer3", "drawer4"];
function Door({
  x,
  y,
  width: w,
  height: h,
  hinge = "left",
  handles,
  glass = false,
  lift = false,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  hinge?: "left" | "right";
  handles: boolean;
  glass?: boolean;
  lift?: boolean;
}) {
  const inset = Math.min(3, w * 0.12, h * 0.12);
  return (
    <g data-front={glass ? "glass" : "door"}>
      <rect x={x} y={y} width={w} height={h} fill="#eee5d3" />
      {glass && (
        <>
          <rect
            x={x + inset}
            y={y + inset}
            width={Math.max(0.1, w - 2 * inset)}
            height={Math.max(0.1, h - 2 * inset)}
            fill="#e1edf0"
          />
          <path
            d={`M${x + inset * 2} ${y + h * 0.65}L${x + w * 0.5} ${y + inset * 2}`}
            opacity=".3"
          />
        </>
      )}
      <path
        className="door-opening"
        data-opening-side={lift ? "up" : hinge}
        d={
          lift
            ? `M${x} ${y + h}L${x + w / 2} ${y}L${x + w} ${y + h}`
            : hinge === "left"
              ? `M${x + w} ${y}L${x} ${y + h / 2}L${x + w} ${y + h}`
              : `M${x} ${y}L${x + w} ${y + h / 2}L${x} ${y + h}`
        }
        fill="none"
      />
      {handles &&
        (lift ? (
          <path
            className="technical-handle"
            d={`M${x + w * 0.35} ${y + h - 5}h${w * 0.3}`}
          />
        ) : (
          <path
            className="technical-handle"
            d={`M${hinge === "left" ? x + w - 5 : x + 5} ${y + h * 0.42}v${Math.min(13, h * 0.17)}`}
          />
        ))}
    </g>
  );
}
export default function ElementSVG({
  entry: e,
  rect: r,
  selected,
  dragging,
  clipId,
  thumbnail = false,
}: {
  entry: ElevationEntry;
  rect: Rect;
  selected: boolean;
  dragging: boolean;
  clipId?: string;
  thumbnail?: boolean;
}) {
  const { width: w, height: h } = r,
    spacer = isSpacer(e.item),
    handles = e.opening === "handles",
    item = isSpacer(e.item) ? null : e.item,
    gola = !!item && e.opening === "gola" && golaKinds.includes(item.kind),
    gap = Math.min(1.3, w * 0.02, h * 0.02),
    innerW = Math.max(1, w - 2 * gap),
    innerH = Math.max(1, h - 2 * gap);
  let content;
  if (spacer)
    content = (
      <rect width={w} height={h} className="technical-spacer" fill="none" />
    );
  else if (
    item!.kind === "worktop" ||
    item!.kind === "plinth" ||
    item!.kind === "panel" ||
    item!.kind === "side"
  )
    content = (
      <rect
        width={w}
        height={h}
        fill={
          item!.kind === "worktop"
            ? "#d7dcdd"
            : item!.kind === "plinth"
              ? "#e5decd"
              : "#eae1ce"
        }
      />
    );
  else if (item!.kind === "open")
    content = (
      <>
        <rect width={w} height={h} fill="#f5f1e9" />
        {Array.from({ length: item!.shelves }, (_, i) => (
          <rect
            key={i}
            x={1}
            y={((i + 1) * h) / (item!.shelves + 1)}
            width={Math.max(1, w - 2)}
            height={Math.max(1, h * 0.008)}
            fill="#dfd9cb"
          />
        ))}
      </>
    );
  else if (e.appliance === "fridge" || e.appliance === "dishwasher")
    content = (
      <ApplianceSVG kind={e.appliance} width={w} height={h} handles={handles} />
    );
  else if (item!.drawers > 0) {
    const n = item!.drawers,
      dh = innerH / n;
    content = (
      <>
        <rect width={w} height={h} fill="#d9d3c6" />
        {Array.from({ length: n }, (_, i) => (
          <g key={i} data-front="drawer">
            <rect
              x={gap}
              y={gap + i * dh}
              width={innerW}
              height={Math.max(1, dh - gap)}
              fill="#eee5d3"
            />
            {handles && (
              <path
                className="technical-handle"
                d={`M${w * 0.37} ${gap + i * dh + Math.min(7, dh * 0.3)}h${w * 0.26}`}
              />
            )}
            <path d={`M${gap} ${gap + i * dh}H${w - gap}`} fill="none" />
            {gola && (
              <rect
                data-gola="horizontal"
                x={gap}
                y={gap + i * dh}
                width={innerW}
                height={Math.max(1.5, h * 0.018)}
                fill="#9b9f99"
                stroke="none"
              />
            )}
          </g>
        ))}
      </>
    );
  } else {
    const tall = ["tall", "tallOven", "fridge"].includes(item!.kind),
      oven = e.appliance === "oven",
      count = oven && !tall ? 0 : Math.max(0, item!.doors),
      openingH = oven ? Math.min(h * 0.87, 600 * (h / item!.height)) : 0;
    content = (
      <>
        <rect width={w} height={h} fill="#f1eadb" />
        {oven && (
          <g
            transform={`translate(${gap * 2},${tall ? (h - openingH) / 2 : (h - openingH) / 2})`}
          >
            <ApplianceSVG
              kind="oven"
              width={Math.max(2, w - gap * 4)}
              height={openingH}
            />
          </g>
        )}
        {count > 0 &&
          Array.from({ length: count }, (_, i) => {
            const fh = tall ? (innerH - openingH) / count : innerH,
              fw = tall ? innerW : innerW / count,
              x = tall ? gap : gap + i * fw,
              y = tall
                ? gap +
                  i * fh +
                  (oven && i >= Math.ceil(count / 2) ? openingH : 0)
                : gap;
            return (
              <Door
                key={i}
                x={x}
                y={y}
                width={Math.max(1, fw - gap)}
                height={Math.max(1, fh - gap)}
                hinge={
                  count === 1
                    ? item!.visual?.hinge || "left"
                    : i % 2 === 0
                      ? "left"
                      : "right"
                }
                handles={handles}
                glass={!!item!.visual?.glass}
                lift={item!.kind === "lift"}
              />
            );
          })}
        {gola && (
          <rect
            data-gola="horizontal"
            x={gap}
            y={gap}
            width={innerW}
            height={Math.max(1.5, h * 0.035)}
            fill="#9b9f99"
            stroke="none"
          />
        )}
      </>
    );
  }
  return (
    <g
      data-technical-id={thumbnail ? undefined : e.id}
      data-instance={e.instance}
      data-kind={e.item.kind}
      data-mm-width={e.rect.width}
      data-mm-height={e.rect.height}
      data-mm-x={e.rect.x}
      data-mm-bottom={e.rect.y}
      className={`technical-element ${e.conflict ? "conflict" : ""} ${selected ? "selected" : ""} ${dragging ? "dragging" : ""}`}
      clipPath={clipId ? `url(#${clipId})` : undefined}
    >
      <g transform={`translate(${r.x} ${r.y})`}>
        {content}
        {!spacer && (
          <rect width={w} height={h} className="cabinet-outline" fill="none" />
        )}
      </g>
    </g>
  );
}
