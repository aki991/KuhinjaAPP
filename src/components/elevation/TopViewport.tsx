import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LocateFixed, Maximize, Minus, Plus, Ruler, X } from "lucide-react";
import type { ElevationScene } from "../../core/elevation";
import type { KitchenWall, LayoutItem, Offer } from "../../core/types";
import { isSpacer } from "../../core/layout";
import { kitchenPlan, type TopFilter } from "../../core/top-view";
import { WidthDimension, HeightDimension } from "./Dimensions";
export default function TopViewport({
  offer,
  scene,
  selected,
  onSelect,
  fullscreen,
  onFullscreen,
  onCloseFullscreen,
  onFront,
  walls,
  onChooseWall,
  onEditWall,
  toolbarExtra,
}: {
  offer: Offer;
  scene: ElevationScene;
  selected: string | null;
  onSelect: (i: LayoutItem) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onCloseFullscreen: () => void;
  onFront: () => void;
  walls: KitchenWall[];
  onChooseWall: (id: string) => void;
  onEditWall: (id: string) => void;
  toolbarExtra?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    currentZoom = useRef(1),
    [box, setBox] = useState({ width: 320, height: 340 }),
    [filter, setFilter] = useState<TopFilter>("all"),
    [zoom, setZoom] = useState(1),
    [dimensions, setDimensions] = useState(false);
  currentZoom.current = zoom;
  useLayoutEffect(() => {
    const node = scroll.current!;
    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (e: TouchEvent) =>
      Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2)
        pinch = { distance: distance(e), zoom: currentZoom.current };
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      setZoom(
        Math.max(
          0.25,
          Math.min(6, (pinch.zoom * distance(e)) / Math.max(1, pinch.distance)),
        ),
      );
    };
    const end = (e: TouchEvent) => {
      if (!pinch) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches.length < 2) pinch = null;
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end, { passive: false });
    node.addEventListener("touchcancel", end, { passive: false });
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
    };
  }, []);
  useLayoutEffect(() => {
    const node = root.current!;
    const update = () =>
      setBox({
        width: node.clientWidth,
        height: fullscreen
          ? node.clientHeight
          : walls.length > 1
            ? Math.min(560, Math.max(340, window.innerHeight * 0.6))
            : 340,
      });
    const o = new ResizeObserver(update);
    o.observe(node);
    update();
    return () => o.disconnect();
  }, [fullscreen, walls.length]);
  const plan = kitchenPlan(offer, filter),
    extent = plan.bounds.width,
    depth = plan.bounds.height,
    padding = plan.walls.length > 1 ? (dimensions ? 76 : 32) : 32,
    top = fullscreen
      ? 150
      : plan.walls.length > 1
        ? dimensions
          ? 80
          : 36
        : 30,
    bottom = plan.walls.length > 1 ? (dimensions ? 70 : 36) : dimensions ? 100 : 42,
    fitted = Math.max(
      0.00001,
      Math.min(
        (box.width - padding * 2) / extent,
        (box.height - top - bottom) / depth,
      ),
    ),
    scale = fitted * zoom,
    height = fullscreen
      ? box.height
      : Math.max(160, Math.min(box.height, top + depth * fitted + bottom)),
    canvasWidth = Math.max(box.width, Math.ceil(extent * scale + padding * 2)),
    canvasHeight = Math.max(height, Math.ceil(top + depth * scale + bottom)),
    left = padding + Math.max(0, box.width - padding * 2 - extent * scale) / 2;
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
            className="icon-btn zoom-btn"
            aria-label="Umanji pogled odozgo"
            onClick={() => setZoom((z) => Math.max(0.25, z / 1.3))}
          >
            <Minus size={20} />
          </button>
          <button
            className="icon-btn zoom-btn"
            aria-label="Uvećaj pogled odozgo"
            onClick={() => setZoom((z) => Math.min(6, z * 1.3))}
          >
            <Plus size={20} />
          </button>
          <button className="text-btn" onClick={() => setZoom(1)}>
            <LocateFixed size={18} />
            Uklopi
          </button>
        </div>
        <button
          className="text-btn dimension-toggle"
          aria-pressed={dimensions}
          onClick={() => setDimensions((d) => !d)}
        >
          <Ruler size={18} /> Kote
        </button>
        {fullscreen && (
          <button className="text-btn" onClick={onFront}>
            Spreda
          </button>
        )}
        {!fullscreen && (
          <button
            className="text-btn"
            aria-label="Prikaz preko celog ekrana"
            onClick={onFullscreen}
          >
            <Maximize size={18} /> Ceo ekran
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
        {!fullscreen && toolbarExtra && (
          <div className="elevation-toolbar-row2">{toolbarExtra}</div>
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
        ref={scroll}
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
          {plan.walls.map((wall) => {
            const wallDepth = Math.max(
                320,
                ...wall.entries.map((e) => e.y + e.depth),
              ),
              originX = left + (wall.x - plan.bounds.x) * scale,
              originY = top + (wall.y - plan.bounds.y) * scale;
            return (
              <g
                key={wall.scene.wall}
                data-plan-wall={wall.scene.wall}
                data-wall-angle={wall.angle}
                data-wall-x={wall.x}
                data-wall-y={wall.y}
                transform={`translate(${originX} ${originY}) rotate(${wall.angle})`}
              >
                <path
                  d={`M0 0H${wall.scene.length * scale}`}
                  stroke="#646b60"
                  strokeWidth={5}
                  strokeDasharray={wall.island ? "7 3" : undefined}
                />
                {!wall.island && (
                  // A click on the wall opens its front view.
                  <path
                    className="plan-wall-open"
                    data-open-wall={wall.scene.wall}
                    role="button"
                    tabIndex={0}
                    aria-label={`Prikaži ${wall.name} spreda`}
                    d={`M0 0H${wall.scene.length * scale}`}
                    stroke="transparent"
                    strokeWidth={26}
                    fill="none"
                    style={{ cursor: "pointer", pointerEvents: "stroke" }}
                    onClick={() => {
                      onChooseWall(wall.scene.wall);
                      onFront();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onChooseWall(wall.scene.wall);
                        onFront();
                      }
                    }}
                  />
                )}
                <g
                  className="plan-wall-label"
                  role={wall.island ? undefined : "button"}
                  tabIndex={wall.island ? undefined : 0}
                  aria-label={wall.island ? undefined : `Izmeni dužinu ${wall.name}`}
                  onClick={wall.island ? undefined : () => onEditWall(wall.scene.wall)}
                  onKeyDown={wall.island ? undefined : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEditWall(wall.scene.wall);
                    }
                  }}
                >
                  {!wall.island && <rect x={(wall.scene.length * scale) / 2 - 60} y={-34} width={120} height={30} fill="transparent" />}
                  <text
                    data-wall-label={wall.scene.wall}
                    x={(wall.scene.length * scale) / 2}
                    y={-12}
                    fontSize={12}
                    fill="#654322"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {wall.island ? wall.name : `${wall.name} – ${wall.scene.length} mm`}
                  </text>
                </g>
                {wall.scene.objects.map((o) => (
                  <rect
                    key={o.id}
                    x={o.x * scale}
                    y={-4}
                    width={o.width * scale}
                    height={7}
                    fill={o.kind === "window" ? "#c9e2ee" : "#bcb9aa"}
                  />
                ))}
                {plan.reservations
                  .filter(
                    (r) =>
                      r.wall === wall.scene.wall &&
                      (filter === "all" || r.row === filter),
                  )
                  .map((r) => {
                    const source = offer.elements.find(
                        (e) => e.id === r.source,
                      ),
                      x =
                        (r.edge === "start" ? 0 : wall.scene.length - r.size) *
                        scale;
                    return (
                      <g
                        key={`${r.row}-${r.edge}`}
                        data-corner-reservation={r.source}
                        pointerEvents="none"
                        data-reserved-mm={r.size}
                        data-reserved-row={r.row}
                      >
                        <rect
                          x={x}
                          y={0}
                          width={r.size * scale}
                          height={(source?.width || 560) * scale}
                          fill="#b8a381"
                          fillOpacity={0.18}
                          stroke="#9c7950"
                          strokeDasharray="3 3"
                        />
                        <title>{`${r.size} mm zauzeto elementom sa ${r.sourceWall}`}</title>
                      </g>
                    );
                  })}
                {wall.entries.map(({ entry: e, x, y, width, depth: d }) => {
                  const px = x * scale,
                    py = y * scale,
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
                      data-element-wall={wall.scene.wall}
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
                        stroke={
                          active ? "#915823" : upper ? "#3774a0" : "#8b8067"
                        }
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
                      {(e.hob || e.cooktop || e.appliance === "hob") &&
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
                          transform={`rotate(${-wall.angle} ${px + w / 2} ${upper ? py + 16 : py + h - 9})`}
                        >
                          {e.code}
                        </text>
                      )}
                      {dimensions &&
                        e.row === "base" &&
                        (plan.walls.length === 1 || w >= 34) && (
                          <WidthDimension
                            x={px}
                            y={
                              plan.walls.length > 1
                                ? -48
                                : wallDepth * scale + 28
                            }
                            width={w}
                            value={e.rect.width}
                            textRotation={wall.angle === 180 ? 180 : 0}
                          />
                        )}
                    </g>
                  );
                })}
                {dimensions && plan.walls.length === 1 && (
                  <HeightDimension
                    x={-22}
                    y={0}
                    height={wallDepth * scale}
                    value={wallDepth}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {!!plan.warnings.length && (
        <details className="elevation-warnings">
          <summary>Proverite raspored ({plan.warnings.length})</summary>
          {plan.warnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </details>
      )}
    </div>
  );
}
