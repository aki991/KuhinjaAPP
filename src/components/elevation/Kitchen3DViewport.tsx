import { useEffect, useMemo, useRef } from "react";
import { Maximize, Scan, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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

function color(value: string | undefined, fallback: string) {
  return new THREE.Color(
    value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback,
  );
}

export function buildScene(offer: Offer) {
  const plan = kitchenPlan(offer, "all");
  const root = new THREE.Group();
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
    ) => {
      box(
        g,
        px,
        py,
        zFront,
        pw,
        ph,
        FRONT,
        item.visual?.glass ? glass : front,
        item,
      );
      if (!handles) return;
      if (drawer)
        box(
          g,
          px + pw / 2 - 64,
          py + ph - 45,
          zFront + FRONT,
          128,
          12,
          14,
          handleMat,
          item,
        );
      else if (lifting)
        // Lift-up fronts are opened from the bottom edge, so the handle is horizontal.
        box(g, px + pw / 2 - 64, py + 8, zFront + FRONT, 128, 12, 14, handleMat, item);
      else {
        const hx = hingeRight ? px + 40 : px + pw - 52;
        const hy = upper ? py + 40 : py + ph - 200;
        box(g, hx, hy, zFront + FRONT, 12, 160, 14, handleMat, item);
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
        for (let i = 0; i < doors; i++)
          panel(x, y + i * (dh + GAP), w, dh, false, i % 2 === 1);
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
        );
      }
    }
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
        box(
          g,
          x,
          y,
          z,
          w,
          h,
          d,
          mat(color(e.finish?.worktop.color, "#cfc6b6"), { roughness: 0.5 }),
          item,
        );
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
      box(
        g2,
        x,
        y,
        z,
        w,
        h,
        d - FRONT,
        standing ? mat(new THREE.Color(applianceStyle(e.applianceColor).body), { roughness: 0.4, metalness: 0.2 }) : mat(body),
        item,
      );
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
      frontPanels(g2, e, x, y, w, h, z + d - FRONT, front);
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
      if (e.appliance === "sink")
        box(g2, x + w * 0.15, e.counterTop, z + 60, w * 0.7, 6, d * 0.7, dark, item);
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
  return { root, bounds, materials };
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
}: {
  offer: Offer;
  fullscreen?: boolean;
  onFullscreen?: () => void;
  onCloseFullscreen?: () => void;
  onSelect?: (item: LayoutItem) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ fit: () => void } | null>(null);
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
    api.current = { fit };
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
    // A short tap opens the element editor; a drag only rotates the view.
    let down: { x: number; y: number } | null = null;
    const ray = new THREE.Raycaster();
    const pointerDown = (e: PointerEvent) =>
      (down = { x: e.clientX, y: e.clientY });
    const pointerUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6)
        return;
      down = null;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(built.root.children, true)
        .find((h) => h.object.userData.item);
      if (hit) select.current?.(hit.object.userData.item);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
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
          <Scan size={18} /> Uklopi
        </button>
        {!fullscreen && onFullscreen && (
          <button
            className="icon-btn"
            aria-label="Prikaz preko celog ekrana"
            onClick={onFullscreen}
          >
            <Maximize size={20} />
          </button>
        )}
      </div>
      <div
        ref={host}
        className="kitchen-3d-canvas"
        role="img"
        aria-label="3D pregled kuhinje"
      />
      <p className="kitchen-3d-hint">
        Prevlačenjem okrećite, dva prsta za zum i pomeranje. Dodir otvara
        element.
      </p>
    </div>
  );
}
