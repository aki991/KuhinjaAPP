import { isSimulationOnly, templates } from "./catalog";
import type {
  ElementKind,
  Hardware,
  KitchenElement,
  Panel,
  Selection,
  Settings,
  Product,
} from "./types";
import {
  frontOverhang,
  upperCabinet,
  validPushRule,
  wallFrontHeight,
  verticalGola,
  componentErrors,
  kitQuantities,
} from "./opening";
/** Height of the built-in oven; the rest of an oven cabinet is the drawer below it. */
export const OVEN_HEIGHT = 600;
export const hingesForHeight = (h: number) =>
  h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5;
export function construct(
  e: KitchenElement,
  sel: Selection,
  s: Settings,
  products: Product[] = [],
): {
  panels: Panel[];
  hardware: Hardware[];
  warnings: string[];
  errors: string[];
} {
  const panels: Panel[] = [],
    hardware: Hardware[] = [],
    warnings: string[] = [],
    errors: string[] = [];
  if (isSimulationOnly(e.kind)) return { panels, hardware, warnings, errors };
  const template = templates.find((t) => t.kind === e.kind);
  if (template?.constructionKind)
    return construct({ ...e, kind: template.constructionKind }, sel, s, products);
  if (
    sel.frontOverhang !== undefined &&
    (!Number.isInteger(sel.frontOverhang) ||
      sel.frontOverhang < 1 ||
      sel.frontOverhang > 100)
  )
    errors.push("Prepust fronta mora biti ceo broj od 1 do 100 mm.");
  if (!template)
    return {
      panels,
      hardware,
      warnings,
      errors: ["Precizan obračun nije dostupan za ovaj tip elementa."],
    };
  if (template.unsupported) {
    // No dedicated rule: price with the general model of the closest cabinet type.
    const kind: ElementKind =
      e.doors === 0 && e.drawers === 0 && e.shelves === 0
        ? "panel"
        : template.group === "Gornji" || template.group === "Most"
          ? "wall2"
          : template.group === "Visoki"
            ? "tall"
            : e.drawers > 0
              ? "drawer3"
              : "base2";
    const general = construct({ ...e, kind }, sel, s, products);
    return {
      ...general,
      warnings: [
        ...general.warnings,
        "Obračun po opštem modelu konstrukcije; proveriti prema stvarnom proizvodu.",
      ],
    };
  }
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
  // No opening system is blocked: every element may use the options of its row.
  const vg = gola ? verticalGola(e, sel, products) : null;
  const golaCompatible = gola && !vg && e.kind !== "open";
  if (vg) {
    const r = vg.rule,
      length = h - r.top - r.bottom;
    const end = products.find((p) => p.id === r.end);
    const endOk = end?.category === "golaEnd" && end.unit === "kom";
    const componentsOk = !componentErrors(r.components, products, [
      vg.product.id,
      r.end,
    ]).length;
    hw(
      vg.product.id,
      (Math.max(0, length) / 1000) * r.profiles,
      "Vertikalni GOLA profil",
    );
    if (endOk) hw(r.end, r.ends * r.profiles, "Završeci vertikalne GOLA");
    if (componentsOk)
      hardware.push(
        ...kitQuantities(
          r.components,
          e.doors,
          e.doors *
            hingesForHeight(
              (h - 2 * g - (e.doors - 1) * g) / Math.max(1, e.doors),
            ),
          r.profiles,
        ),
      );
  }
  const topInset = golaCompatible ? 30 : 0;
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
  // Under the 600 mm built-in oven sits one drawer, as usual for oven cabinets.
  const ovenDrawer = e.kind === "oven";
  if (drawer || ovenDrawer) {
    if (drawer && (!Number.isInteger(e.drawers) || e.drawers < 1 || e.drawers > 6))
      errors.push("Fiokar mora imati 1–6 fioka.");
    const n = ovenDrawer ? 1 : e.drawers,
      frontHeight = ovenDrawer
        ? h - OVEN_HEIGHT - g
        : (h - (n + 1) * g - topInset) / n,
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
    const vertical = tall;
    const availableHeight =
      sel.opening === "overhang" && upperCabinet(e)
        ? wallFrontHeight(e, sel, g)
        : h - 2 * g - topInset - (e.kind === "tallOven" ? 600 : 0);
    let pushPerDoor = 1;
    let pushRule: Product["pushRule"];
    if (sel.opening === "push") {
      // Compatibility limits are not enforced; a complete rule only adds its kit parts.
      const model = products.find((p) => p.id === sel.push),
        rule = model?.pushRule;
      if (
        rule &&
        model?.category === "push" &&
        ["kom", "komplet"].includes(model.unit) &&
        validPushRule(rule) &&
        !componentErrors(rule.components, products).length
      ) {
        pushRule = rule;
        pushPerDoor = rule.perDoor;
      }
    }
    let hingeQuantity = 0;
    for (let i = 0; i < e.doors; i++) {
      const fh = vertical
        ? e.kind === "fridge" && e.doors === 2
          ? (availableHeight - g) * (i === 0 ? 0.6 : 0.4)
          : (availableHeight - (e.doors - 1) * g) / e.doors
        : availableHeight;
      const fw = vertical
        ? w - 2 * g - (vg ? vg.rule.frontInset * vg.rule.profiles : 0)
        : (w - (e.doors + 1) * g) / e.doors;
      panel(`Front vrata ${i + 1}`, fw, fh, 1, sel.front, fullEdge(fw, fh));
      if (e.kind !== "lift" && e.kind !== "fridge") {
        const count = pushRule?.hingesPerDoor ?? hingesForHeight(fh);
        hingeQuantity += count;
        hw(sel.hinge, count, "Šarke");
      }
    }
    if (e.kind === "lift") hw(sel.lift, 1, "Podizni mehanizam");
    if (sel.opening === "handles") hw(sel.handle, e.doors, "Ručke");
    if (sel.opening === "push")
      hw(sel.push, e.doors * pushPerDoor, "Push-to-open");
    if (pushRule)
      hardware.push(
        ...kitQuantities(pushRule.components, e.doors, hingeQuantity),
      );
  }
  if (golaCompatible) {
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
  }
  if (["fridge", "tallOven", "oven", "sink", "lift"].includes(e.kind))
    warnings.push(template.rule);
  return { panels, hardware, warnings, errors };
}
