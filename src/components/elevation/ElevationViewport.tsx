import { useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Scan, Settings2, Maximize, X } from "lucide-react";
import {
  elevationCamera,
  toScreen,
  type ElevationScene,
} from "../../core/elevation";
import type { LayoutItem, LayoutLane, KitchenWall } from "../../core/types";
import type { DragView } from "../useLayoutDrag";
import { HeightDimension, dimensionChains } from "./Dimensions";
import WallElevation from "./WallElevation";

export default function ElevationViewport({
  scene,
  scale,
  onScale,
  selected,
  drag,
  onSelect,
  onSettings,
  fullscreen = false,
  onFullscreen,
  onCloseFullscreen,
  walls = [],
  onChooseWall,
  focusRequest = 0,
}: {
  scene: ElevationScene;
  scale: number;
  onScale: (s: number) => void;
  selected: string | null;
  drag: DragView | null;
  onSelect: (e: LayoutItem) => void;
  onSettings: () => void;
  fullscreen?: boolean;
  onFullscreen?: () => void;
  onCloseFullscreen?: () => void;
  walls?: KitchenWall[];
  onChooseWall?: (id: string) => void;
  focusRequest?: number;
}) {
  const frame = useRef<HTMLDivElement>(null),
    anchor = useRef<{ x: number; y: number; px?: number; py?: number } | null>(
      null,
    ),
    viewRoot = useRef<HTMLDivElement>(null),
    lastPinch = useRef(0);
  const [box, setBox] = useState({ width: 320, maxHeight: 420 }),
    [zoom, setZoom] = useState(1),
    [fitRequest, setFitRequest] = useState(0);
  const [showDimensions, setShowDimensions] = useState(false);
  const [pan, setPan] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () =>
      setBox((previous) => {
        const width = node.clientWidth,
          maxHeight = fullscreen
            ? viewRoot.current!.clientHeight
            : Math.max(
                300,
                Math.min(480, Math.round(window.innerHeight * 0.52)),
              );
        return previous.width === width && previous.maxHeight === maxHeight
          ? previous
          : { width, maxHeight };
      });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (viewRoot.current) observer.observe(viewRoot.current);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fullscreen]);
  useLayoutEffect(() => {
    anchor.current = null;
    setZoom(1);
    setFitRequest((n) => n + 1);
  }, [fullscreen]);
  const fittedCamera = elevationCamera(
      scene,
      box.width,
      box.maxHeight,
      zoom,
      fullscreen,
    ),
    dimensionSpace = showDimensions
      ? Math.max(0, dimensionChains(scene, fittedCamera.scale).totalY + 20 - 64)
      : 0,
    camera = {
      ...fittedCamera,
      canvasHeight: fittedCamera.canvasHeight + dimensionSpace,
      viewportHeight: fullscreen
        ? fittedCamera.viewportHeight
        : fittedCamera.viewportHeight + dimensionSpace,
    },
    actual = camera.scale,
    { margin } = camera;
  useLayoutEffect(() => onScale(actual), [actual, onScale]);
  const focusEntry = scene.entries.find((e) => e.id === selected);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const center = anchor.current;
    anchor.current = null;
    node.scrollLeft = center
      ? margin.left + center.x * actual - (center.px ?? box.width / 2)
      : camera.focusLeft;
    node.scrollTop = center
      ? margin.top +
        (scene.height - center.y) * actual -
        (center.py ?? camera.viewportHeight / 2)
      : camera.focusTop;
    setPan({ left: node.scrollLeft, top: node.scrollTop });
  }, [
    actual,
    scene.wall,
    scene.height,
    camera.bounds.x,
    camera.bounds.y,
    camera.bounds.width,
    camera.bounds.height,
    camera.focusLeft,
    camera.focusTop,
    camera.viewportHeight,
    box.width,
    margin.left,
    margin.top,
    fitRequest,
  ]);
  useLayoutEffect(() => {
    const node = frame.current,
      entry = focusEntry;
    if (!node || !entry || !focusRequest) return;
    const r = toScreen(
      entry.visible[0] || entry.rect,
      actual,
      scene.height,
      margin,
    );
    if (
      r.x < node.scrollLeft + 27 ||
      r.x + r.width > node.scrollLeft + box.width - 8
    )
      node.scrollLeft = r.x + r.width / 2 - box.width / 2;
    if (
      r.y < node.scrollTop + (fullscreen ? 96 : 32) ||
      r.y + r.height > node.scrollTop + camera.viewportHeight - 40
    )
      node.scrollTop =
        r.y +
        r.height / 2 -
        (camera.viewportHeight + margin.top - (fullscreen ? 40 : 64)) / 2;
    setPan({ left: node.scrollLeft, top: node.scrollTop });
  }, [
    focusRequest,
    selected,
    box.width,
    box.maxHeight,
    focusEntry?.rect.x,
    focusEntry?.rect.y,
    focusEntry?.rect.width,
    focusEntry?.rect.height,
  ]);
  const latest = useRef({ camera, scene, zoom });
  latest.current = { camera, scene, zoom };
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    let pinch: { distance: number; zoom: number; x: number; y: number } | null =
      null;
    const points = (e: TouchEvent) => {
      const a = e.touches[0],
        b = e.touches[1],
        r = node.getBoundingClientRect();
      return {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        px: (a.clientX + b.clientX) / 2 - r.left,
        py: (a.clientY + b.clientY) / 2 - r.top,
      };
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const p = points(e),
        { camera: c, scene: s, zoom: z } = latest.current;
      pinch = {
        distance: p.distance,
        zoom: z,
        x: (node.scrollLeft + p.px - c.margin.left) / c.scale,
        y: s.height - (node.scrollTop + p.py - c.margin.top) / c.scale,
      };
      lastPinch.current = performance.now();
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const p = points(e),
        c = latest.current.camera;
      anchor.current = { x: pinch.x, y: pinch.y, px: p.px, py: p.py };
      setZoom(
        Math.max(
          0.5,
          Math.min(
            0.65 / c.fitted,
            (pinch.zoom * p.distance) / Math.max(1, pinch.distance),
          ),
        ),
      );
      lastPinch.current = performance.now();
    };
    const end = (e: TouchEvent) => {
      if (!pinch) return;
      if (e.cancelable) e.preventDefault();
      lastPinch.current = performance.now();
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
  function zoomBy(factor: number) {
    const node = frame.current;
    if (node)
      anchor.current = {
        x: (node.scrollLeft + box.width / 2 - margin.left) / actual,
        y:
          scene.height -
          (node.scrollTop + camera.viewportHeight / 2 - margin.top) / actual,
      };
    setZoom((z) => Math.max(0.5, Math.min(0.65 / camera.fitted, z * factor)));
  }
  const floor = margin.top + scene.height * actual,
    baseTop = margin.top + (scene.height - scene.baseTop) * actual,
    wallBottom = margin.top + (scene.height - scene.upperBottom) * actual;
  const roomTop =
      margin.top + (scene.height - scene.roomHeight) * actual - pan.top,
    roomBottom = floor - pan.top,
    dimensionTop = Math.max(fullscreen ? 102 : 42, roomTop),
    dimensionBottom = Math.min(camera.viewportHeight - 52, roomBottom);
  return (
    <div className="elevation-view" ref={viewRoot}>
      <div className="elevation-toolbar">
        <div>
          {fullscreen && (
            <button
              className="icon-btn"
              aria-label="Zatvori prikaz preko celog ekrana"
              onClick={onCloseFullscreen}
            >
              <X size={21} />
            </button>
          )}
          <button
            className="icon-btn"
            aria-label="Umanji 2D prikaz"
            disabled={zoom <= 0.5}
            onClick={() => zoomBy(1 / 1.3)}
          >
            <Minus size={20} />
          </button>
          <button
            className="icon-btn"
            aria-label="Uvećaj 2D prikaz"
            disabled={actual >= 0.65}
            onClick={() => zoomBy(1.3)}
          >
            <Plus size={20} />
          </button>
          <button
            className="text-btn"
            onClick={() => {
              anchor.current = null;
              setZoom(1);
              setFitRequest((n) => n + 1);
            }}
          >
            <Scan size={18} /> Uklopi
          </button>
        </div>
        <button
          type="button"
          className="text-btn dimension-toggle"
          aria-pressed={showDimensions}
          onClick={() => setShowDimensions((value) => !value)}
        >
          Kote
        </button>
        {fullscreen ? (
          walls.length > 1 && (
            <select
              className="fullscreen-wall-select"
              aria-label="Zid u celom ekranu"
              value={scene.wall}
              onChange={(e) => onChooseWall?.(e.target.value)}
            >
              {walls.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )
        ) : (
          <div className="elevation-toolbar-extra">
            <button
              className="icon-btn"
              aria-label="Prikaz preko celog ekrana"
              onClick={onFullscreen}
            >
              <Maximize size={21} />
            </button>
            <button
              className="icon-btn"
              aria-label="Otvori i mere 2D prikaza"
              onClick={onSettings}
            >
              <Settings2 size={21} />
            </button>
          </div>
        )}
        <span className="elevation-free-space">
          Slobodno: donji{" "}
          {Math.max(
            0,
            scene.length -
              Math.max(
                0,
                ...scene.entries
                  .filter((e) => e.row === "base")
                  .map((e) => e.rect.x + e.rect.width),
              ),
          )}{" "}
          mm · viseći{" "}
          {Math.max(
            0,
            scene.length -
              Math.max(
                0,
                ...scene.entries
                  .filter((e) => e.row === "wall")
                  .map((e) => e.rect.x + e.rect.width),
              ),
          )}{" "}
          mm
        </span>
      </div>
      <div
        className="elevation-frame"
        style={{ height: camera.viewportHeight }}
        data-focus-height={camera.bounds.height}
      >
        <div
          ref={frame}
          className="schematic-scroll elevation-scroll"
          onScroll={(e) =>
            setPan({
              left: e.currentTarget.scrollLeft,
              top: e.currentTarget.scrollTop,
            })
          }
        >
          <div
            className="elevation-canvas"
            style={{ width: camera.canvasWidth, height: camera.canvasHeight }}
          >
            <WallElevation
              scene={scene}
              scale={actual}
              selected={selected}
              dragId={drag?.id}
              margin={margin}
              canvasSize={{
                width: camera.canvasWidth,
                height: camera.canvasHeight,
              }}
              rulers={false}
              showDimensions={showDimensions}
            />
            {(["wall", "base", "extra"] as LayoutLane[]).map((row) => {
              const emptyUpper =
                row === "wall" && !scene.entries.some((e) => e.row === "wall");
              // Drop geometry shares the exact origin and scale of the SVG, including camera panning.
              const top =
                emptyUpper && drag
                  ? pan.top + (fullscreen ? 50 : 0)
                  : row === "wall"
                    ? Math.min(margin.top, wallBottom - 44)
                    : row === "base"
                      ? Math.max(wallBottom + 4, baseTop - 10)
                      : camera.canvasHeight - 36;
              const rowHeight =
                emptyUpper && drag
                  ? fullscreen
                    ? 20
                    : 30
                  : row === "wall"
                    ? Math.max(44, wallBottom - top)
                    : row === "base"
                      ? floor - top + 8
                      : 28;
              return (
                <div
                  key={row}
                  className={`elevation-hit-row ${row}`}
                  data-drop-row={row}
                  data-drop-wall={scene.wall}
                  style={{
                    left: margin.left,
                    top,
                    width: scene.extent * actual,
                    height: rowHeight,
                    zIndex: emptyUpper && drag ? 4 : undefined,
                  }}
                >
                  {emptyUpper && drag && (
                    <span className="elevation-drop-caption">Viseći red</span>
                  )}
                  {scene.entries
                    .filter((e) => e.row === row)
                    .flatMap((e) => {
                      const pieces = e.visible.length
                        ? e.visible
                        : [
                            {
                              ...e.rect,
                              height: Math.min(300, e.rect.height),
                              y: e.rect.y + e.rect.height,
                            },
                          ];
                      return pieces.map((v, i) => {
                        const r = toScreen(v, actual, scene.height, margin);
                        return (
                          <button
                            key={`${e.key}-${i}`}
                            className={`elevation-hit ${e.item.kind === "spacer" ? "spacer" : ""} ${e.rect.x + e.rect.width > scene.length ? "out-of-bounds" : ""}`}
                            data-layout-id={e.id}
                            data-element-id={e.id}
                            data-width={e.item.width}
                            data-offset={e.rect.x}
                            aria-pressed={selected === e.id}
                            aria-label={`${e.code}, širina ${e.rect.width} mm, visina ${e.rect.height} mm. Opcije elementa`}
                            style={{
                              left: r.x - margin.left,
                              top: r.y - top,
                              width: Math.max(12, r.width),
                              height: Math.max(12, r.height),
                            }}
                            onContextMenu={(ev) => ev.preventDefault()}
                            onClick={() => {
                              if (
                                !lastPinch.current ||
                                performance.now() - lastPinch.current > 400
                              )
                                onSelect(e.item);
                            }}
                          />
                        );
                      });
                    })}
                  {drag?.target?.wall === scene.wall &&
                    drag.target.row === row && (
                      <div
                        className={`drop-marker ${!drag.target.compatible || drag.target.overrun ? "invalid" : ""}`}
                        data-testid="drop-marker"
                        style={{ left: drag.target.offset * scale }}
                      />
                    )}
                </div>
              );
            })}
          </div>
        </div>
        <svg
          className="elevation-rulers"
          width="100%"
          height="100%"
          aria-label={`Visina prostorije ${scene.roomHeight} mm`}
        >
          {showDimensions && (
            <>
              <rect width={27} height="100%" fill="white" />
              {dimensionBottom > dimensionTop && (
                <HeightDimension
                  x={20}
                  y={dimensionTop}
                  height={dimensionBottom - dimensionTop}
                  value={scene.roomHeight}
                  broken={
                    roomTop < 42 || roomBottom > camera.viewportHeight - 52
                  }
                />
              )}
            </>
          )}
        </svg>
      </div>
      {fullscreen && box.width < box.maxHeight && (
        <p className="fullscreen-rotate-hint">Okrenite telefon horizontalno</p>
      )}
      <p className="elevation-hint">
        Dodirom izaberite element. Dugi pritisak za prevlačenje.
      </p>
      {!!scene.warnings.length && (
        <details className="elevation-warnings">
          <summary>Proverite raspored ({scene.warnings.length})</summary>
          {scene.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      )}
    </div>
  );
}
