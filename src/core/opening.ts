import type {
  KitchenElement,
  Offer,
  Product,
  PushRule,
  Selection,
  SelectionProductKey,
  KitComponent,
  VerticalGolaRule,
} from "./types";
export const productSelectionKeys: SelectionProductKey[] = [
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
];
export const standardWall = (e: KitchenElement) =>
  e.kind === "wall1" || e.kind === "wall2";
export const tallCabinet = (e: KitchenElement) =>
  ["tall", "fridge", "tallOven"].includes(e.kind);
export const horizontalGolaKinds: KitchenElement["kind"][] = [
  "base1",
  "base2",
  "drawer2",
  "drawer3",
  "drawer4",
  "sink",
];
export function effectiveSelection(
  e: KitchenElement,
  global: Selection,
): Selection {
  if (e.locked) return { ...e.selection };
  if (standardWall(e))
    return {
      ...global,
      opening: global.wallOpening ?? "handles",
      hinge: global.wallHinge ?? global.hinge,
      push: global.wallPush ?? global.push,
    };
  if (e.kind === "lift")
    return {
      ...global,
      opening:
        global.wallOpening === "push" && global.wallLift ? "push" : "handles",
      push: global.wallPush ?? global.push,
      lift: global.wallLift ?? global.lift,
    };
  if (e.kind === "open") return { ...global, opening: "handles" };
  if (tallCabinet(e))
    return {
      ...global,
      opening: global.tallOpening ?? global.opening,
      hinge: global.tallHinge ?? global.hinge,
      push: global.tallPush ?? global.push,
    };
  return { ...global };
}
export const frontOverhang = (e: KitchenElement, s: Selection) =>
  standardWall(e) && s.opening === "overhang" ? (s.frontOverhang ?? 20) : 0;
export const wallFrontHeight = (
  e: KitchenElement,
  s: Selection,
  gap: number,
) => {
  const extension = frontOverhang(e, s);
  return (
    e.height -
    2 * gap +
    (s.opening === "overhang"
      ? gap +
        (Number.isFinite(extension) && extension >= 1 && extension <= 100
          ? extension
          : 0)
      : 0)
  );
};
export const validComponents = (cs: KitComponent[] | undefined) =>
  cs === undefined ||
  (Array.isArray(cs) &&
    cs.every(
      (c) =>
        !!c &&
        typeof c === "object" &&
        typeof c.product === "string" &&
        !!c.product &&
        Number.isFinite(c.quantity) &&
        c.quantity > 0 &&
        ["door", "hinge", "cabinet", "profile"].includes(c.basis),
    ) &&
    new Set(cs.map((c) => c.product)).size === cs.length);
export const validPushRule = (r: PushRule | undefined) =>
  !!r &&
  Number.isInteger(r.perDoor) &&
  r.perDoor > 0 &&
  r.perDoor <= 4 &&
  Array.isArray(r.hinges) &&
  (r.hinges.length > 0 ||
    (r.kinds?.length === 1 && r.kinds[0] === "lift" && !!r.lifts?.length)) &&
  r.hinges.every((h) => typeof h === "string" && !!h) &&
  Array.isArray(r.kinds) &&
  r.kinds.length > 0 &&
  r.kinds.every((k) => ["wall1", "wall2", "lift", "tall"].includes(k)) &&
  (!r.kinds.includes("lift") ||
    (Array.isArray(r.lifts) &&
      r.lifts.length > 0 &&
      r.lifts.every((x) => typeof x === "string" && !!x))) &&
  (r.system === undefined || ["classic", "silent"].includes(r.system)) &&
  (r.system !== "silent" ||
    (typeof r.source === "string" &&
      !!r.source.trim() &&
      Number.isInteger(r.hingesPerDoor) &&
      r.hingesPerDoor! > 0)) &&
  (r.hingesPerDoor === undefined ||
    (Number.isInteger(r.hingesPerDoor) &&
      r.hingesPerDoor > 0 &&
      r.hingesPerDoor <= 10)) &&
  validComponents(r.components) &&
  !(r.components ?? []).some((c) => c.basis === "profile") &&
  Number.isFinite(r.maxHeight) &&
  r.maxHeight > 0 &&
  Number.isFinite(r.maxWidth) &&
  r.maxWidth > 0 &&
  [r.minHeight, r.minWidth].every(
    (n) => n === undefined || (Number.isFinite(n) && n >= 0),
  ) &&
  (r.minHeight ?? 0) <= r.maxHeight &&
  (r.minWidth ?? 0) <= r.maxWidth &&
  Number.isFinite(r.minGap) &&
  r.minGap >= 0;
export const validVerticalGolaRule = (r: VerticalGolaRule | undefined) =>
  !!r &&
  typeof r.source === "string" &&
  !!r.source.trim() &&
  Number.isInteger(r.profiles) &&
  r.profiles >= 1 &&
  r.profiles <= 2 &&
  [r.top, r.bottom].every((n) => Number.isFinite(n) && n >= 0) &&
  [r.frontInset, r.maxWidth, r.maxHeight].every(
    (n) => Number.isFinite(n) && n > 0,
  ) &&
  typeof r.end === "string" &&
  !!r.end &&
  Number.isInteger(r.ends) &&
  r.ends >= 0 &&
  r.ends <= 4 &&
  Array.isArray(r.components) &&
  validComponents(r.components);
export function componentErrors(
  cs: KitComponent[] | undefined,
  products: Product[],
  excluded: string[] = [],
) {
  if (!validComponents(cs))
    return ["Komponente kompleta nisu pravilno definisane."];
  return (cs ?? []).flatMap((c) => {
    const p = products.find((p) => p.id === c.product);
    return !p ||
      excluded.includes(c.product) ||
      !["other", "labor", "golaEnd"].includes(p.category) ||
      !["kom", "komplet"].includes(p.unit)
      ? ["Komplet: nedostaje odgovarajući artikal za nosače, dodatke ili rad."]
      : [];
  });
}
export function kitQuantities(
  cs: KitComponent[] | undefined,
  doors: number,
  hinges: number,
  profiles = 0,
) {
  return (cs ?? []).map((c) => ({
    product: c.product,
    quantity:
      c.quantity *
      { door: doors, hinge: hinges, cabinet: 1, profile: profiles }[c.basis],
    label: "Komponenta kompleta",
  }));
}
export function verticalGola(
  e: KitchenElement,
  s: Selection,
  products: Product[],
) {
  const p = products.find((p) => p.id === s.verticalGola);
  const r = p?.verticalGolaRule;
  return e.kind === "tall" &&
    (!e.visual?.appliance || ["auto", "none"].includes(e.visual.appliance)) &&
    p?.category === "gola" &&
    p.unit === "m" &&
    validVerticalGolaRule(r)
    ? { product: p, rule: r! }
    : null;
}
export const demoPushRule = (): PushRule => ({
  perDoor: 1,
  hinges: ["hinge-economy"],
  kinds: ["wall1", "wall2", "tall"],
  maxHeight: 1600,
  maxWidth: 800,
  minGap: 2,
});
export function upgradeDemoPush(p: Product): Product {
  if (
    p.id !== "push" ||
    p.category !== "push" ||
    p.manufacturer !== "Primer" ||
    p.supplier !== "Demo materijali" ||
    p.name !== "Push-to-open mehanizam" ||
    !p.note.includes("Izmišljena demo cena")
  )
    return p;
  const r = p.pushRule;
  // Only the untouched, previously bundled demo rule receives the new construction.
  // Manufacturer rules and user-edited limits/hinges must remain unchanged.
  if (
    r &&
    !(
      Object.keys(r).length === 6 &&
      r.perDoor === 1 &&
      Array.isArray(r.hinges) &&
      r.hinges.length === 1 &&
      r.hinges[0] === "hinge-economy" &&
      Array.isArray(r.kinds) &&
      r.kinds.length === 2 &&
      r.kinds.includes("wall1") &&
      r.kinds.includes("wall2") &&
      r.maxHeight === 1600 &&
      r.maxWidth === 800 &&
      r.minGap === 2
    )
  )
    return p;
  return { ...p, pushRule: demoPushRule() };
}
/** Preserve legacy choices and locked element snapshots; new upper defaults are independent. */
export function ensureOpenings<T extends Offer>(offer: T): T {
  const next = structuredClone(offer);
  const normalize = (s: Selection): Selection => ({
    ...s,
    wallOpening: s.wallOpening ?? (s.opening === "push" ? "push" : "handles"),
    tallOpening:
      s.tallOpening ?? (s.opening === "overhang" ? "handles" : s.opening),
    frontOverhang: s.frontOverhang ?? 20,
  });
  next.selection = normalize(next.selection);
  next.prices = next.prices.map(upgradeDemoPush);
  next.variants = next.variants.map((v) => ({
    ...v,
    selection: normalize(v.selection),
    prices: v.prices.map(upgradeDemoPush),
  }));
  return next;
}
