import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DoorClosed, DoorOpen, LocateFixed, Maximize, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBB } from "three/examples/jsm/math/OBB.js";
import { kitchenPlan, type PlanWall } from "../../core/top-view";
import { isBridge, isSpacer, rowOf } from "../../core/layout";
import { hoodDrop, type ElevationEntry } from "../../core/elevation";
import { tileById } from "../../core/tiles";
import { tileImage } from "./tileTexture";
import { applianceStyle, golaHex } from "../../core/appearance";
import { OVEN_HEIGHT } from "../../core/construction";
import { isFreestanding, templates } from "../../core/catalog";
import type { LayoutItem, Offer } from "../../core/types";

/** Simple 3D simulation of the kitchen: the same plan and heights as the 2D views, in millimetres. */
const MM = 0.001;
const FRONT = 18;
const GAP = 3;

/** Library items drawn from artwork in 2D have no appliance flag; recognise them by name. */
function applianceOf(e: ElevationEntry) {
  if (e.appliance !== "none" || isSpacer(e.item)) return e.appliance;
  const kind = e.item.kind;
  if (!kind.startsWith("reference")) return "none";
  const name = templates.find((t) => t.kind === kind)?.name ?? "";
  if (/kolonac|podignuta/i.test(name)) return "none";
  if (/frižider/i.test(name)) return "fridge";
  if (/sudomašin/i.test(name)) return "dishwasher";
  if (/rerna/i.test(name)) return "oven";
  return "none";
}

/** A door, drawer or lift-up front that can be opened in the 3D view (white goods stay closed). */
export interface Mover {
  pivot: THREE.Group;
  home: THREE.Vector3;
  kind: "door" | "drawer" | "lift";
  /** Which way a hinged door swings: -1 for a left hinge, 1 for a right hinge. */
  sign: number;
  /** Drawer travel in mm. */
  travel: number;
  /** Current and wanted opening, 0 (closed) to 1 (open). */
  t: number;
  target: number;
}

export function poseMover(m: Mover) {
  if (m.kind === "drawer") m.pivot.position.z = m.home.z + m.travel * m.t * MM;
  else if (m.kind === "lift") m.pivot.rotation.x = -1.9 * m.t;
  else m.pivot.rotation.y = m.sign * 1.75 * m.t;
}

const obbOf = (mesh: THREE.Mesh) => {
  mesh.geometry.boundingBox ??= (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
  const obb = new OBB().fromBox3(mesh.geometry.boundingBox!);
  obb.applyMatrix4(mesh.matrixWorld);
  // A hair smaller, so surfaces that only touch do not count as a hit.
  obb.halfSize.set(
    Math.max(0.0005, obb.halfSize.x - 0.002),
    Math.max(0.0005, obb.halfSize.y - 0.002),
    Math.max(0.0005, obb.halfSize.z - 0.002),
  );
  return obb;
};

/** Opens and closes the fronts step by step; an opening front stops where it meets another element. */
export function createMoverStepper(built: { root: THREE.Object3D; movers: Mover[] }) {
  built.root.updateMatrixWorld(true);
  const inMover = (o: THREE.Object3D) => {
    for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n.userData.mover) return true;
    return false;
  };
  const obstacles: { mesh: THREE.Mesh; item: unknown; moving: boolean; box: THREE.Box3 }[] = [];
  built.root.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.userData.item || o.userData.obstacle))
      obstacles.push({
        mesh: o,
        item: o.userData.item ?? "room",
        moving: inMover(o),
        box: new THREE.Box3().setFromObject(o),
      });
  });
  const blocked = (m: Mover) => {
    m.pivot.updateMatrixWorld(true);
    const mine: THREE.Mesh[] = [];
    m.pivot.traverse((o) => o instanceof THREE.Mesh && mine.push(o));
    const item = mine[0]?.userData.item;
    for (const a of mine) {
      const box = new THREE.Box3().setFromObject(a);
      let own: OBB | null = null;
      for (const o of obstacles) {
        if (o.item === item) continue;
        if (!box.intersectsBox(o.moving ? new THREE.Box3().setFromObject(o.mesh) : o.box)) continue;
        own ??= obbOf(a);
        if (own.intersectsOBB(obbOf(o.mesh))) return true;
      }
    }
    return false;
  };
  const step = (m: Mover) => {
    const from = m.t;
    let to = from + (m.target - from) * 0.18;
    if (Math.abs(m.target - to) <= 0.002) to = m.target;
    if (to === from) return;
    m.t = to;
    poseMover(m);
    if (to > from && blocked(m)) {
      let lo = from,
        hi = to;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        m.t = mid;
        poseMover(m);
        if (blocked(m)) hi = mid;
        else lo = mid;
      }
      m.t = lo;
      m.target = lo;
      poseMover(m);
    }
  };
  return () => built.movers.forEach(step);
}

function color(value: string | undefined, fallback: string) {
  return new THREE.Color(
    value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback,
  );
}

export function buildScene(offer: Offer) {
  const plan = kitchenPlan(offer, "all");
  const root = new THREE.Group();
  const movers: Mover[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (
    c: THREE.Color,
    opts: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => {
    const key = c.getHexString() + JSON.stringify(opts);
    let m = materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.75,
        ...opts,
      });
      materials.set(key, m);
    }
    return m;
  };
  const box = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    item?: LayoutItem,
    obstacle = false,
  ) => {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * MM, h * MM, d * MM),
      material,
    );
    // x along the wall, y up from the floor, z from the wall into the room (all mm, box corner).
    mesh.position.set((x + w / 2) * MM, (y + h / 2) * MM, (z + d / 2) * MM);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (item) mesh.userData.item = item;
    if (obstacle) mesh.userData.obstacle = true;
    parent.add(mesh);
  };
  const wallTile = tileById(offer.selection.wallTile),
    floorTile = tileById(offer.selection.floorTile);
  /** Tile pattern repeated over a surface of the given real size (mm); null without a tile or a canvas. */
  const tiledMaterial = (
    tile: ReturnType<typeof tileById>,
    width: number,
    height: number,
  ) => {
    const image = tile ? tileImage(tile) : null;
    if (!tile || !image) return null;
    const texture = new THREE.CanvasTexture(image.canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.repeat.set(width / image.cellWidth, height / image.cellHeight);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: tile.area === "floor" ? 0.55 : 0.4,
    });
    materials.set(`tile-${tile.id}-${materials.size}`, material);
    return material;
  };
  const handleMat = mat(new THREE.Color("#2d2f2c"), {
    roughness: 0.35,
    metalness: 0.6,
  });
  const wireMat = mat(new THREE.Color("#c3c8cc"), { roughness: 0.3, metalness: 0.8 });
  const steelMat = mat(new THREE.Color("#b6bcc0"), { roughness: 0.3, metalness: 0.8 });
  const dark = mat(new THREE.Color("#1f2223"), { roughness: 0.25 });
  const glass = mat(new THREE.Color("#bcd8e6"), {
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
  });

  const frontPanels = (
    g: THREE.Group,
    e: ElevationEntry,
    x: number,
    y: number,
    w: number,
    h: number,
    zFront: number,
    front: THREE.Material,
    depth: number,
    inner: THREE.Material,
  ) => {
    const item = e.item as Exclude<LayoutItem, { kind: "spacer" }>;
    const upper = e.row === "wall" || isBridge(item);
    const handles = e.opening === "handles";
    const gola = e.opening === "gola";
    const top = gola ? 30 : 0;
    const golaMat = mat(new THREE.Color(golaHex(e.golaColor)), {
      roughness: 0.4,
      metalness: 0.5,
    });
    const lifting = ["lift", "liftDouble", "liftFolding"].includes(item.kind);
    const panel = (
      px: number,
      py: number,
      pw: number,
      ph: number,
      drawer: boolean,
      hingeRight: boolean,
      wire = false,
    ) => {
      const lift = !drawer && lifting,
        ox = !drawer && !lift && hingeRight ? px + pw : px,
        oy = lift ? py + ph : py;
      const pivot = new THREE.Group();
      pivot.position.set(ox * MM, oy * MM, (zFront + FRONT) * MM);
      g.add(pivot);
      const mover: Mover = {
        pivot,
        home: pivot.position.clone(),
        kind: drawer ? "drawer" : lift ? "lift" : "door",
        sign: hingeRight ? 1 : -1,
        travel: Math.max(0, Math.min(400, depth - 60)),
        t: 0,
        target: 0,
      };
      pivot.userData.mover = mover;
      movers.push(mover);
      const b = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        material: THREE.Material,
      ) => box(pivot, x - ox, y - oy, z - zFront - FRONT, w, h, d, material, item);
      b(px, py, zFront, pw, ph, FRONT, item.visual?.glass ? glass : front);
      if (wire && depth > 150) {
        // Wire baskets on the pull-out frame: they slide out together with the front.
        const inset = 30,
          wx0 = px + inset,
          ww = pw - 2 * inset,
          z1 = zFront - 30,
          z0 = zFront - depth + 40,
          len = z1 - z0,
          t = 5,
          rim = 110,
          count = ph > 1500 ? 5 : ph > 600 ? 2 : 1,
          step = count > 1 ? (ph - 80 - rim) / (count - 1) : 0;
        for (let i = 0; i < count; i++) {
          const ly = count > 1 ? py + 40 + i * step : py + (ph - rim) / 2;
          const rails = Math.max(2, Math.round(ww / 45) + 1),
            cross = Math.max(2, Math.round(len / 60) + 1);
          for (let r = 0; r < rails; r++)
            b(wx0 + ((ww - t) * r) / (rails - 1), ly, z0, t, t, len, wireMat);
          for (let c = 0; c < cross; c++)
            b(wx0, ly, z0 + ((len - t) * c) / (cross - 1), ww, t, t, wireMat);
          for (const [cx, cz] of [
            [wx0, z0],
            [wx0 + ww - t, z0],
            [wx0, z1 - t],
            [wx0 + ww - t, z1 - t],
          ])
            b(cx, ly, cz, t, rim, t, wireMat);
          b(wx0, ly + rim, z0, ww, t, t, wireMat);
          b(wx0, ly + rim, z1 - t, ww, t, t, wireMat);
          for (const sx of [wx0, wx0 + ww - t]) {
            b(sx, ly + rim, z0, t, t, len, wireMat);
            b(sx, ly + rim / 2, z0, t, t, len, wireMat);
          }
        }
      } else if (drawer && depth > 150 && ph > 90) {
        // The drawer box slides out together with its front.
        const tw = pw - 60,
          td = depth - 40,
          th = Math.min(ph - 70, 160),
          tx = px + 30;
        b(tx, py + 25, zFront - td, tw, 10, td, inner);
        b(tx, py + 35, zFront - td, 12, th, td, inner);
        b(tx + tw - 12, py + 35, zFront - td, 12, th, td, inner);
        b(tx, py + 35, zFront - td, tw, th, 12, inner);
      }
      if (!handles) return;
      if (drawer)
        b(px + pw / 2 - 64, py + ph - 45, zFront + FRONT, 128, 12, 14, handleMat);
      else if (lifting)
        // Lift-up fronts are opened from the bottom edge, so the handle is horizontal.
        b(px + pw / 2 - 64, py + 8, zFront + FRONT, 128, 12, 14, handleMat);
      else {
        const hx = hingeRight ? px + 40 : px + pw - 52;
        const hy = upper ? py + 40 : py + ph - 200;
        b(hx, hy, zFront + FRONT, 12, 160, 14, handleMat);
      }
    };
    const appliance = applianceOf(e);
    if (appliance === "oven") {
      if (item.kind === "oven") {
        // 600 mm oven on top, one drawer below it.
        const drawerH = h - OVEN_HEIGHT;
        const st = applianceStyle(e.applianceColor),
          bodyMat = mat(new THREE.Color(st.body), { roughness: 0.4, metalness: 0.3 });
        box(g, x, y + drawerH, zFront, w, OVEN_HEIGHT, FRONT, bodyMat, item);
        // Dark oven window and a handle bar above it.
        box(g, x + w * 0.09, y + drawerH + OVEN_HEIGHT * 0.13, zFront + FRONT, w * 0.82, OVEN_HEIGHT * 0.63, 3, dark, item);
        box(g, x + w * 0.12, y + drawerH + OVEN_HEIGHT * 0.81, zFront + FRONT, w * 0.76, 10, 14, mat(new THREE.Color(st.detail)), item);
        panel(x, y, w, drawerH - GAP - top, true, false);
        if (gola)
          box(g, x, y + drawerH - GAP - top, zFront, w, top, FRONT * 0.6, golaMat, item);
      } else
        box(
          g,
          x,
          y,
          zFront,
          w,
          h,
          FRONT,
          mat(new THREE.Color(applianceStyle(e.applianceColor).body), { roughness: 0.4, metalness: 0.3 }),
          item,
        );
      return;
    }
    if (appliance === "fridge" || appliance === "dishwasher") {
      // Same look as the front view: light steel doors with long vertical handles.
      const st = applianceStyle(e.applianceColor),
        steel = mat(new THREE.Color(st.body), {
          roughness: 0.4,
          metalness: 0.2,
        }),
        grip = mat(new THREE.Color(st.detail), { roughness: 0.35, metalness: 0.6 });
      if (appliance === "dishwasher") {
        // Dishwasher: steel door under a dark control strip with lights, a horizontal handle
        // (a recessed slot when the kitchen has no handles) and a vent at the bottom.
        const strip = 90,
          dark = mat(new THREE.Color("#2a2e30"), { roughness: 0.25, metalness: 0.4 }),
          light = mat(new THREE.Color("#8fd6ff"), { roughness: 0.2 });
        box(g, x, y, zFront, w, h - strip - GAP, FRONT, steel, item);
        box(g, x, y + h - strip, zFront, w, strip, FRONT, dark, item);
        for (let i = 0; i < 4; i++)
          box(g, x + w * 0.62 + i * Math.min(40, w * 0.07), y + h - strip + 38, zFront + FRONT, 14, 14, 2, light, item);
        box(g, x + w * 0.08, y + h - strip + 30, zFront + FRONT, w * 0.26, 28, 2, mat(new THREE.Color("#3d4244")), item);
        if (handles)
          box(g, x + w * 0.2, y + h - strip - 70, zFront + FRONT, w * 0.6, 14, 20, grip, item);
        else box(g, x + w * 0.2, y + h - strip - 55, zFront + FRONT, w * 0.6, 10, 2, dark, item);
        box(g, x + w * 0.1, y + 22, zFront + FRONT, w * 0.8, 6, 2, dark, item);
        box(g, x + w * 0.1, y + 44, zFront + FRONT, w * 0.8, 6, 2, dark, item);
        return;
      }
      // Under-counter fridges have a single door; tall ones a freezer door below.
      const fridge = appliance === "fridge" && h > 1200,
        lower = fridge ? Math.round(h * 0.36) : h;
      box(g, x, y, zFront, w, lower - (fridge ? GAP : 0), FRONT, steel, item);
      if (fridge) box(g, x, y + lower, zFront, w, h - lower, FRONT, steel, item);
      if (handles) {
        const hx = x + w - 52;
        if (fridge) {
          box(g, hx, y + lower - 190, zFront + FRONT, 12, 160, 14, grip, item);
          box(g, hx, y + lower + 40, zFront + FRONT, 12, 160, 14, grip, item);
        } else
          box(g, x + w / 2 - 64, y + h - 45, zFront + FRONT, 128, 12, 14, grip, item);
      }
      return;
    }
    const blind =
      item.kind === "reference014" ? 550 : item.kind === "reference035" ? 360 : 0;
    if (blind && w > blind + 150) {
      // Blind corner: a door on the open side, a 50 mm mask, the blind part behind the next wall.
      panel(x, y, w - blind, h - top, false, true);
      box(g, x + w - blind, y, zFront, 50, h - top, FRONT, front, item);
      if (gola) box(g, x, y + h - top, zFront, w - blind + 50, top, FRONT * 0.6, golaMat, item);
      return;
    }
    if (["reference020", "reference026", "reference066"].includes(item.kind)) {
      // Pull-out with wire baskets: one front and a wire frame behind it.
      panel(x, y, w, h - top, true, false, true);
      if (gola) box(g, x, y + h - top, zFront, w, top, FRONT * 0.6, golaMat, item);
      return;
    }
    const drawers = item.drawers || 0,
      // The hood cabinet has a single door; the appliance body is drawn below it.
      doors = hoodDrop(item) ? 1 : item.doors || 0;
    const usable = h - top;
    if (drawers > 0 && doors === 0 && gola) {
      // Every drawer has its own profile above the front.
      const unit = h / drawers;
      for (let i = 0; i < drawers; i++) {
        panel(x, y + i * unit, w, unit - top, true, false);
        box(g, x, y + i * unit + unit - top, zFront, w, top, FRONT * 0.6, golaMat, item);
      }
      return;
    }
    if (drawers > 0 && doors === 0) {
      const dh = (usable - GAP * (drawers - 1)) / drawers;
      for (let i = 0; i < drawers; i++)
        panel(x, y + i * (dh + GAP), w, dh, true, false);
    } else if (doors > 0) {
      const stacked =
        rowOf(item) === "tall" ||
        ["liftDouble", "liftFolding"].includes(item.kind);
      if (stacked) {
        const dh = (usable - GAP * (doors - 1)) / doors;
        for (let i = 0; i < doors; i++) {
          // Doors are counted from the top, as in the front view and the element editor.
          const k = doors - 1 - i,
            hinge = item.visual?.hinges?.[k] ?? (k % 2 === 0 ? "left" : "right");
          panel(x, y + i * (dh + GAP), w, dh, false, hinge === "right");
        }
      } else {
        const dw = (w - GAP * (doors - 1)) / doors;
        for (let i = 0; i < doors; i++)
          panel(
            x + i * (dw + GAP),
            y,
            dw,
            usable,
            false,
            doors === 1 ? item.visual?.hinge === "right" : i % 2 === 1,
          );
      }
    }
    if (gola) box(g, x, y + h - top, zFront, w, top, FRONT * 0.6, golaMat, item);
  };

  const addWall = (wall: PlanWall) => {
    const g = new THREE.Group();
    g.position.set(wall.x * MM, 0, wall.y * MM);
    g.rotation.y = (-wall.angle * Math.PI) / 180;
    root.add(g);
    const scene = wall.scene;
    if (!wall.island) {
      // Single-sided wall: visible from the room, transparent from behind.
      const wallMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(scene.length * MM, scene.roomHeight * MM),
        tiledMaterial(wallTile, scene.length, scene.roomHeight) ??
          mat(new THREE.Color(wallTile?.color ?? "#f3eee6"), { side: THREE.FrontSide }),
      );
      wallMesh.position.set(
        (scene.length / 2) * MM,
        (scene.roomHeight / 2) * MM,
        0,
      );
      wallMesh.receiveShadow = true;
      wallMesh.userData.obstacle = true;
      g.add(wallMesh);
      for (const o of scene.objects) {
        const m =
          o.kind === "window"
            ? glass
            : mat(new THREE.Color(o.kind === "door" ? "#b49a7a" : "#d8d2c6"));
        box(
          g,
          o.x,
          o.bottom,
          1,
          o.width,
          o.height,
          o.kind === "column" ? 300 : 8,
          m,
          undefined,
          true,
        );
      }
    }
    /** Cut-outs for the sinks that stand under a worktop spanning x..x+w (mm, wall coordinates). */
    const sinkOpenings = (x: number, z: number, w: number, d: number) =>
      wall.entries
        .filter(
          (s) =>
            s.entry.appliance === "sink" &&
            !isSpacer(s.entry.item) &&
            s.x >= x - 1 &&
            s.x + s.width <= x + w + 1,
        )
        .sort((a, b) => a.x - b.x)
        .map((s) => ({
          x0: s.x + s.width * 0.15,
          x1: s.x + s.width * 0.85,
          // The tap stands behind the basin, against the wall.
          z0: Math.max(s.y + 90, z + 90),
          z1: Math.min(Math.max(s.y + 90, z + 90) + s.depth * 0.62, z + d - 60),
          item: s.entry.item as LayoutItem,
        }))
        .filter((o) => o.x1 - o.x0 > 200 && o.z1 - o.z0 > 200);
    const hasTop = (t: (typeof wall.entries)[number]) =>
      wall.entries.some(
        (o) =>
          o.entry.item.kind === "worktop" &&
          t.x >= o.x - 1 &&
          t.x + t.width <= o.x + o.width + 1 &&
          sinkOpenings(o.x, o.y, o.width, o.depth).some((h) => h.item === t.entry.item),
      );
    for (const t of wall.entries) {
      const e = t.entry;
      if (isSpacer(e.item)) continue;
      const item = e.item;
      const body = color(e.finish?.body.color, "#ece4d4");
      const front = mat(color(e.finish?.front.color, "#e8d9bf"));
      const x = t.x,
        z = t.y,
        w = t.width,
        d = t.depth,
        y = e.rect.y,
        h = e.rect.height;
      if (item.kind === "worktop") {
        const top = mat(color(e.finish?.worktop.color, "#cfc6b6"), { roughness: 0.5 });
        const holes = sinkOpenings(x, z, w, d);
        if (!holes.length) box(g, x, y, z, w, h, d, top, item);
        else {
          // The worktop is cut around each sink; a steel basin goes down into the cabinet.
          let cursor = x;
          for (const o of holes) {
            box(g, cursor, y, z, o.x0 - cursor, h, d, top, item);
            box(g, o.x0, y, z, o.x1 - o.x0, h, o.z0 - z, top, item);
            box(g, o.x0, y, o.z1, o.x1 - o.x0, h, z + d - o.z1, top, item);
            cursor = o.x1;
            const deep = 190,
              wallT = 6;
            box(g, o.x0, y + h - deep, o.z0, o.x1 - o.x0, wallT, o.z1 - o.z0, steelMat, o.item);
            box(g, o.x0, y + h - deep, o.z0, wallT, deep, o.z1 - o.z0, steelMat, o.item);
            box(g, o.x1 - wallT, y + h - deep, o.z0, wallT, deep, o.z1 - o.z0, steelMat, o.item);
            box(g, o.x0, y + h - deep, o.z0, o.x1 - o.x0, deep, wallT, steelMat, o.item);
            box(g, o.x0, y + h - deep, o.z1 - wallT, o.x1 - o.x0, deep, wallT, steelMat, o.item);
            // Rim, drain and the tap behind the basin.
            const rim = 14;
            box(g, o.x0 - 2, y + h, o.z0 - 2, o.x1 - o.x0 + 4, 3, rim, steelMat, o.item);
            box(g, o.x0 - 2, y + h, o.z1 - rim + 2, o.x1 - o.x0 + 4, 3, rim, steelMat, o.item);
            box(g, o.x0 - 2, y + h, o.z0 - 2, rim, 3, o.z1 - o.z0 + 4, steelMat, o.item);
            box(g, o.x1 - rim + 2, y + h, o.z0 - 2, rim, 3, o.z1 - o.z0 + 4, steelMat, o.item);
            box(g, (o.x0 + o.x1) / 2 - 22, y + h - deep + wallT, (o.z0 + o.z1) / 2 - 22, 44, 2, 44, dark, o.item);
            const cx = (o.x0 + o.x1) / 2,
              tz = o.z0 - 45;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(15 * MM, 17 * MM, 260 * MM, 20), steelMat);
            post.position.set(cx * MM, (y + h + 130) * MM, tz * MM);
            const spout = new THREE.Mesh(new THREE.CylinderGeometry(10 * MM, 10 * MM, 190 * MM, 16), steelMat);
            spout.rotation.x = Math.PI / 2;
            spout.position.set(cx * MM, (y + h + 255) * MM, (tz + 95) * MM);
            const tip = new THREE.Mesh(new THREE.CylinderGeometry(10 * MM, 10 * MM, 55 * MM, 16), steelMat);
            tip.position.set(cx * MM, (y + h + 230) * MM, (tz + 190) * MM);
            for (const part of [post, spout, tip]) {
              part.userData.item = o.item;
              part.castShadow = true;
              g.add(part);
            }
          }
          box(g, cursor, y, z, x + w - cursor, h, d, top, item);
        }
        continue;
      }
      if (["plinth", "side", "panel", "filler"].includes(item.kind)) {
        box(
          g,
          x,
          y,
          z,
          w,
          h,
          d,
          item.kind === "plinth" ? mat(body) : front,
          item,
        );
        continue;
      }
      if (item.kind === "freeHood") {
        // Canopy over the hob and a narrower flue going up.
        const steel = mat(new THREE.Color(applianceStyle(e.applianceColor).body), {
          roughness: 0.35,
          metalness: 0.7,
        });
        const canopy = Math.min(h * 0.32, 300);
        box(g, x, y, z, w, canopy, d, steel, item);
        box(g, x + w * 0.3, y + canopy, z, w * 0.4, h - canopy, d * 0.55, steel, item);
        continue;
      }
      const g2 = new THREE.Group();
      g.add(g2);
      // Carcass slightly behind the fronts; base cabinets stand on a recessed plinth.
      // A free-standing appliance is one steel body, not a cabinet in the decor colour.
      const standing = isFreestanding(item.kind);
      const kind = applianceOf(e),
        solid =
          standing ||
          kind === "fridge" ||
          kind === "dishwasher" ||
          (kind === "oven" && item.kind !== "oven");
      if (solid)
        box(
          g2,
          x,
          y,
          z,
          w,
          h,
          d - FRONT,
          standing
            ? mat(new THREE.Color(applianceStyle(e.applianceColor).body), { roughness: 0.4, metalness: 0.2 })
            : mat(body),
          item,
        );
      else {
        // Hollow carcass, so opened doors and drawers show an inside.
        const T = 18,
          depth = d - FRONT,
          m = mat(body);
        box(g2, x, y, z, T, h, depth, m, item);
        box(g2, x + w - T, y, z, T, h, depth, m, item);
        box(g2, x + T, y, z, w - 2 * T, T, depth, m, item);
        if (e.appliance === "sink") {
          // Open above the basin: only a front and a back rail carry the worktop.
          box(g2, x + T, y + h - T, z, w - 2 * T, T, 70, m, item);
          box(g2, x + T, y + h - T, z + depth - 70, w - 2 * T, T, 70, m, item);
        } else box(g2, x + T, y + h - T, z, w - 2 * T, T, depth, m, item);
        box(g2, x + T, y + T, z, w - 2 * T, h - 2 * T, 8, m, item);
        if ((item.doors || 0) > 0 && !(item.drawers || 0)) {
          const shelves = h > 1500 ? 3 : h > 650 ? 1 : 0;
          for (let i = 1; i <= shelves; i++)
            box(g2, x + T, y + (h * i) / (shelves + 1) - T / 2, z + 8, w - 2 * T, T, depth - 40, m, item);
        }
        if (item.kind === "oven")
          box(
            g2,
            x + T,
            y + h - OVEN_HEIGHT,
            z + 8,
            w - 2 * T,
            OVEN_HEIGHT,
            depth - 8,
            mat(new THREE.Color(applianceStyle(e.applianceColor).body), { roughness: 0.4, metalness: 0.3 }),
            item,
          );
      }
      if (e.row === "base" && y > 0)
        box(
          g2,
          x,
          0,
          z,
          w,
          y,
          d - FRONT - 50,
          mat(body.clone().multiplyScalar(0.85)),
          item,
        );
      if (item.kind === "open" || item.kind === "baseOpen") continue;
      frontPanels(g2, e, x, y, w, h, z + d - FRONT, front, d - FRONT, mat(body.clone().multiplyScalar(1.05)));
      if (hoodDrop(item) > 0)
        box(
          g2,
          x,
          y - hoodDrop(item),
          z + d * 0.15,
          w,
          hoodDrop(item),
          d * 0.85,
          mat(new THREE.Color(applianceStyle(e.applianceColor).body), { roughness: 0.4, metalness: 0.3 }),
          item,
        );
      if (e.appliance === "sink") {
        if (!hasTop(t))
          box(g2, x + w * 0.15, e.counterTop, z + 60, w * 0.7, 6, d * 0.7, dark, item);
      }
      else if (e.hob || e.cooktop || e.appliance === "hob") {
        // Glass-ceramic hob: glossy black plate with four cooking zones.
        const plate = mat(new THREE.Color("#14171a"), {
          roughness: 0.12,
          metalness: 0.4,
        });
        const hw = Math.min(w * 0.9, 600),
          hd = Math.min(d * 0.8, 520),
          hx = x + (w - hw) / 2,
          hz = z + (d - hd) / 2;
        box(g2, hx, e.counterTop, hz, hw, 6, hd, plate, item);
        const ring = mat(new THREE.Color("#5b6266"));
        for (const [cx, cz] of [
          [0.27, 0.3],
          [0.73, 0.3],
          [0.27, 0.72],
          [0.73, 0.72],
        ]) {
          const r = Math.min(hw, hd) * 0.17 * MM;
          const disc = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 32), ring);
          disc.rotation.x = -Math.PI / 2;
          disc.position.set(
            (hx + hw * cx) * MM,
            (e.counterTop + 6.5) * MM,
            (hz + hd * cz) * MM,
          );
          disc.userData.item = item;
          g2.add(disc);
        }
      }
    }
  };
  for (const wall of plan.walls) addWall(wall);

  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x + 2, size.z + 2),
    tiledMaterial(floorTile, (size.x + 2) * 1000, (size.z + 2) * 1000) ??
      mat(new THREE.Color(floorTile?.color ?? "#d9c3a2")),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  floor.receiveShadow = true;
  root.add(floor);
  return { root, bounds, materials, movers };
}

/** One still picture of the kitchen from the default viewpoint, for the PDF offer. */
export function renderKitchenImage(offer: Offer, width = 1200, height = 800) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#faf6ef");
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);
    scene.add(new THREE.HemisphereLight("#ffffff", "#b9a88f", 1.6));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const built = buildScene(offer);
    scene.add(built.root);
    const size = built.bounds.getSize(new THREE.Vector3());
    const center = built.bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    sun.position.set(center.x + radius, radius * 2, center.z + radius * 1.5);
    sun.target.position.copy(center);
    scene.add(sun.target);
    Object.assign(sun.shadow.camera, {
      left: -radius * 1.5,
      right: radius * 1.5,
      top: radius * 1.5,
      bottom: -radius * 1.5,
    });
    sun.shadow.camera.updateProjectionMatrix();
    camera.position.set(
      center.x + radius * 0.45,
      radius * 0.75,
      center.z + radius * 1.35,
    );
    camera.lookAt(center.x, Math.min(1.1, size.y / 2), center.z);
    renderer.render(scene, camera);
    const data = renderer.domElement.toDataURL("image/png");
    built.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    built.materials.forEach((m) => m.dispose());
    return Promise.resolve({ data, width, height });
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

export default function Kitchen3DViewport({
  offer,
  fullscreen = false,
  onFullscreen,
  onCloseFullscreen,
  onSelect,
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
  offer: Offer;
  fullscreen?: boolean;
  onFullscreen?: () => void;
  onCloseFullscreen?: () => void;
  onSelect?: (item: LayoutItem) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ fit: () => void; toggleAll: () => void } | null>(null);
  const [opened, setOpened] = useState(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  // Only what is drawn: layout, sizes, materials and wall settings.
  const model = useMemo(
    () => ({
      elements: offer.elements,
      layout: offer.layout,
      selection: offer.selection,
      prices: offer.prices,
      elevation: offer.elevation,
    }),
    [
      offer.elements,
      offer.layout,
      offer.selection,
      offer.prices,
      offer.elevation,
    ],
  );
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#faf6ef");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    scene.add(new THREE.HemisphereLight("#ffffff", "#b9a88f", 1.6));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const built = buildScene({ ...offer, ...model });
    scene.add(built.root);
    const size = built.bounds.getSize(new THREE.Vector3());
    const center = built.bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    sun.position.set(center.x + radius, radius * 2, center.z + radius * 1.5);
    sun.target.position.copy(center);
    scene.add(sun.target);
    Object.assign(sun.shadow.camera, {
      left: -radius * 1.5,
      right: radius * 1.5,
      top: radius * 1.5,
      bottom: -radius * 1.5,
    });
    sun.shadow.camera.updateProjectionMatrix();
    const fit = () => {
      controls.target.set(center.x, Math.min(1.1, size.y / 2), center.z);
      camera.position.set(
        center.x + radius * 0.45,
        radius * 0.75,
        center.z + radius * 1.35,
      );
      controls.update();
    };
    fit();
    api.current = {
      fit,
      toggleAll: () => {
        const open = !built.movers.some((m) => m.target > 0);
        for (const m of built.movers) m.target = open ? 1 : 0;
        setOpened(open);
      },
    };
    setOpened(false);
    const resize = () => {
      const w = node.clientWidth,
        h = node.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    // A tap opens or closes a door or drawer, or the element editor on the carcass; a drag only rotates the view.
    let down: { x: number; y: number } | null = null;
    const ray = new THREE.Raycaster();
    const pick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      return ray
        .intersectObjects(built.root.children, true)
        .find((h) => h.object.userData.item);
    };
    const pointerDown = (e: PointerEvent) =>
      (down = { x: e.clientX, y: e.clientY });
    const pointerUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6)
        return;
      down = null;
      const hit = pick(e);
      if (!hit) return;
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.mover) node = node.parent;
      const mover = node?.userData.mover as Mover | undefined;
      if (mover) {
        mover.target = mover.target ? 0 : 1;
        setOpened(built.movers.some((m) => m.target > 0));
      } else select.current?.(hit.object.userData.item);
    };
    // A double tap always opens the element editor.
    const doubleClick = (e: MouseEvent) => {
      const hit = pick(e);
      if (hit) select.current?.(hit.object.userData.item);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("dblclick", doubleClick);
    const stepMovers = createMoverStepper(built);
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      stepMovers();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("dblclick", doubleClick);
      controls.dispose();
      built.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      built.materials.forEach((m) => m.dispose());
      renderer.dispose();
      node.removeChild(renderer.domElement);
      api.current = null;
    };
    // offer fields outside `model` (client, notes…) do not change the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);
  return (
    <div className="elevation-view kitchen-3d">
      <div className="elevation-toolbar">
        {fullscreen && (
          <button
            className="icon-btn"
            aria-label="Zatvori prikaz preko celog ekrana"
            onClick={onCloseFullscreen}
          >
            <X size={22} />
          </button>
        )}
        <button className="text-btn" onClick={() => api.current?.fit()}>
          <LocateFixed size={18} /> Uklopi
        </button>
        <button className="text-btn" onClick={() => api.current?.toggleAll()}>
          {opened ? <DoorClosed size={18} /> : <DoorOpen size={18} />}{" "}
          {opened ? "Zatvori sve" : "Otvori sve"}
        </button>
        {!fullscreen && onFullscreen && (
          <button
            className="text-btn"
            aria-label="Prikaz preko celog ekrana"
            onClick={onFullscreen}
          >
            <Maximize size={18} /> Ceo ekran
          </button>
        )}
        {!fullscreen && toolbarExtra && (
          <div className="elevation-toolbar-row2">{toolbarExtra}</div>
        )}
      </div>
      <div
        ref={host}
        className="kitchen-3d-canvas"
        role="img"
        aria-label="3D pregled kuhinje"
      />
      <p className="kitchen-3d-hint">
        Prevlačenjem okrećite, dva prsta za zum i pomeranje. Dodir na vrata ili
        fioku otvara i zatvara je, dodir na korpus ili dupli dodir otvara
        uređivanje elementa.
      </p>
    </div>
  );
}
