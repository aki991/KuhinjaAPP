import { construct } from "./construction";
import { templates } from "./catalog";
import { effectiveSelection } from "./opening";
import { elevationScene, intersects } from "./elevation";
import type {
  Calculation,
  KitchenElement,
  Offer,
  Product,
  Selection,
  Settings,
  Usage,
} from "./types";
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function rsd(p: Product, s: Settings) {
  return p.price * (p.currency === "EUR" ? s.eurRate : 1);
}
export function unitPrice(
  p: Product,
  s: Settings,
  expected: "area" | "m" | "piece",
): number {
  const price = rsd(p, s);
  if (expected === "area") {
    if (p.unit === "m²")
      return (
        price + (p.processing || 0) * (p.currency === "EUR" ? s.eurRate : 1)
      );
    if (p.unit === "tabla" && p.sheetWidth && p.sheetHeight)
      return (
        price / ((p.sheetWidth * p.sheetHeight) / 1e6) +
        (p.processing || 0) * (p.currency === "EUR" ? s.eurRate : 1)
      );
  } else if (expected === "m" && p.unit === "m") return price;
  else if (
    expected === "piece" &&
    (["slide", "lift"].includes(p.category)
      ? p.unit === "komplet"
      : p.category === "push"
        ? ["kom", "komplet"].includes(p.unit)
        : ["hinge", "handle", "leg", "golaEnd"].includes(p.category)
          ? p.unit === "kom"
          : p.unit === "kom" || p.unit === "komplet")
  )
    return price;
  throw new Error(`Neodgovarajuća jedinica za ${p.name}: ${p.unit}.`);
}
export function salePrice(cost: number, s: Settings) {
  return s.profitMode === "margin"
    ? cost / (1 - s.margin / 100)
    : cost * (1 + s.markup / 100);
}
export function calculate(
  elements: KitchenElement[],
  global: Selection,
  prices: Product[],
  s: Settings,
): Calculation {
  return calculateWithContext(elements, global, prices, s);
}
export function calculateWithContext(
  elements: KitchenElement[],
  global: Selection,
  prices: Product[],
  s: Settings,
  context?: Pick<Offer, "layout" | "elevation">,
): Calculation {
  const usage = new Map<string, Usage>();
  const errors: string[] = [],
    warnings: string[] = [];
  const product = (id: string) => {
    const p = prices.find((x) => x.id === id);
    if (!p) throw new Error(`Artikal ${id} nije u snimku cenovnika.`);
    return p;
  };
  const consume = (
    id: string,
    amount: number,
    mode: "area" | "m" | "piece",
    edge = 0,
  ) => {
    try {
      const p = product(id),
        price = unitPrice(p, s, mode),
        u = usage.get(id) || {
          product: p,
          area: 0,
          quantity: 0,
          edge: 0,
          cost: 0,
          sheets: 0,
          purchaseArea: 0,
        };
      if (mode === "area") u.area += amount;
      else u.quantity += amount;
      u.edge += edge;
      const c = amount * price;
      u.cost += c;
      usage.set(id, u);
      return c;
    } catch (err) {
      errors.push((err as Error).message);
      return 0;
    }
  };
  if (
    s.margin < 0 ||
    s.margin >= 100 ||
    s.markup < 0 ||
    s.eurRate <= 0 ||
    s.waste < 0 ||
    s.thickness <= 0 ||
    s.backThickness <= 0 ||
    s.gap < 0 ||
    s.clearance < 0 ||
    [s.cutPrice, s.edgeLabor, s.assembly, s.transport, s.laborPerElement].some(
      (n) => !Number.isFinite(n) || n < 0,
    )
  )
    errors.push("Podešavanja obračuna nisu validna (marža mora biti 0–99%).");
  const work = (code: string, fallback: number) => {
    const p = prices.find((p) => p.id === code);
    if (!p) return fallback;
    try {
      return unitPrice(p, s, code === "labor-edge" ? "m" : "piece");
    } catch (err) {
      errors.push((err as Error).message);
      return fallback;
    }
  };
  const results = elements.map((e) => {
    const sel = effectiveSelection(e, global);
    const built = construct(e, sel, s, prices);
    let materials = 0,
      hardwareCost = 0,
      kitLabor = 0,
      edge = 0,
      area = 0;
    for (const p of built.panels) {
      const a = ((p.width * p.height) / 1e6) * p.quantity * e.quantity;
      area += a;
      edge += p.edge * p.quantity * e.quantity;
      materials += consume(p.material, a * (1 + s.waste / 100), "area");
    }
    materials += consume(sel.edge, edge, "m", edge);
    for (const hw of built.hardware) {
      const p = prices.find((p) => p.id === hw.product);
      const amount = consume(
        hw.product,
        hw.quantity * e.quantity,
        p?.unit === "m" ? "m" : "piece",
      );
      if (p?.category === "labor") kitLabor += amount;
      else hardwareCost += amount;
    }
    const labor =
      kitLabor +
      (built.panels.reduce((sum, p) => sum + p.quantity, 0) *
        work("labor-cut", s.cutPrice) +
        work("labor-build", s.laborPerElement) +
        e.extra) *
        e.quantity +
      edge * work("labor-edge", s.edgeLabor);
    errors.push(
      ...built.errors.map(
        (x) =>
          `${templates.find((t) => t.kind === e.kind)?.name ?? "Element"}: ${x}`,
      ),
    );
    warnings.push(...built.warnings);
    return {
      element: e,
      ...built,
      materials,
      hardwareCost,
      labor,
      edge,
      area,
      cost: materials + hardwareCost + labor,
    };
  });
  if (context?.layout) {
    for (const wall of context.layout.walls) {
      const scene = elevationScene(
        {
          ...context,
          elements,
          selection: global,
          prices,
          settings: s,
        } as Offer,
        wall.id,
      );
      for (const e of scene.entries.filter((e) => e.frontOverhang > 0)) {
        const strip = {
          x: e.rect.x,
          y: e.rect.y - e.frontOverhang,
          width: e.rect.width,
          height: e.frontOverhang,
        };
        const blocked =
          strip.y < 0 ||
          scene.entries.some(
            (other) =>
              other.id !== e.id &&
              other.row !== "wall" &&
              other.item.kind !== "spacer" &&
              intersects(strip, other.rect),
          ) ||
          scene.objects.some((o) =>
            intersects(strip, {
              x: o.x,
              y: o.bottom,
              width: o.width,
              height: o.height,
            }),
          );
        if (blocked) {
          const message = `Prepušteni front ${e.code}: nema dovoljno slobodnog prostora ispod korpusa.`;
          errors.push(message);
          results.find((r) => r.element.id === e.id)?.errors.push(message);
        }
      }
    }
  }
  let boardExtra = 0;
  for (const u of usage.values())
    if (u.product.unit === "tabla") {
      const p = u.product,
        sheetArea = ((p.sheetWidth || 0) * (p.sheetHeight || 0)) / 1e6;
      if (sheetArea <= 0) {
        errors.push(`Nedostaju dimenzije table: ${p.name}`);
        continue;
      }
      u.sheets = Math.ceil(u.area / sheetArea - 1e-10);
      u.purchaseArea = u.sheets * sheetArea;
      // This is area-based procurement only, not cutting optimization. Oversize panels are rejected.
      for (const r of results)
        for (const panel of r.panels.filter((x) => x.material === p.id))
          if (!(
            (panel.width <= p.sheetWidth! && panel.height <= p.sheetHeight!) ||
            (panel.height <= p.sheetWidth! && panel.width <= p.sheetHeight!)
          ))
            errors.push(`${panel.name} ne staje na tablu ${p.name}.`);
      if (s.purchaseMode === "sheets") {
        const newCost =
          u.sheets * rsd(p, s) +
          (p.processing || 0) * (p.currency === "EUR" ? s.eurRate : 1) * u.area;
        boardExtra += newCost - u.cost;
        u.cost = newCost;
      }
      warnings.push(
        "Broj tabli je površinski minimum sa otpadom, bez optimizacije krojenja. Proveriti raspored i smer dekora.",
      );
    }
  const material = results.reduce((a, r) => a + r.materials, 0) + boardExtra,
    hardware = results.reduce((a, r) => a + r.hardwareCost, 0),
    labor = results.reduce((a, r) => a + r.labor, 0),
    assembly = work("labor-assembly", s.assembly),
    transport = work("labor-transport", s.transport);
  const cost = material + hardware + labor + assembly + transport,
    total = salePrice(cost, s);
  const countBy = (cat: string) =>
    [...usage.values()]
      .filter((u) => u.product.category === cat)
      .reduce((a, u) => a + u.quantity, 0);
  return {
    elements: results,
    usage: [...usage.values()],
    material: round(material),
    hardware: round(hardware),
    labor: round(labor),
    assembly: round(assembly),
    transport: round(transport),
    cost: round(cost),
    profit: round(total - cost),
    total: round(total),
    count: elements.reduce((a, e) => a + e.quantity, 0),
    area: results.reduce((a, r) => a + r.area, 0),
    edge: results.reduce((a, r) => a + r.edge, 0),
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    slideCount: countBy("slide"),
    hingeCount: countBy("hinge"),
    handleCount: countBy("handle"),
  };
}
export const calculateOffer = (o: Offer) =>
  calculateWithContext(o.elements, o.selection, o.prices, o.settings, o);
export function repriceOffer(
  o: Offer,
  prices: Product[],
  settings?: Settings,
): Offer {
  return {
    ...structuredClone(o),
    prices: structuredClone(prices),
    settings: settings ? structuredClone(settings) : o.settings,
    updatedAt: new Date().toISOString(),
  };
}
