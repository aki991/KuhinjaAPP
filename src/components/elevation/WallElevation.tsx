import { isBridge, isSpacer } from "../../core/layout";
import { toScreen, type ElevationScene } from "../../core/elevation";
import ElementSVG from "./ElementSVG";
import { HeightDimension, WidthDimension, dimensionChains } from "./Dimensions";
import { HobSVG, SinkSVG } from "./ApplianceSVG";
import VisualAddition from "./VisualAdditions";

export default function WallElevation({
  scene,
  scale,
  selected,
  dragId,
  margin = { left: 44, top: 44 },
  canvasSize,
  rulers = true,
  showDimensions = true,
}: {
  scene: ElevationScene;
  scale: number;
  selected: string | null;
  dragId?: string;
  margin?: { left: number; top: number };
  canvasSize?: { width: number; height: number };
  rulers?: boolean;
  showDimensions?: boolean;
}) {
  const width = canvasSize?.width ?? scene.extent * scale + 100,
    height = canvasSize?.height ?? scene.height * scale + 116,
    floor = margin.top + scene.height * scale;
  const screen = (rect: Parameters<typeof toScreen>[0]) =>
    toScreen(rect, scale, scene.height, margin);
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
      <g data-dimension-chain="total">
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
