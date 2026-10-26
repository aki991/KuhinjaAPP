import { isSpacer } from "../../core/layout";
import { toScreen, type ElevationScene } from "../../core/elevation";
import ElementSVG from "./ElementSVG";
import { HeightDimension, WidthDimension } from "./Dimensions";
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
}: {
  scene: ElevationScene;
  scale: number;
  selected: string | null;
  dragId?: string;
  margin?: { left: number; top: number };
  canvasSize?: { width: number; height: number };
  rulers?: boolean;
}) {
  const width = canvasSize?.width ?? scene.extent * scale + 100,
    height = canvasSize?.height ?? scene.height * scale + 116,
    floor = margin.top + scene.height * scale;
  const screen = (rect: Parameters<typeof toScreen>[0]) =>
    toScreen(rect, scale, scene.height, margin);
  const upperDimensionsBelow = (scene.upperBottom - scene.baseTop) * scale < 40;
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
      {scene.objects.map((o) => (
        <VisualAddition
          key={o.id}
          object={o}
          rect={screen({
            x: o.x,
            y: o.bottom,
            width: o.width,
            height: o.height,
          })}
        />
      ))}
      <path
        d={`M${margin.left} ${floor}H${margin.left + scene.extent * scale}`}
        className="technical-floor"
      />
      {sorted.map((e, index) => {
        const r = screen(e.rect),
          active = selected === e.id;
        return (
          <g key={e.key}>
            {e.row === "base" &&
              !isSpacer(e.item) &&
              scene.config.toeKick > 0 && (
                <g className="technical-legs" aria-hidden="true">
                  <path
                    d={`M${r.x + r.width * 0.12} ${r.y + r.height}V${floor}M${r.x + r.width * 0.88} ${r.y + r.height}V${floor}`}
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
            {(e.row !== "extra" || active) && (
              <text
                className={`technical-code ${active ? "selected" : ""}`}
                x={r.x + r.width / 2}
                y={
                  e.row === "extra"
                    ? r.y - 10
                    : r.y + Math.min(19, r.height * 0.45)
                }
                textAnchor="middle"
              >
                {e.code}
                {e.item.quantity > 1 ? `·${e.instance + 1}` : ""}
              </text>
            )}
            {e.row !== "extra" && (
              <WidthDimension
                x={r.x}
                y={
                  e.row === "wall"
                    ? (upperDimensionsBelow
                        ? floor + 48
                        : r.y + r.height + 24) +
                      (r.width < 40 ? (index % 2) * 18 : 0)
                    : floor + 24 + (r.width < 40 ? (index % 2) * 18 : 0)
                }
                width={r.width}
                value={e.rect.width}
                selected={active}
              />
            )}
            {e.row === "extra" && active && (
              <WidthDimension
                x={r.x}
                y={r.y - 10}
                width={r.width}
                value={e.rect.width}
                selected
              />
            )}
            {active && (
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
      {rulers && (
        <>
          <WidthDimension
            x={44}
            y={22}
            width={scene.length * scale}
            value={scene.length}
          />
          <HeightDimension
            x={23}
            y={44 + (scene.height - scene.roomHeight) * scale}
            height={scene.roomHeight * scale}
            value={scene.roomHeight}
          />
          <text x={44} y={height - 10} className="technical-units">
            mm · pogled spreda
          </text>
        </>
      )}
      <path
        d={`M${margin.left + scene.length * scale} ${margin.top}V${floor + 8}`}
        className="technical-wall-end"
      />
    </svg>
  );
}
