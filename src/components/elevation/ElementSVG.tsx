import { isSpacer, rowOf } from "../../core/layout";
import type { ElevationEntry, Rect } from "../../core/elevation";
import { ApplianceSVG } from "./ApplianceSVG";
import { horizontalGolaKinds } from "../../core/opening";
import { useId, type CSSProperties } from "react";
import type { ElementKind } from "../../core/types";
const specialLabel: Partial<Record<ElementKind, string>> = {
  baseCargo: "CARGO", tallCargo: "CARGO", wallHood: "NAPA",
  wallCorner: "L", corner: "L", cornerBlind: "SLEPI", bar: "ŠANK",
  freeFridge: "FRIŽ.", freeStove: "ŠPORET", freeDishwasher: "SUD.",
  dishwasherBuilt: "SUD.", tallFreezer: "ZAMRZ.", tallOvenMicrowave: "R+M",
  wallBridgeFridge: "MOST", wallBridgeOven: "MOST", islandBack: "OBLOGA",
};
function Door({
  x,
  y,
  width: w,
  height: h,
  hinge = "left",
  handles,
  glass = false,
  lift = false,
  upper = false,
  position = "vertical",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  hinge?: "left" | "right";
  handles: boolean;
  glass?: boolean;
  lift?: boolean;
  upper?: boolean;
  position?: "vertical" | "horizontal" | "center";
}) {
  const inset = Math.min(4, w * 0.08, h * 0.08);
  return (
    <g data-front={glass ? "glass" : "door"}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#f3e5c8"
        className="front-frame"
      />
      <rect
        data-front-panel="door"
        x={x + inset}
        y={y + inset}
        width={Math.max(0.1, w - 2 * inset)}
        height={Math.max(0.1, h - 2 * inset)}
        fill="#f8edd7"
        className="front-inset"
      />
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
        ) : position !== "vertical" ? (
          <path
            className="technical-handle"
            d={`M${position === "center" ? x + w * 0.35 : hinge === "left" ? x + w - Math.min(22, w * 0.3) - 4 : x + 4} ${upper ? y + h - inset - 4 : y + inset + 4}h${Math.min(22, w * 0.3)}`}
          />
        ) : (
          <path
            className="technical-handle"
            d={`M${hinge === "left" ? x + w - Math.max(3, inset + 1) : x + Math.max(3, inset + 1)} ${upper ? y + h - Math.min(20, h * 0.23) - inset - 3 : y + inset + 3}v${Math.min(20, h * 0.23)}`}
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
  const patternId = useId().replace(/:/g, "");
  const front = e.finish?.front;
  const frontPaint =
    front && (front.image || front.texture !== "solid")
      ? `url(#finish-${patternId})`
      : front?.color;
  const { width: w, height: h } = r,
    spacer = isSpacer(e.item),
    handles = e.opening === "handles",
    item = isSpacer(e.item) ? null : e.item,
    gola =
      !!item && e.opening === "gola" && horizontalGolaKinds.includes(item.kind),
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
    item!.kind === "side" ||
    item!.kind === "filler" ||
    item!.kind === "bar"
  )
    content = (
      <rect
        width={w}
        height={h}
        className={
          item!.kind === "worktop" ? "material-worktop" : "material-body"
        }
        fill={
          item!.kind === "worktop"
            ? "#d7dcdd"
            : item!.kind === "plinth"
              ? "#e5decd"
              : "#eae1ce"
        }
      />
    );
  else if (item!.kind === "open" || item!.kind === "baseOpen")
    content = (
      <>
        <rect width={w} height={h} fill="#f5f1e9" className="material-body" />
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
      dh = innerH / n,
      mixed = item!.doors > 0,
      drawerWidth = mixed ? innerW * 0.48 : innerW;
    content = (
      <>
        <rect width={w} height={h} fill="#d9d3c6" className="material-body" />
        {Array.from({ length: n }, (_, i) => (
          <g key={i} data-front="drawer">
            <rect
              x={gap}
              y={gap + i * dh}
              width={drawerWidth}
              height={Math.max(1, dh - gap)}
              fill="#f3e5c8"
              className="front-frame"
            />
            <rect
              data-front-panel="drawer"
              x={gap + Math.min(3, dh * 0.1)}
              y={gap + i * dh + Math.min(3, dh * 0.1)}
              width={Math.max(1, drawerWidth - 2 * Math.min(3, dh * 0.1))}
              height={Math.max(1, dh - gap - 2 * Math.min(3, dh * 0.1))}
              fill="#f8edd7"
              className="front-inset"
            />
            {handles && (
              <path
                className="technical-handle"
                d={`M${drawerWidth * 0.37} ${gap + i * dh + Math.min(7, dh * 0.3)}h${drawerWidth * 0.26}`}
              />
            )}
            <path d={`M${gap} ${gap + i * dh}H${drawerWidth + gap}`} fill="none" />
            {gola && (
              <rect
                data-gola="horizontal"
                x={gap}
                y={gap + i * dh}
                width={drawerWidth}
                height={Math.max(1.5, h * 0.018)}
                fill="#9b9f99"
                stroke="none"
              />
            )}
          </g>
        ))}
        {mixed && <Door x={gap + drawerWidth} y={gap} width={Math.max(1, innerW - drawerWidth)}
          height={innerH} hinge="right" handles={handles} />}
      </>
    );
  } else {
    const tall = rowOf(item!) === "tall",
      oven = e.appliance === "oven",
      count = oven && !tall ? 0 : Math.max(0, item!.doors),
      openingH = oven ? Math.min(h * 0.87, 600 * (h / item!.height)) : 0;
    content = (
      <>
        <rect width={w} height={h} fill="#f1eadb" className="material-body" />
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
            const fh = tall
                ? (innerH - openingH) / count
                : innerH +
                  e.frontOverhang * (h / e.rect.height) +
                  (e.frontOverhang > 0 ? gap : 0),
              stackedLift = ["liftDouble", "liftFolding"].includes(item!.kind),
              actualFh = stackedLift ? innerH / count : fh,
              fw = tall || stackedLift ? innerW : innerW / count,
              x = tall || stackedLift ? gap : gap + i * fw,
              y = stackedLift ? gap + i * actualFh : tall
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
                height={Math.max(1, actualFh - (e.frontOverhang > 0 ? 0 : gap))}
                hinge={
                  count === 1
                    ? item!.visual?.hinge || "left"
                    : i % 2 === 0
                      ? "left"
                      : "right"
                }
                handles={handles}
                glass={!!item!.visual?.glass}
                lift={["lift", "liftDouble", "liftFolding"].includes(item!.kind)}
                upper={e.row === "wall"}
                position={e.handlePosition}
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
      data-front-overhang={e.frontOverhang || undefined}
      data-front-height={e.frontOverhang ? e.frontHeight : undefined}
      data-front-color={front?.color}
      data-mm-x={e.rect.x}
      data-mm-bottom={e.rect.y}
      className={`technical-element ${spacer ? "layout-spacer" : ""} ${e.conflict ? "conflict" : ""} ${selected ? "selected" : ""} ${dragging ? "dragging" : ""}`}
      style={
        {
          "--front-fill": frontPaint,
          "--front-color": front?.color,
          "--body-fill": e.finish?.body.color,
          "--handle-color": e.finish?.handle.color,
          "--worktop-fill": e.finish?.worktop.color,
        } as CSSProperties
      }
      clipPath={clipId ? `url(#${clipId})` : undefined}
    >
      {frontPaint?.startsWith("url") && front && (
        <defs>
          <pattern
            id={`finish-${patternId}`}
            width="1"
            height="1"
            patternContentUnits="objectBoundingBox"
          >
            <rect width="1" height="1" fill={front.color} />
            {(front.image || front.texture === "wood") && (
              <image
                href={front.image ?? "/brand/wood-light.png"}
                width="1"
                height="1"
                preserveAspectRatio="xMidYMid slice"
                opacity={front.image ? 1 : 0.35}
              />
            )}{" "}
            {front.texture === "stone" && !front.image && (
              <path
                d="M0 .1Q.5 .8 1 .3M0 .8Q.4 .2 1 .9"
                fill="none"
                stroke="#fff"
                strokeWidth=".015"
                opacity=".3"
              />
            )}
          </pattern>
        </defs>
      )}
      <g transform={`translate(${r.x} ${r.y})`}>
        {content}
      {item && specialLabel[item.kind] && (
        <g className="technical-special" pointerEvents="none">
          {(["corner", "cornerBlind", "wallCorner"].includes(item.kind)) &&
            <path d={`M1 ${h - 1}L${w * 0.34} ${h - 1}L${w * 0.34} ${h * 0.65}L${w - 1} ${h * 0.65}`} fill="none" stroke="#735c43" strokeWidth="1.5" />}
          {(["baseCargo", "tallCargo"].includes(item.kind)) &&
            [0.3, 0.5, 0.7].map((v) => <path key={v} d={`M${w * 0.2} ${h * v}h${w * 0.6}`} stroke="#735c43" fill="none" />)}
          <text x={w / 2} y={h * 0.58} textAnchor="middle" fontSize={Math.max(5, Math.min(14, w * 0.16, h * 0.15))}
            fill="#5d4733" stroke="white" strokeWidth="1.5" paintOrder="stroke">
            {specialLabel[item.kind]}
          </text>
        </g>
      )}
        {e.verticalProfile &&
          Array.from({ length: e.verticalProfile.count }, (_, i) => {
            const p = e.verticalProfile!,
              scale = h / e.rect.height,
              width = Math.max(1.5, p.inset * (w / e.rect.width));
            return (
              <rect
                key={i}
                data-gola="vertical"
                x={
                  p.count === 2
                    ? i === 0
                      ? 0
                      : w - width
                    : item?.visual?.hinge === "right"
                      ? 0
                      : w - width
                }
                y={p.top * scale}
                width={width}
                height={Math.max(0, h - (p.top + p.bottom) * scale)}
                fill="#9b9f99"
                stroke="none"
              />
            );
          })}
        {!spacer && (
          <rect width={w} height={h} className="cabinet-outline" fill="none" />
        )}
      </g>
    </g>
  );
}
