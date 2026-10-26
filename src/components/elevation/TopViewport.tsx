import { useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize, X, Scan } from "lucide-react";
import type { ElevationScene } from "../../core/elevation";
import type { KitchenWall, LayoutItem } from "../../core/types";
import { isSpacer } from "../../core/layout";
import { topViewEntries, type TopFilter } from "../../core/top-view";
import { WidthDimension, HeightDimension } from "./Dimensions";
export default function TopViewport({
  scene,
  selected,
  onSelect,
  fullscreen,
  onFullscreen,
  onCloseFullscreen,
  onFront,
  walls,
  onChooseWall,
}: {
  scene: ElevationScene;
  selected: string | null;
  onSelect: (i: LayoutItem) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onCloseFullscreen: () => void;
  onFront: () => void;
  walls: KitchenWall[];
  onChooseWall: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    [box, setBox] = useState({ width: 320, height: 340 }),
    [filter, setFilter] = useState<TopFilter>("all"),
    [zoom, setZoom] = useState(1),
    [dimensions, setDimensions] = useState(false);
  useLayoutEffect(() => {
    const node = root.current!;
    const update = () =>
      setBox({
        width: node.clientWidth,
        height: fullscreen ? node.clientHeight : 340,
      });
    const o = new ResizeObserver(update);
    o.observe(node);
    update();
    return () => o.disconnect();
  }, [fullscreen]);
  const entries = topViewEntries(scene, filter),
    extent = Math.max(scene.length, ...entries.map((e) => e.x + e.width)),
    depth = Math.max(320, ...entries.map((e) => e.y + e.depth)),
    top = fullscreen ? 150 : 30,
    bottom = dimensions ? 68 : 45,
    fitted = Math.max(
      0.00001,
      Math.min((box.width - 50) / extent, (box.height - top - bottom) / depth),
    ),
    scale = fitted * zoom,
    height = fullscreen
      ? box.height
      : Math.max(160, Math.min(340, top + depth * fitted + bottom)),
    canvasWidth = Math.max(box.width, Math.ceil(extent * scale + 50)),
    canvasHeight = Math.max(height, Math.ceil(top + depth * scale + bottom)),
    left = 32 + Math.max(0, box.width - 50 - extent * scale) / 2;
  return (
    <div ref={root} className="elevation-view top-view">
      <div className="elevation-toolbar">
        <div>
          {fullscreen && (
            <button
              className="icon-btn"
              aria-label="Zatvori prikaz preko celog ekrana"
              onClick={onCloseFullscreen}
            >
              <X size={20} />
            </button>
          )}
          <button
            className="icon-btn"
            aria-label="Umanji pogled odozgo"
            onClick={() => setZoom((z) => Math.max(0.25, z / 1.3))}
          >
            <Minus size={20} />
          </button>
          <button
            className="icon-btn"
            aria-label="Uvećaj pogled odozgo"
            onClick={() => setZoom((z) => Math.min(6, z * 1.3))}
          >
            <Plus size={20} />
          </button>
          <button className="text-btn" onClick={() => setZoom(1)}>
            <Scan size={18} />
            Uklopi
          </button>
        </div>
        <button
          className="text-btn dimension-toggle"
          aria-pressed={dimensions}
          onClick={() => setDimensions((d) => !d)}
        >
          Kote
        </button>
        {fullscreen && (
          <button className="text-btn" onClick={onFront}>
            Spreda
          </button>
        )}
        {!fullscreen && (
          <button
            className="icon-btn"
            aria-label="Prikaz preko celog ekrana"
            onClick={onFullscreen}
          >
            <Maximize size={20} />
          </button>
        )}
        {fullscreen && walls.length > 1 && (
          <select
            className="fullscreen-wall-select"
            aria-label="Zid u celom ekranu"
            value={scene.wall}
            onChange={(e) => onChooseWall(e.target.value)}
          >
            {walls.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <div
          className="top-filters choice-buttons"
          role="group"
          aria-label="Elementi u pogledu odozgo"
        >
          {(
            [
              ["base", "Donji"],
              ["wall", "Viseći"],
              ["all", "Sve"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => {
                setFilter(v);
                setZoom(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`top-scroll ${zoom <= 1 ? "fitted" : ""}`}
        style={{ height, overflow: zoom <= 1 ? "hidden" : "auto" }}
      >
        <svg
          className="top-canvas"
          role="img"
          aria-label="Pogled kuhinje odozgo"
          width={canvasWidth}
          height={canvasHeight}
          data-top-filter={filter}
        >
          <path
            d={`M${left} ${top - 8}H${left + scene.length * scale}`}
            stroke="#646b60"
            strokeWidth={5}
          />
          {scene.objects.map((o) => (
            <rect
              key={o.id}
              x={left + o.x * scale}
              y={top - 11}
              width={o.width * scale}
              height={7}
              fill={o.kind === "window" ? "#c9e2ee" : "#bcb9aa"}
            />
          ))}
          {entries.map(({ entry: e, x, y, width, depth: d }) => {
            const px = left + x * scale,
              py = top + y * scale,
              w = width * scale,
              h = d * scale,
              spacer = isSpacer(e.item),
              upper = e.row === "wall",
              active = e.id === selected;
            return (
              <g
                key={e.key}
                data-plan-id={e.id}
                data-plan-row={e.row}
                data-mm-x={x}
                data-mm-depth={d}
                role="button"
                tabIndex={0}
                aria-label={`Izmeni ${e.code}, pogled odozgo`}
                onClick={() => onSelect(e.item)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onSelect(e.item);
                  }
                }}
              >
                <rect
                  x={px}
                  y={py}
                  width={w}
                  height={h}
                  fill={
                    spacer
                      ? "transparent"
                      : e.row === "extra"
                        ? (e.finish?.worktop.color ?? "#b8a381")
                        : (e.finish?.front.color ?? "#f0e0c2")
                  }
                  fillOpacity={upper ? 0.35 : 1}
                  stroke={active ? "#915823" : upper ? "#3774a0" : "#8b8067"}
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={upper || spacer ? "5 3" : undefined}
                />
                {!spacer && e.row !== "extra" && (
                  <path
                    d={`M${px + 2} ${py + h - 3}h${Math.max(0, w - 4)}`}
                    stroke="#95866b"
                  />
                )}
                {e.appliance === "sink" && !upper && (
                  <>
                    <rect
                      x={px + w * 0.17}
                      y={py + h * 0.2}
                      width={w * 0.66}
                      height={h * 0.55}
                      rx={3}
                      fill="#e5eef0"
                      stroke="#8c9998"
                    />
                    <circle
                      cx={px + w * 0.5}
                      cy={py + h * 0.45}
                      r={Math.min(2, w * 0.035)}
                      fill="#8b9696"
                    />
                  </>
                )}
                {(e.hob || e.appliance === "hob") &&
                  !upper &&
                  [0.3, 0.7].flatMap((a) =>
                    [0.3, 0.65].map((b) => (
                      <circle
                        key={a + "-" + b}
                        cx={px + w * a}
                        cy={py + h * b}
                        r={Math.max(1, Math.min(w, h) * 0.11)}
                        fill="none"
                        stroke="#696e61"
                      />
                    )),
                  )}
                {!spacer && w > 20 && (
                  <text
                    x={px + w / 2}
                    y={upper ? py + 16 : py + h - 9}
                    textAnchor="middle"
                    fontSize="14"
                    fill={upper ? "#286595" : "#654322"}
                  >
                    {e.code}
                  </text>
                )}
                {dimensions && e.row === "base" && (
                  <WidthDimension
                    x={px}
                    y={top + depth * scale + 28}
                    width={w}
                    value={e.rect.width}
                  />
                )}
              </g>
            );
          })}
          <WidthDimension
            x={left}
            y={top + depth * scale + (dimensions ? 58 : 30)}
            width={scene.length * scale}
            value={scene.length}
          />
          {dimensions && (
            <HeightDimension
              x={18}
              y={top}
              height={depth * scale}
              value={depth}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
