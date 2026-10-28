import { isSpacer, rowOf } from "../../core/layout";
import { hoodDrop, type ElevationEntry, type Rect } from "../../core/elevation";
import { ApplianceSVG } from "./ApplianceSVG";
import { useId, type CSSProperties } from "react";
import type { ElementKind } from "../../core/types";
import { isFreestanding, templates } from "../../core/catalog";
import ReferenceArtwork from "./ReferenceArtwork";
import { applianceStyle, golaHex } from "../../core/appearance";
const specialLabel: Partial<Record<ElementKind, string>> = {
  baseCargo: "CARGO",
  tallCargo: "CARGO",
  wallHood: "NAPA",
  wallCorner: "L",
  corner: "L",
  cornerBlind: "SLEPI",
  bar: "ŠANK",
  freeFridge: "FRIŽ.",
  freeStove: "ŠPORET",
  freeDishwasher: "SUD.",
  dishwasherBuilt: "SUD.",
  tallFreezer: "ZAMRZ.",
  tallOvenMicrowave: "R+M",
  wallBridgeFridge: "MOST",
  wallBridgeOven: "MOST",
  islandBack: "OBLOGA",
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
  bare = false,
}: {
  bare?: boolean;
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
  const hoodStyle = applianceStyle(e.applianceColor),
    golaFill = golaHex(e.golaColor),
    golaEdge = e.golaColor === "white" ? "#8d9296" : "#0f1112";
  const { width: w, height: h } = r,
    spacer = isSpacer(e.item),
    handles = e.opening === "handles",
    originalItem = isSpacer(e.item) ? null : e.item,
    reference = originalItem?.kind.startsWith("reference")
      ? templates.find((t) => t.kind === originalItem.kind)
      : undefined,
    item =
      originalItem && reference?.constructionKind
        ? { ...originalItem, kind: reference.constructionKind }
        : originalItem,
    gola =
      !!item &&
      e.opening === "gola" &&
      !e.verticalProfile &&
      !["open", "baseOpen", "oven"].includes(item.kind),
    gap = Math.min(1.3, w * 0.02, h * 0.02),
    innerW = Math.max(1, w - 2 * gap),
    innerH = Math.max(1, h - 2 * gap);
  // Offer drawings leave the appliance out: only an empty niche shows where it goes.
  const niche =
    bare &&
    !spacer &&
    ((["oven", "fridge", "dishwasher"] as string[]).includes(e.appliance) ||
      /rerna|frižider|zamrziv|sudomašin|kolonac/i.test(reference?.name ?? ""));
  const drop = bare || !item ? 0 : hoodDrop(item);
  let content;
  if (spacer)
    content = (
      <rect width={w} height={h} className="technical-spacer" fill="none" />
    );
  else if (niche)
    content = (
      <>
        <rect width={w} height={h} fill="#f1eadb" className="material-body" />
        <rect
          x={w * 0.1}
          y={h * 0.06}
          width={w * 0.8}
          height={h * 0.88}
          fill="#e4dccb"
          stroke="#9a937f"
          strokeWidth={0.8}
        />
      </>
    );
  else if (item && reference && !reference.constructionKind && !hoodDrop(item))
    content = (
      <ReferenceArtwork
        applianceColor={e.applianceColor}
        kind={item.kind}
        width={w}
        height={h + drop * (h / e.rect.height)}
        hood={drop > 0}
        freestanding={isFreestanding(item.kind)}
        handles={handles}
        mirror={item.doors === 1 && item.visual?.hinge === "right"}
      />
    );
  else if (item!.kind === "freeHood") {
    // Decorative hood: canopy at the bottom, flue going up towards the ceiling.
    const canopy = Math.min(h * 0.32, 300 * (h / e.rect.height)),
      flue = w * 0.4;
    content = (
      <g
        data-appliance="hood"
        fill={hoodStyle.body}
        stroke={selected ? "#98622f" : hoodStyle.line}
        strokeWidth={selected ? 1.8 : 1.2}
      >
        <rect x={(w - flue) / 2} y={0} width={flue} height={h - canopy} />
        <path d={`M${(w - flue) / 2} ${h - canopy}L0 ${h}H${w}L${(w + flue) / 2} ${h - canopy}Z`} />
        <path
          d={`M${w * 0.1} ${h - canopy * 0.2}H${w * 0.9}`}
          stroke={hoodStyle.detail}
          strokeWidth="2"
        />
      </g>
    );
  } else if (
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
      <ApplianceSVG
        kind={e.appliance}
        width={w}
        height={h}
        handles={handles}
        color={e.applianceColor}
      />
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
              height={Math.max(1, dh - (i < n - 1 ? gap : 0))}
              fill="#f3e5c8"
              className="front-frame"
            />
            <rect
              data-front-panel="drawer"
              x={gap + Math.min(3, dh * 0.1)}
              y={gap + i * dh + Math.min(3, dh * 0.1)}
              width={Math.max(1, drawerWidth - 2 * Math.min(3, dh * 0.1))}
              height={Math.max(
                1,
                dh - (i < n - 1 ? gap : 0) - 2 * Math.min(3, dh * 0.1),
              )}
              fill="#f8edd7"
              className="front-inset"
            />
            {handles && (
              <path
                className="technical-handle"
                d={`M${drawerWidth * 0.37} ${gap + i * dh + Math.min(7, dh * 0.3)}h${drawerWidth * 0.26}`}
              />
            )}
            <path
              d={`M${gap} ${gap + i * dh}H${drawerWidth + gap}`}
              fill="none"
            />
            {gola && (
              <rect
                data-gola="horizontal"
                x={gap}
                y={gap + i * dh}
                width={drawerWidth}
                height={Math.max(3, h * 0.03)}
                fill={golaFill}
                stroke={golaEdge}
                strokeWidth={0.5}
              />
            )}
          </g>
        ))}
        {mixed && (
          <Door
            x={gap + drawerWidth}
            y={gap}
            width={Math.max(1, innerW - drawerWidth)}
            height={innerH}
            hinge={item!.visual?.hinge || "right"}
            handles={handles}
          />
        )}
      </>
    );
  } else {
    const tall = rowOf(item!) === "tall",
      oven = e.appliance === "oven",
      // A built-in oven cabinet: the 600 mm oven on top, a drawer under it.
      ovenDrawer = oven && !tall && item!.kind === "oven",
      // The hood cabinet is drawn like a wall cabinet with one door, with the hood body below it.
      count = oven && !tall ? 0 : Math.max(hoodDrop(item!) > 0 ? 1 : 0, item!.doors),
      openingH = ovenDrawer
        ? 600 * (h / item!.height)
        : oven
          ? Math.min(h * 0.87, 600 * (h / item!.height))
          : 0;
    content = (
      <>
        <rect width={w} height={h} fill="#f1eadb" className="material-body" />
        {oven && (
          <g
            transform={`translate(${ovenDrawer ? gap : gap * 2},${ovenDrawer ? gap : (h - openingH) / 2})`}
          >
            <ApplianceSVG
              color={e.applianceColor}
              kind="oven"
              width={Math.max(2, w - gap * (ovenDrawer ? 2 : 4))}
              height={openingH}
            />
          </g>
        )}
        {ovenDrawer &&
          (() => {
            const y0 = gap + openingH + gap,
              dh = Math.max(1, h - y0 - gap),
              inset = Math.min(3, dh * 0.1);
            return (
              <g data-front="drawer">
                <rect x={gap} y={y0} width={innerW} height={dh} fill="#f3e5c8" className="front-frame" />
                <rect
                  data-front-panel="drawer"
                  x={gap + inset}
                  y={y0 + inset}
                  width={Math.max(1, innerW - 2 * inset)}
                  height={Math.max(1, dh - 2 * inset)}
                  fill="#f8edd7"
                  className="front-inset"
                />
                {handles && (
                  <path
                    className="technical-handle"
                    d={`M${w * 0.37} ${y0 + Math.min(7, dh * 0.3)}h${w * 0.26}`}
                  />
                )}
                {e.opening === "gola" && (
                  <rect
                    data-gola="horizontal"
                    x={gap}
                    y={y0}
                    width={innerW}
                    height={Math.max(3, h * 0.03)}
                    fill={golaFill}
                    stroke={golaEdge}
                    strokeWidth={0.5}
                  />
                )}
              </g>
            );
          })()}
        {count > 0 &&
          Array.from({ length: count }, (_, i) => {
            const fh = tall
                ? (innerH - openingH) / count
                : innerH +
                  e.frontOverhang * (h / e.rect.height) +
                  (e.frontOverhang > 0 ? gap : 0),
              stackedLift = ["liftDouble", "liftFolding"].includes(item!.kind),
              actualFh = stackedLift
                ? (innerH - gap * (count - 1)) / count
                : fh,
              fw =
                tall || stackedLift
                  ? innerW
                  : (innerW - gap * (count - 1)) / count,
              x = tall || stackedLift ? gap : gap + i * (fw + gap),
              y = stackedLift
                ? gap + i * (actualFh + gap)
                : tall
                  ? gap +
                    i * fh +
                    (oven && i >= Math.ceil(count / 2) ? openingH : 0)
                  : gap;
            return (
              <Door
                key={i}
                x={x}
                y={y}
                width={Math.max(1, fw)}
                height={Math.max(
                  1,
                  actualFh - (tall && i < count - 1 ? gap : 0),
                )}
                hinge={
                  count === 1
                    ? item!.visual?.hinge || "left"
                    : tall
                      ? item!.visual?.hinges?.[i] ?? (i % 2 === 0 ? "left" : "right")
                      : i % 2 === 0
                        ? "left"
                        : "right"
                }
                handles={handles}
                glass={!!item!.visual?.glass}
                lift={["lift", "liftDouble", "liftFolding"].includes(
                  item!.kind,
                )}
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
            height={Math.max(3, h * 0.035)}
            fill={golaFill}
            stroke={golaEdge}
            strokeWidth={0.5}
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
        {drop > 0 && (
          <g data-appliance="hood" className="appliance-lines" style={{ stroke: hoodStyle.line, color: hoodStyle.detail }}>
            <rect
              x={1}
              y={h}
              width={Math.max(1, w - 2)}
              height={drop * (h / e.rect.height)}
              fill={hoodStyle.body}
              strokeWidth={0.8}
            />
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                d={`M${(w * (i + 1)) / 9} ${h + drop * (h / e.rect.height) * 0.25}v${drop * (h / e.rect.height) * 0.5}`}
                stroke={hoodStyle.detail}
                strokeWidth={1.2}
                opacity={0.7}
              />
            ))}
          </g>
        )}
        {item && specialLabel[item.kind] && (
          <g className="technical-special" pointerEvents="none">
            {["corner", "cornerBlind", "wallCorner"].includes(item.kind) && (
              <path
                d={`M1 ${h - 1}L${w * 0.34} ${h - 1}L${w * 0.34} ${h * 0.65}L${w - 1} ${h * 0.65}`}
                fill="none"
                stroke="#735c43"
                strokeWidth="1.5"
              />
            )}
            {["baseCargo", "tallCargo"].includes(item.kind) &&
              [0.3, 0.5, 0.7].map((v) => (
                <path
                  key={v}
                  d={`M${w * 0.2} ${h * v}h${w * 0.6}`}
                  stroke="#735c43"
                  fill="none"
                />
              ))}
            <text
              x={w / 2}
              y={h * 0.58}
              textAnchor="middle"
              fontSize={Math.max(5, Math.min(14, w * 0.16, h * 0.15))}
              fill="#5d4733"
              stroke="white"
              strokeWidth="1.5"
              paintOrder="stroke"
            >
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
                fill={golaFill}
                stroke={golaEdge}
                strokeWidth={0.5}
              />
            );
          })}
        {!spacer && item?.kind !== "freeHood" && (
          <rect
            width={w}
            height={h}
            className={`cabinet-outline ${item && isFreestanding(item.kind) ? "appliance-outline" : ""}`}
            fill="none"
          />
        )}
      </g>
    </g>
  );
}
