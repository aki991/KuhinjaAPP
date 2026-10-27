import { categories, templates } from "./catalog";
import { calculateOffer, onlyUnsupportedErrors } from "./engine";
import { validPushRule, validVerticalGolaRule } from "./opening";
import { validAppearance, validColor } from "./appearance";
import type { Backup } from "./db";
import type {
  KitchenElement,
  Offer,
  Product,
  Selection,
  Settings,
  Variant,
  KitchenLayout,
  Placement,
  ElementVisual,
  ElevationConfig,
} from "./types";
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => typeof v === "string";
export function validSettings(s: Settings) {
  return (
    !!s &&
    [
      "thickness",
      "backThickness",
      "gap",
      "clearance",
      "waste",
      "cutPrice",
      "edgeLabor",
      "assembly",
      "transport",
      "laborPerElement",
      "margin",
      "markup",
      "eurRate",
    ].every(
      (k) =>
        finite(s[k as keyof Settings]) && Number(s[k as keyof Settings]) >= 0,
    ) &&
    s.thickness > 0 &&
    s.backThickness > 0 &&
    s.eurRate > 0 &&
    s.margin < 100 &&
    ["margin", "markup"].includes(s.profitMode) &&
    ["area", "sheets"].includes(s.purchaseMode) &&
    ["front", "all"].includes(s.edgeMode)
  );
}
function validProduct(p: Product) {
  return (
    !!p &&
    str(p.id) &&
    str(p.code) &&
    str(p.name) &&
    str(p.supplier) &&
    str(p.manufacturer) &&
    str(p.note) &&
    typeof p.active === "boolean" &&
    p.category in categories &&
    finite(p.price) &&
    p.price >= 0 &&
    (p.appearance === undefined || validAppearance(p.appearance)) &&
    (p.thickness === undefined ||
      (finite(p.thickness) && p.thickness > 0 && p.thickness <= 100)) &&
    [p.width, p.height, p.depth].every(
      (v) => v === undefined || (finite(v) && v > 0 && v <= 6000),
    ) &&
    (p.vatRate === undefined ||
      (finite(p.vatRate) && p.vatRate >= 0 && p.vatRate <= 100)) &&
    (p.discountRate === undefined ||
      (finite(p.discountRate) &&
        p.discountRate >= 0 &&
        p.discountRate < 100)) &&
    ["RSD", "EUR"].includes(p.currency) &&
    ["m²", "m", "kom", "komplet", "tabla"].includes(p.unit) &&
    (p.unit !== "tabla" ||
      (!!p.sheetWidth &&
        !!p.sheetHeight &&
        p.sheetWidth > 0 &&
        p.sheetHeight > 0)) &&
    (p.processing === undefined ||
      (finite(p.processing) && p.processing >= 0)) &&
    (p.pushRule === undefined ||
      (p.category === "push" && validPushRule(p.pushRule))) &&
    (p.verticalGolaRule === undefined ||
      (p.category === "gola" && validVerticalGolaRule(p.verticalGolaRule)))
  );
}
const validSelection = (s: Selection) =>
  !!s &&
  [
    "body",
    "front",
    "back",
    "edge",
    "worktop",
    "hinge",
    "slide",
    "lift",
    "handle",
    "leg",
    "gola",
    "golaEnd",
    "push",
  ].every((k) => str(s[k as keyof Selection])) &&
  ["handles", "gola", "push", "overhang"].includes(s.opening) &&
  (s.wallOpening === undefined ||
    ["handles", "push", "overhang"].includes(s.wallOpening)) &&
  (s.tallOpening === undefined ||
    ["handles", "push", "gola"].includes(s.tallOpening)) &&
  (s.wallHinge === undefined || str(s.wallHinge)) &&
  (s.frontMode === undefined ||
    ["body", "separate", "ral"].includes(s.frontMode)) &&
  (s.ralColor === undefined || validColor(s.ralColor)) &&
  (s.ralCode === undefined || str(s.ralCode)) &&
  (s.wallHandle === undefined || str(s.wallHandle)) &&
  (s.handlePosition === undefined ||
    ["vertical", "horizontal", "center"].includes(s.handlePosition)) &&
  (s.worktopThickness === undefined ||
    (finite(s.worktopThickness) &&
      s.worktopThickness > 0 &&
      s.worktopThickness <= 100)) &&
  ["wallPush", "wallLift", "tallPush", "tallHinge", "verticalGola"].every(
    (k) =>
      s[k as keyof Selection] === undefined || str(s[k as keyof Selection]),
  ) &&
  (s.frontOverhang === undefined ||
    (Number.isInteger(s.frontOverhang) &&
      s.frontOverhang >= 1 &&
      s.frontOverhang <= 100));
function validElement(e: KitchenElement) {
  return (
    !!e &&
    str(e.id) &&
    templates.some((t) => t.kind === e.kind) &&
    [
      "width",
      "height",
      "depth",
      "quantity",
      "doors",
      "drawers",
      "shelves",
      "extra",
    ].every(
      (k) =>
        finite(e[k as keyof KitchenElement]) &&
        Number(e[k as keyof KitchenElement]) >= 0,
    ) &&
    e.width > 0 &&
    e.height > 0 &&
    e.depth > 0 &&
    Number.isInteger(e.quantity) &&
    e.quantity > 0 &&
    str(e.note) &&
    typeof e.locked === "boolean" &&
    validSelection(e.selection) &&
    (e.placement === undefined || validPlacement(e.placement)) &&
    validVisual(e.visual)
  );
}
function validPlacement(p: Placement) {
  return (
    !!p &&
    str(p.wall) &&
    finite(p.offset) &&
    p.offset >= 0 &&
    (p.order === undefined || (Number.isInteger(p.order) && p.order >= 0)) &&
    (p.row === undefined || ["base", "wall", "extra"].includes(p.row))
  );
}
function validVariant(v: Variant) {
  return (
    !!v &&
    str(v.id) &&
    str(v.name) &&
    str(v.createdAt) &&
    validSelection(v.selection) &&
    validSettings(v.settings) &&
    Array.isArray(v.elements) &&
    v.elements.every(validElement) &&
    Array.isArray(v.prices) &&
    v.prices.every(validProduct) &&
    validLayout(v.layout, v.elements) &&
    validElevation(v.elevation, v.layout)
  );
}
function validOffer(o: Offer) {
  return (
    !!o &&
    str(o.id) &&
    str(o.note) &&
    str(o.createdAt) &&
    str(o.updatedAt) &&
    !Number.isNaN(Date.parse(o.updatedAt)) &&
    str(o.templateVersion) &&
    ["draft", "sent", "accepted"].includes(o.status) &&
    !!o.client &&
    ["name", "phone", "project", "location", "layout"].every((k) =>
      str(o.client[k as keyof Offer["client"]]),
    ) &&
    validSelection(o.selection) &&
    validSettings(o.settings) &&
    Array.isArray(o.elements) &&
    o.elements.every(validElement) &&
    Array.isArray(o.prices) &&
    o.prices.every(validProduct) &&
    Array.isArray(o.variants) &&
    o.variants.every(validVariant) &&
    validLayout(o.layout, o.elements) &&
    validElevation(o.elevation, o.layout)
  );
}
function validVisual(v: ElementVisual | undefined) {
  return (
    v === undefined ||
    (!!v &&
      typeof v === "object" &&
      (v.hinge === undefined || ["left", "right"].includes(v.hinge)) &&
      (v.glass === undefined || typeof v.glass === "boolean") &&
      (v.hob === undefined || typeof v.hob === "boolean") &&
      (v.appliance === undefined ||
        [
          "auto",
          "none",
          "oven",
          "sink",
          "hob",
          "fridge",
          "dishwasher",
        ].includes(v.appliance)) &&
      ["offset", "bottom"].every(
        (k) =>
          v[k as "offset" | "bottom"] === undefined ||
          (finite(v[k as "offset" | "bottom"]) &&
            v[k as "offset" | "bottom"]! >= 0 &&
            v[k as "offset" | "bottom"]! <= 100000),
      ))
  );
}
function validElevation(
  v: ElevationConfig | undefined,
  layout?: KitchenLayout,
) {
  return (
    v === undefined ||
    (!!v &&
      v.version === 1 &&
      finite(v.toeKick) &&
      v.toeKick >= 0 &&
      v.toeKick <= 500 &&
      finite(v.upperGap) &&
      v.upperGap >= 0 &&
      v.upperGap <= 3000 &&
      finite(v.wallHeight) &&
      v.wallHeight >= 500 &&
      v.wallHeight <= 10000 &&
      Array.isArray(v.objects) &&
      new Set(v.objects.map((o) => o?.id)).size === v.objects.length &&
      v.objects.every(
        (o) =>
          !!o &&
          str(o.id) &&
          ["window", "door", "column", "niche"].includes(o.kind) &&
          (layout
            ? layout.walls.some((w) => w.id === o.wall)
            : ["A", "B", "C", "island"].includes(o.wall)) &&
          ["x", "width", "height", "bottom"].every(
            (k) =>
              finite(o[k as "x" | "width" | "height" | "bottom"]) &&
              o[k as "x" | "width" | "height" | "bottom"] >= 0 &&
              o[k as "x" | "width" | "height" | "bottom"] <= 100000,
          ) &&
          o.width > 0 &&
          o.height > 0,
      ))
  );
}
function validLayout(
  layout: KitchenLayout | undefined,
  elements: KitchenElement[],
) {
  return (
    layout === undefined ||
    (!!layout &&
      Array.isArray(layout.walls) &&
      layout.walls.length > 0 &&
      layout.walls.length <= 4 &&
      layout.walls.every(
        (w) =>
          w &&
          ["A", "B", "C", "island"].includes(w.id) &&
          str(w.name) &&
          finite(w.length) &&
          w.length > 0,
      ) &&
      new Set(layout.walls.map((w) => w.id)).size === layout.walls.length &&
      layout.walls.some((w) => w.id === layout.activeWall) &&
      (layout.islandPosition === undefined ||
        (!!layout.islandPosition &&
          [layout.islandPosition.x, layout.islandPosition.y].every(
            (value) => finite(value) && value >= 0 && value <= 100000,
          ))) &&
      elements.every(
        (e) =>
          e.placement === undefined ||
          layout.walls.some((w) => w.id === e.placement!.wall),
      ) &&
      (layout.version === undefined || layout.version === 3) &&
      (layout.spacers === undefined ||
        (Array.isArray(layout.spacers) &&
          layout.spacers.every(
            (s) =>
              s &&
              str(s.id) &&
              s.kind === "spacer" &&
              finite(s.width) &&
              s.width > 0 &&
              s.quantity === 1 &&
              validPlacement(s.placement) &&
              ["base", "wall"].includes(s.placement.row || "") &&
              layout.walls.some((w) => w.id === s.placement.wall),
          ))) &&
      new Set([
        ...elements.map((e) => e.id),
        ...(layout.spacers || []).map((s) => s.id),
      ]).size ===
        elements.length + (layout.spacers || []).length)
  );
}
export function validateBackup(data: Backup) {
  if (
    data?.format !== "kuhinja-backup" ||
    data.version !== 1 ||
    ![
      "products",
      "offers",
      "suppliers",
      "settings",
      "templates",
      "clients",
    ].every((k) => Array.isArray(data[k as keyof Backup]))
  )
    throw new Error("Nepodržan format rezervne kopije.");
  const ids = (rows: { id: string }[]) =>
    rows.every((r) => r && str(r.id)) &&
    new Set(rows.map((r) => r.id)).size === rows.length;
  if (
    ![
      data.products,
      data.offers,
      data.suppliers,
      data.settings,
      data.templates,
      data.clients,
    ].every(ids)
  )
    throw new Error("Neispravni ili ponovljeni identifikatori.");
  if (
    !data.products.every(validProduct) ||
    (data.importFormats !== undefined &&
      (!Array.isArray(data.importFormats) ||
        !data.importFormats.every(
          (f) =>
            !!f &&
            str(f.supplier) &&
            !!f.supplier &&
            !!f.mapping &&
            typeof f.mapping === "object" &&
            Object.values(f.mapping).every(str),
        ))) ||
    !data.offers.every(validOffer) ||
    !data.settings.every((s) => validSettings(s.value)) ||
    !data.suppliers.every(
      (s) => str(s.name) && typeof s.isDefault === "boolean",
    ) ||
    !data.templates.every((t) => str(t.version) && Array.isArray(t.rules)) ||
    !data.clients.every((c) =>
      ["name", "phone", "project", "location", "layout"].every((k) =>
        str(c[k as keyof typeof c]),
      ),
    )
  )
    throw new Error("Rezervna kopija sadrži nevalidne podatke.");
  for (const o of data.offers) {
    if (calculateOffer(o).errors.length && !onlyUnsupportedErrors(o))
      throw new Error(
        "Kopija sadrži ponudu sa neispravnom konstrukcijom ili cenovnikom.",
      );
    for (const v of o.variants)
      if (
        calculateOffer({ ...o, ...v, variants: [] }).errors.length &&
        !onlyUnsupportedErrors({ ...o, ...v, variants: [] })
      )
        throw new Error("Kopija sadrži nevalidnu varijantu.");
  }
}
