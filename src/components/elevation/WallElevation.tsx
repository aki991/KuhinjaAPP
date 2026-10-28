import { isBridge, isSpacer, rowOf } from "../../core/layout";
import { isFreestanding } from "../../core/catalog";
import { tileById } from "../../core/tiles";
import { tileImage } from "./tileTexture";
import { toScreen, type ElevationScene } from "../../core/elevation";
import ElementSVG from "./ElementSVG";
import { HeightDimension, WidthDimension, dimensionChains } from "./Dimensions";
import { HobSVG, SinkSVG } from "./ApplianceSVG";
import VisualAddition from "./VisualAdditions";
import { number } from "../UI";

export default function WallElevation({
  scene,
  scale,
  selected,
  dragId,
  margin = { left: 44, top: 44 },
  canvasSize,
  rulers = true,
  showDimensions = true,
  onEditLength,
}: {
  scene: ElevationScene;
  scale: number;
  selected: string | null;
  dragId?: string;
  margin?: { left: number; top: number };
  canvasSize?: { width: number; height: number };
  rulers?: boolean;
  showDimensions?: boolean;
  onEditLength?: () => void;
}) {
  const width = canvasSize?.width ?? scene.extent * scale + 100,
    height = canvasSize?.height ?? scene.height * scale + 116,
    floor = margin.top + scene.height * scale;
  const screen = (rect: Parameters<typeof toScreen>[0]) =>
    toScreen(rect, scale, scene.height, margin);
  const tile = tileById(scene.wallTile),
    roomTile = tile ? tileImage(tile) : null;
  const chains = dimensionChains(scene, scale),
    hasBridge = scene.entries.some((e) => isBridge(e.item));
  const dimensionFloor = scene.entries.some((e) => e.row === "base")
    ? floor
    : Math.max(
        margin.top,
        ...scene.entries.map(
          (e) =>
            screen(e.rect).y + screen(e.rect).height + e.frontOverhang * scale,
        ),
      );
  /** Free length between the cabinets of a row and the ends of the wall; it shrinks as cabinets are added. */
  const freeRuns: { x0: number; x1: number; y: number; value: number }[] = [];
  for (const row of ["base", "wall"] as const) {
    const own = scene.entries.filter((e) => e.row === row && !isSpacer(e.item));
    if (!scene.entries.length || (row === "wall" && !own.length)) continue;
    // A tall cabinet (fridge, pantry) also fills the wall-cabinet row.
    const items =
      row === "wall"
        ? [
            ...own,
            ...scene.entries.filter(
              (e) =>
                !isSpacer(e.item) &&
                rowOf(e.item) === "tall" &&
                e.rect.y + e.rect.height > scene.upperBottom,
            ),
          ]
        : own;
    const reserved = scene.reserved?.[row] ?? { start: 0, end: 0 },
      mid = row === "base" ? scene.baseTop / 2 : scene.upperBottom + 360,
      y = margin.top + (scene.height - mid) * scale,
      first = Math.min(...items.map((e) => e.rect.x)),
      last = Math.max(...items.map((e) => e.rect.x + e.rect.width));
    const spans: [number, number][] = items.length
      ? [
          [reserved.start, first],
          [last, scene.length - reserved.end],
        ]
      : [[reserved.start, scene.length - reserved.end]];
    for (const [a, b] of spans)
      if (b - a >= 1) freeRuns.push({ x0: a, x1: b, y, value: Math.round(b - a) });
  }
  const sorted = [...scene.entries].sort(
    (a, b) => Number(a.row !== "wall") - Number(b.row !== "wall"),
  );
  return (
    <svg
      className="wall-elevation"
      width={width}
      height={height}
      role="img"
      aria-label="2D elevacija kuhinje, dimenzije u milimetrima"
      data-scale={scale}
    >
      <defs>
        {roomTile && (
          <pattern
            id="room-wall-tile"
            patternUnits="userSpaceOnUse"
            x={margin.left}
            y={floor - roomTile.cellHeight * scale}
            width={roomTile.cellWidth * scale}
            height={roomTile.cellHeight * scale}
          >
            <image
              href={roomTile.url}
              width={roomTile.cellWidth * scale}
              height={roomTile.cellHeight * scale}
              preserveAspectRatio="none"
            />
          </pattern>
        )}
        {scene.entries
          .filter((e) => e.row === "wall")
          .map((e) => (
            <clipPath key={e.key} id={`visible-${e.key}`}>
              {e.visible.map((v, i) => (
                <rect key={i} {...screen(v)} />
              ))}
            </clipPath>
          ))}
      </defs>
      <rect
        {...screen({
          x: 0,
          y: 0,
          width: scene.length,
          height: scene.roomHeight,
        })}
        className="technical-room"
      />
      {roomTile && (
        <rect
          {...screen({
            x: 0,
            y: 0,
            width: scene.length,
            height: scene.roomHeight,
          })}
          fill="url(#room-wall-tile)"
          data-room-tile={scene.wallTile}
        />
      )}
      {(scene.occupied ?? []).map((zone, i) => {
        // Part of this wall taken by the corner cabinet of the neighbouring wall.
        const bottom = zone.row === "base" ? 0 : scene.upperBottom,
          top = zone.row === "base" ? scene.baseTop : scene.upperBottom + 720,
          x = zone.edge === "start" ? 0 : scene.length - zone.size,
          r = screen({ x, y: bottom, width: zone.size, height: top - bottom });
        return (
          <g key={i} className="technical-occupied" data-occupied-by={zone.wall}>
            <rect {...r} />
            {r.width >= 26 && (
              <text
                x={r.x + r.width / 2}
                y={r.y + r.height / 2 + 4}
                textAnchor="middle"
                fontSize={Math.min(13, r.width / 4)}
              >
                {zone.wall}
              </text>
            )}
          </g>
        );
      })}
      {scene.objects.map((o, index) => (
        <g key={o.id}>
          <VisualAddition
            object={o}
            rect={screen({
              x: o.x,
              y: o.bottom,
              width: o.width,
              height: o.height,
            })}
          />
          <text
            className="technical-code object-code"
            textAnchor="middle"
            x={margin.left + (o.x + o.width / 2) * scale}
            y={margin.top + (scene.height - o.bottom - o.height) * scale - 9}
          >
            {{ window: "PZ", door: "VR", column: "ST", niche: "N" }[o.kind]}
            {index + 1}
          </text>
        </g>
      ))}
      <path
        d={`M${margin.left} ${floor}H${margin.left + scene.extent * scale}`}
        className="technical-floor"
      />
      {sorted.map((e) => {
        const r = screen(e.rect),
          active = selected === e.id;
        return (
          <g key={e.key}>
            {e.row === "base" &&
              !isSpacer(e.item) &&
              !isFreestanding(e.item.kind) &&
              scene.config.toeKick > 0 && (
                <g className="technical-legs" aria-hidden="true">
                  <rect
                    data-plinth="true"
                    x={r.x}
                    y={r.y + r.height}
                    width={r.width}
                    height={Math.max(0, floor - r.y - r.height)}
                    fill="#b7b9af"
                    stroke="#96998e"
                    strokeWidth={0.7}
                  />
                </g>
              )}
            <ElementSVG
              entry={e}
              rect={r}
              selected={active}
              dragging={dragId === e.id}
              clipId={e.row === "wall" ? `visible-${e.key}` : undefined}
            />
            {(e.hob || e.appliance === "hob" || e.appliance === "sink") && (
              <g className="technical-equipment">
                {e.appliance === "sink" ? (
                  <SinkSVG
                    x={r.x + r.width * 0.2}
                    y={margin.top + (scene.height - e.counterTop) * scale}
                    width={r.width * 0.6}
                  />
                ) : (
                  <HobSVG
                    x={r.x + r.width * 0.12}
                    y={margin.top + (scene.height - e.counterTop) * scale}
                    width={r.width * 0.76}
                  />
                )}
              </g>
            )}
            {(e.row !== "extra" || active || isBridge(e.item)) &&
              (!isSpacer(e.item) || active || dragId === e.id) && (
                <text
                  className={`technical-code ${active ? "selected" : ""}`}
                  x={r.x + r.width / 2}
                  y={
                    // A bridge covers the labels above the wall cabinets, so they sit inside.
                    isBridge(e.item) || (e.row === "wall" && hasBridge)
                      ? r.y + 20
                      : e.row === "extra"
                        ? r.y - 10
                        : e.row === "wall"
                          ? r.y - 8
                          : floor - 3
                  }
                  textAnchor="middle"
                >
                  {e.code}
                  {e.item.quantity > 1 ? `·${e.instance + 1}` : ""}
                </text>
              )}
            {showDimensions && e.row !== "extra" && (
              <WidthDimension
                x={r.x}
                y={
                  dimensionFloor +
                  (e.row === "wall"
                    ? chains.wallY + (chains.wall.offsets.get(e.key) ?? 0)
                    : chains.baseY + (chains.base.offsets.get(e.key) ?? 0))
                }
                width={r.width}
                value={e.rect.width}
                selected={active}
              />
            )}
            {showDimensions && e.row === "extra" && active && (
              <WidthDimension
                x={r.x}
                y={r.y - 10}
                width={r.width}
                value={e.rect.width}
                selected
              />
            )}
            {showDimensions && active && (
              <HeightDimension
                x={r.x + r.width + 12}
                y={r.y}
                height={r.height}
                value={e.rect.height}
              />
            )}
          </g>
        );
      })}
      <g className="technical-free" aria-hidden="true">
        {freeRuns.map((run, i) => {
          const x0 = margin.left + run.x0 * scale,
            x1 = margin.left + run.x1 * scale,
            label = number(run.value),
            labelWidth = label.length * 6.5 + 8;
          if (x1 - x0 < 6) return null;
          return (
            <g key={i} data-free-length={run.value}>
              <path d={`M${x0} ${run.y - 5}v10M${x1} ${run.y - 5}v10M${x0} ${run.y}H${x1}`} />
              {x1 - x0 >= labelWidth + 6 && (
                <>
                  <rect
                    x={(x0 + x1) / 2 - labelWidth / 2}
                    y={run.y - 8}
                    width={labelWidth}
                    height={16}
                    className="technical-free-label"
                  />
                  <text x={(x0 + x1) / 2} y={run.y + 4} textAnchor="middle">
                    {label}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </g>
      <g
        data-dimension-chain="total"
        className={onEditLength ? "elevation-length-edit" : undefined}
        role={onEditLength ? "button" : undefined}
        tabIndex={onEditLength ? 0 : undefined}
        aria-label={onEditLength ? `Izmeni dužinu zida, ${scene.length} mm` : undefined}
        onClick={onEditLength}
        onKeyDown={
          onEditLength
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEditLength();
                }
              }
            : undefined
        }
      >
        {onEditLength && (
          <rect
            x={margin.left + (scene.length * scale) / 2 - 60}
            y={dimensionFloor + (showDimensions ? chains.totalY : 32) - 26}
            width={120}
            height={34}
            fill="transparent"
          />
        )}
        <WidthDimension
          x={margin.left}
          y={dimensionFloor + (showDimensions ? chains.totalY : 32)}
          width={scene.length * scale}
          value={scene.length}
        />
      </g>
      {rulers && showDimensions && (
        <>
          <HeightDimension
            x={23}
            y={44 + (scene.height - scene.roomHeight) * scale}
            height={scene.roomHeight * scale}
            value={scene.roomHeight}
          />
        </>
      )}
      <path
        d={`M${margin.left + scene.length * scale} ${margin.top}V${floor + 8}`}
        className="technical-wall-end"
      />
    </svg>
  );
}
