import { templates } from "./catalog";
import type {
  Hardware,
  KitchenElement,
  Panel,
  Selection,
  Settings,
} from "./types";
export const hingesForHeight = (h: number) =>
  h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5;
export function construct(e: KitchenElement, sel: Selection, s: Settings) {
  const panels: Panel[] = [],
    hardware: Hardware[] = [],
    warnings: string[] = [],
    errors: string[] = [];
  const template = templates.find((t) => t.kind === e.kind);
  if (!template || template.unsupported)
    return {
      panels,
      hardware,
      warnings,
      errors: ["Ugaoni element nije podržan za precizan obračun."],
    };
  const { width: w, height: h, depth: d } = e,
    t = s.thickness,
    b = s.backThickness,
    g = s.gap,
    inside = w - 2 * t;
  if (
    [w, h, d, e.quantity].some((n) => !Number.isFinite(n) || n <= 0) ||
    e.quantity % 1 !== 0 ||
    w <= 2 * t ||
    e.quantity > 100 ||
    w > 6000 ||
    h > 3000 ||
    d > 1500 ||
    e.extra < 0
  )
    return {
      panels,
      hardware,
      warnings,
      errors: ["Dimenzije ili količina elementa nisu validne."],
    };
  const panel = (
    name: string,
    width: number,
    height: number,
    quantity: number,
    material: string,
    edge: number,
    thickness = t,
  ) => {
    if (quantity <= 0) return;
    if (width <= 0 || height <= 0)
      errors.push(`${name}: dimenzije nisu pozitivne.`);
    panels.push({ name, width, height, quantity, material, edge, thickness });
  };
  const hw = (product: string, quantity: number, label: string) => {
    if (quantity > 0) hardware.push({ product, quantity, label });
  };
  const fullEdge = (w: number, h: number) => (2 * (w + h)) / 1000;
  const edge = (w: number, h: number) =>
    s.edgeMode === "all" ? fullEdge(w, h) : h / 1000;
  if (["worktop", "side", "panel", "plinth"].includes(e.kind)) {
    if (e.kind === "worktop")
      panel("Radna ploča", w, d, 1, sel.worktop, (w + 2 * d) / 1000, h);
    else
      panel(
        template.name,
        w,
        h,
        1,
        e.kind === "plinth" ? sel.body : sel.front,
        fullEdge(w, h),
      );
    return { panels, hardware, warnings, errors };
  }
  const base = [
    "base1",
    "base2",
    "drawer2",
    "drawer3",
    "drawer4",
    "sink",
    "oven",
    "island",
  ].includes(e.kind);
  const tall = ["tall", "fridge", "tallOven"].includes(e.kind);
  const drawer = e.kind.startsWith("drawer");
  const gola = sel.opening === "gola";
  // Horizontal GOLA model: only ordinary base cabinets and wooden drawer boxes.
  const golaCompatible = [
    "base1",
    "base2",
    "drawer2",
    "drawer3",
    "drawer4",
  ].includes(e.kind);
  if (gola && !golaCompatible && e.kind !== "open" && e.kind !== "oven")
    errors.push(
      "GOLA: precizan obračun podržava samo standardne donje elemente i fiokare. Izaberite ručke ili zaključajte individualni izbor.",
    );
  const topInset = gola && golaCompatible ? 30 : 0;
  panel("Leva stranica", d, h, 1, sel.body, edge(d, h));
  panel("Desna stranica", d, h, 1, sel.body, edge(d, h));
  panel(
    "Dno",
    inside,
    d,
    1,
    sel.body,
    s.edgeMode === "all" ? fullEdge(inside, d) : inside / 1000,
  );
  if (base) {
    panel("Gornja vezna letva", inside, 100, 2, sel.body, inside / 1000);
    hw(sel.leg, w > 900 ? 6 : 4, "Nogice");
  } else {
    panel(
      "Gornja ploča",
      inside,
      d,
      1,
      sel.body,
      s.edgeMode === "all" ? fullEdge(inside, d) : inside / 1000,
    );
    if (tall) hw(sel.leg, 4, "Nogice");
  }
  if (!["sink", "oven", "fridge", "tallOven"].includes(e.kind))
    panel(
      "Leđa",
      w - 2,
      h - 2,
      1,
      e.kind === "island" ? sel.body : sel.back,
      0,
      e.kind === "island" ? t : b,
    );
  const shelves = e.kind === "oven" ? 1 : e.shelves;
  panel(
    e.kind === "oven" ? "Noseća polica rerne" : "Polica",
    inside,
    d - 20,
    shelves,
    sel.body,
    inside / 1000,
  );
  if (drawer) {
    if (!Number.isInteger(e.drawers) || e.drawers < 1 || e.drawers > 6)
      errors.push("Fiokar mora imati 1–6 fioka.");
    const n = e.drawers,
      frontHeight = (h - (n + 1) * g - topInset) / n,
      boxWidth = inside - 2 * s.clearance,
      boxDepth = d - 50,
      boxHeight = Math.min(180, frontHeight - 45);
    for (let i = 0; i < n; i++) {
      panel(
        `Front fioke ${i + 1}`,
        w - 2 * g,
        frontHeight,
        1,
        sel.front,
        fullEdge(w - 2 * g, frontHeight),
      );
      panel(
        `Stranice fioke ${i + 1}`,
        boxDepth,
        boxHeight,
        2,
        sel.body,
        boxDepth / 1000,
      );
      panel(
        `Čelo i zadnja stranica fioke ${i + 1}`,
        boxWidth - 2 * t,
        boxHeight,
        2,
        sel.body,
        (boxWidth - 2 * t) / 1000,
      );
      panel(`Dno fioke ${i + 1}`, boxWidth, boxDepth, 1, sel.back, 0, b);
    }
    hw(sel.slide, n, "Kompleti klizača");
    if (sel.opening === "handles") hw(sel.handle, n, "Ručke");
    if (sel.opening === "push") {
      hw(sel.push, n, "Push-to-open");
      warnings.push(
        "Push fioke: proveriti kompatibilnost klizača sa izabranim push mehanizmom.",
      );
    }
  } else if (e.doors > 0 && e.kind !== "open" && e.kind !== "oven") {
    if (!Number.isInteger(e.doors) || e.doors > 4)
      errors.push("Broj vrata mora biti od 1 do 4.");
    const vertical = tall;
    const availableHeight =
      h - 2 * g - topInset - (e.kind === "tallOven" ? 600 : 0);
    for (let i = 0; i < e.doors; i++) {
      const fh = vertical
        ? e.kind === "fridge" && e.doors === 2
          ? (availableHeight - g) * (i === 0 ? 0.6 : 0.4)
          : (availableHeight - (e.doors - 1) * g) / e.doors
        : availableHeight;
      const fw = vertical ? w - 2 * g : (w - (e.doors + 1) * g) / e.doors;
      panel(`Front vrata ${i + 1}`, fw, fh, 1, sel.front, fullEdge(fw, fh));
      if (e.kind !== "lift" && e.kind !== "fridge")
        hw(sel.hinge, hingesForHeight(fh), "Šarke");
    }
    if (e.kind === "lift") hw(sel.lift, 1, "Podizni mehanizam");
    if (sel.opening === "handles") hw(sel.handle, e.doors, "Ručke");
    if (sel.opening === "push") hw(sel.push, e.doors, "Push-to-open");
  }
  if (gola && golaCompatible) {
    const runs = drawer ? e.drawers : 1;
    hw(sel.gola, (w / 1000) * runs, "GOLA profil");
    hw(sel.golaEnd, runs * 2, "Završeci GOLA");
    panel(
      "GOLA konstrukciona letva",
      inside,
      60,
      runs,
      sel.body,
      inside / 1000,
    );
    warnings.push(
      "GOLA demo: zaseban profil po elementu i redu fioke, dva završetka po profilu, gornji zazor 30 mm i noseće letve. Bez uglova, kontinualnih spojeva i vertikalnih profila.",
    );
  }
  if (["fridge", "tallOven", "oven", "sink", "lift"].includes(e.kind))
    warnings.push(template.rule);
  return { panels, hardware, warnings, errors };
}
