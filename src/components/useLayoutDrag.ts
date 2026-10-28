import { useEffect, useRef, useState, type RefObject } from "react";
import type { LayoutLane, Offer } from "../core/types";
import {
  allLayoutItems,
  canPlace,
  orderedLane,
  placeAt,
  span,
  relocateItem,
  wallUsage,
} from "../core/layout";

/** Elements are placed on a 5 cm grid. */
const GRID = 50;
export interface DropTarget {
  wall: string;
  row: LayoutLane;
  index: number;
  offset: number;
  compatible: boolean;
  overrun: number;
  /** Free position (mm from the wall start) when the element lands in an empty place. */
  free?: number;
}
export interface DragView {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  target: DropTarget | null;
}
interface Candidate {
  id: string;
  x: number;
  y: number;
  pointer: number;
  touch: boolean;
  width: number;
  height: number;
  /** Where inside the grabbed card the pointer is (px), so the drop keeps the card under the finger. */
  grab: number;
}
export default function useLayoutDrag({
  root,
  offer,
  scale,
  onDrop,
  onHoverWall,
  onFinish,
  onInvalid,
}: {
  root: RefObject<HTMLDivElement | null>;
  offer: Offer;
  scale: number;
  onDrop: (id: string, target: DropTarget) => void;
  onHoverWall: (wall: string) => void;
  onFinish: () => void;
  onInvalid: (text: string) => void;
}) {
  const [drag, setDrag] = useState<DragView | null>(null),
    latest = useRef({ offer, scale, onDrop, onHoverWall, onFinish, onInvalid });
  latest.current = { offer, scale, onDrop, onHoverWall, onFinish, onInvalid };
  const suppressed = useRef(0);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let pending: Candidate | null = null,
      active: DragView | null = null,
      timer: ReturnType<typeof setTimeout> | null = null,
      hoverTimer: ReturnType<typeof setTimeout> | null = null,
      hoverWall = "",
      frame = 0;
    let sourceNode: HTMLElement | null = null;
    const detachedMove = (e: TouchEvent) => {
      if (!sourceNode?.isConnected) touchMove(e);
    };
    const detachedEnd = (e: TouchEvent) => {
      if (!sourceNode?.isConnected) touchEnd(e);
    };
    const detachedCancel = () => {
      if (!sourceNode?.isConnected) finish(false);
    };
    const releaseSource = () => {
      sourceNode?.removeEventListener("touchmove", detachedMove);
      sourceNode?.removeEventListener("touchend", detachedEnd);
      sourceNode?.removeEventListener("touchcancel", detachedCancel);
      sourceNode = null;
    };
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const targetAt = (x: number, y: number): DropTarget | null => {
      const node = document.elementFromPoint(x, y) as HTMLElement | null,
        wallTab = node?.closest<HTMLElement>("[data-wall-target]");
      if (wallTab) {
        const wall = wallTab.dataset.wallTarget!;
        if (hoverWall !== wall) {
          if (hoverTimer) clearTimeout(hoverTimer);
          hoverWall = wall;
          hoverTimer = setTimeout(() => {
            latest.current.onHoverWall(wall);
          }, 350);
        }
        return null;
      }
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverWall = "";
      const row = node?.closest<HTMLElement>("[data-drop-row]");
      if (!row || !element.contains(row) || !pending) return null;
      const wall = row.dataset.dropWall!,
        lane = row.dataset.dropRow as LayoutLane,
        { offer, scale } = latest.current,
        source = allLayoutItems(offer.elements, offer.layout).find(
          (e) => e.id === pending!.id,
        );
      if (!source) return null;
      const list = orderedLane(offer.elements, offer.layout, wall, lane).filter(
          (e) => e.id !== source.id,
        ),
        at = Math.max(0, (x - row.getBoundingClientRect().left) / scale);
      // Free placement on the 5 cm grid, when the wanted place is empty (or only slightly occupied).
      const want =
        Math.round(
          ((x - row.getBoundingClientRect().left - pending.grab) / scale) / GRID,
        ) * GRID;
      const free = placeAt(
        offer.elements,
        offer.layout!,
        source.id,
        wall,
        lane,
        want,
        offer.elevation,
      );
      if (!("error" in free)) {
        const items = allLayoutItems(free.elements, free.layout),
          wallLength =
            free.layout.walls.find((w) => w.id === wall)?.length || 0,
          usage = wallUsage(
            free.elements,
            free.layout.walls.find((w) => w.id === wall)!,
            free.layout,
          ),
          placed = items.find((e) => e.id === source.id)!;
        return {
          wall,
          row: lane,
          index: placed.placement?.order ?? 0,
          offset: free.offset,
          compatible: true,
          overrun: Math.max(0, Math.max(usage.base, usage.upper) - wallLength),
          free: want,
        };
      }
      let offset = 0,
        index = 0;
      for (const item of list) {
        if (at < (item.placement?.offset || 0) + span(item) / 2) break;
        index++;
      }
      offset =
        index < list.length
          ? list[index].placement?.offset || 0
          : list.length
            ? (list[list.length - 1].placement?.offset || 0) +
              span(list[list.length - 1])
            : 0;
      const moved = relocateItem(
          offer.elements,
          offer.layout!,
          source.id,
          wall,
          lane,
          index,
          offer.elevation,
        ),
        wallLength =
          offer.layout!.walls.find((w) => w.id === wall)?.length || 0,
        usage =
          moved &&
          wallUsage(
            moved.elements,
            moved.layout.walls.find((w) => w.id === wall)!,
            moved.layout,
          ),
        length = usage
          ? Math.max(usage.base, usage.upper)
          : list.reduce((a, e) => a + span(e), 0) + span(source);
      if (moved)
        offset =
          allLayoutItems(moved.elements, moved.layout).find(
            (e) => e.id === source.id,
          )?.placement?.offset ?? offset;
      return {
        wall,
        row: lane,
        index,
        offset,
        compatible: canPlace(source, lane),
        overrun: Math.max(0, length - wallLength),
      };
    };
    const paint = (x: number, y: number) => {
      if (!active) return;
      active = { ...active, x, y, target: targetAt(x, y) };
      setDrag(active);
    };
    const tick = () => {
      if (!active) return;
      const scroll = element.querySelector<HTMLElement>(".schematic-scroll");
      if (scroll) {
        const rect = scroll.getBoundingClientRect();
        if (active.y >= rect.top && active.y <= rect.bottom) {
          const delta =
            active.x < rect.left + 26 ? -9 : active.x > rect.right - 26 ? 9 : 0;
          if (delta) {
            const before = scroll.scrollLeft;
            scroll.scrollLeft += delta;
            if (before !== scroll.scrollLeft) paint(active.x, active.y);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const activate = () => {
      if (!pending) return;
      clearTimer();
      active = { ...pending, target: targetAt(pending.x, pending.y) };
      suppressed.current = performance.now() + 1200;
      document.documentElement.classList.add("layout-dragging");
      setDrag(active);
      frame = requestAnimationFrame(tick);
    };
    const cleanup = () => {
      clearTimer();
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = null;
      hoverWall = "";
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("layout-dragging");
      releaseSource();
      pending = null;
      active = null;
      setDrag(null);
      latest.current.onFinish();
    };
    const start = (
      target: EventTarget | null,
      x: number,
      y: number,
      pointer: number,
      touch: boolean,
    ) => {
      suppressed.current = 0;
      const card = (target as HTMLElement)?.closest<HTMLElement>(
        "[data-layout-id]",
      );
      if (!card || !element.contains(card)) return;
      releaseSource();
      sourceNode = card;
      if (touch) {
        card.addEventListener("touchmove", detachedMove, { passive: false });
        card.addEventListener("touchend", detachedEnd, { passive: false });
        card.addEventListener("touchcancel", detachedCancel);
      }
      const rect = card.getBoundingClientRect();
      pending = {
        id: card.dataset.layoutId!,
        x,
        y,
        pointer,
        touch,
        width: rect.width,
        height: rect.height,
        grab: x - rect.left,
      };
      if (touch) timer = setTimeout(activate, 450);
    };
    const move = (x: number, y: number, touch: boolean, event: Event) => {
      if (!pending) return;
      const distance = Math.hypot(x - pending.x, y - pending.y);
      if (!active) {
        if (touch && distance > 8) {
          clearTimer();
          pending = null;
          return;
        }
        if (!touch && distance > 5) activate();
      }
      if (active) {
        if (event.cancelable) event.preventDefault();
        paint(x, y);
      }
    };
    const finish = (commit: boolean) => {
      if (active) {
        suppressed.current = performance.now() + 700;
        const target = active.target;
        if (commit && target?.compatible)
          latest.current.onDrop(active.id, target);
        else if (commit && target)
          latest.current.onInvalid(
            "Element nije kompatibilan sa izabranim redom.",
          );
      }
      cleanup();
    };
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        finish(false);
        return;
      }
      const t = e.touches[0];
      start(e.target, t.clientX, t.clientY, t.identifier, true);
    };
    const touchMove = (e: TouchEvent) => {
      if (!pending?.touch) return;
      const t = Array.from(e.touches).find(
        (t) => t.identifier === pending!.pointer,
      );
      if (t) move(t.clientX, t.clientY, true, e);
    };
    const touchEnd = (e: TouchEvent) => {
      if (!pending?.touch) return;
      if (active && e.cancelable) e.preventDefault();
      finish(true);
    };
    const touchCancel = () => finish(false);
    const pointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.button === 0)
        start(e.target, e.clientX, e.clientY, e.pointerId, false);
    };
    const pointerMove = (e: PointerEvent) => {
      if (pending && !pending.touch && pending.pointer === e.pointerId)
        move(e.clientX, e.clientY, false, e);
    };
    const pointerUp = (e: PointerEvent) => {
      if (pending && !pending.touch && pending.pointer === e.pointerId)
        finish(true);
    };
    const pointerCancel = (e: PointerEvent) => {
      if (pending && !pending.touch && pending.pointer === e.pointerId)
        finish(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pending) finish(false);
    };
    element.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd, { passive: false });
    window.addEventListener("touchcancel", touchCancel);
    element.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", touchCancel);
    return () => {
      cleanup();
      element.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchCancel);
      element.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", touchCancel);
    };
  }, [root]);
  return { drag, canOpen: () => performance.now() > suppressed.current };
}
