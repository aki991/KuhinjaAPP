import type {
  Category,
  ElementKind,
  ElementVisual,
  KitchenElement,
  Product,
  Selection,
  Settings,
  Tier,
} from "./types";
import { demoPushRule } from "./opening";
import referenceCatalog from "./reference-catalog";
// randomUUID requires HTTPS; getRandomValues also works on local HTTP over Wi-Fi.
export const uid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
export const defaults: Settings = {
  thickness: 18,
  backThickness: 4,
  gap: 2,
  clearance: 12,
  waste: 10,
  cutPrice: 60,
  edgeLabor: 70,
  assembly: 15000,
  transport: 4000,
  laborPerElement: 1800,
  margin: 20,
  markup: 25,
  profitMode: "margin",
  eurRate: 117.2,
  purchaseMode: "area",
  edgeMode: "front",
};
const p = (
  id: string,
  name: string,
  category: Category,
  unit: Product["unit"],
  price: number,
  extra: Partial<Product> = {},
): Product => ({
  id,
  code: id.toUpperCase(),
  name,
  category,
  unit,
  price,
  supplier: "Demo materijali",
  manufacturer: "Primer",
  currency: "RSD",
  active: true,
  note: "Izmišljena demo cena, nije tržišna ponuda.",
  ...extra,
});
export const demoPrices: Product[] = [
  p("body-white", "Univer beli 18 mm", "body", "m²", 1850, {
    kind: "univer",
    sheetWidth: 2800,
    sheetHeight: 2070,
  }),
  p("body-oak", "Univer hrast 18 mm", "body", "m²", 2650, { kind: "univer" }),
  p("front-univer", "Univer • Kašmir", "front", "m²", 2400, { kind: "univer" }),
  p("front-mdf", "MDF • Mat kašmir", "front", "m²", 6200, { kind: "mdf" }),
  p("front-lacquer", "MDF lakirani • Mat", "front", "m²", 6800, {
    kind: "lacquer",
    processing: 3500,
  }),
  p("back", "HDF leđa 4 mm", "back", "m²", 650),
  p("edge", "ABS kant 1 mm", "edge", "m", 85),
  p("worktop", "Radna ploča • Svetli hrast 38 mm", "worktop", "m²", 7200),
  ...(["economy", "standard", "premium"] as Tier[]).flatMap((tier, i) => [
    p(
      `slide-${tier}`,
      [
        "Ekonomični • Roller 500",
        "Standard • Soft Slide 500",
        "Premium • Box Pro 500",
      ][i],
      "slide",
      "komplet",
      [900, 2500, 6000][i],
      { tier, manufacturer: ["Demo Basic", "Demo Motion", "Demo Pro"][i] },
    ),
    p(
      `hinge-${tier}`,
      [
        "Osnovne • 110°",
        "Sa usporivačem • 110°",
        "Premium sa usporivačem • 110°",
      ][i],
      "hinge",
      "kom",
      [110, 320, 690][i],
      { tier },
    ),
    p(
      `lift-${tier}`,
      ["Basic Lift", "Soft Lift", "Pro Lift"][i],
      "lift",
      "komplet",
      [1800, 3800, 7500][i],
      { tier },
    ),
  ]),
  p("handle", "Ručka • Crna mat 160", "handle", "kom", 380),
  p("leg", "Podesiva nogica 100 mm", "leg", "kom", 110),
  p("push", "Push-to-open mehanizam", "push", "kom", 620, {
    pushRule: demoPushRule(),
  }),
  p("gola", "GOLA horizontalni profil", "gola", "m", 1900),
  p("gola-end", "Završetak GOLA profila", "golaEnd", "kom", 350),
  p("other", "Spojni okov • demo", "other", "kom", 90),
  p("labor-cut", "Sečenje po panelu", "labor", "kom", 60),
  p("labor-edge", "Kantovanje po metru", "labor", "m", 70),
  p("labor-build", "Rad po elementu", "labor", "kom", 1800),
  p("labor-assembly", "Montaža kuhinje", "labor", "kom", 15000),
  p("labor-transport", "Transport kuhinje", "labor", "kom", 4000),
];
export const defaultSelection: Selection = {
  body: "body-white",
  front: "front-mdf",
  back: "back",
  edge: "edge",
  worktop: "worktop",
  hinge: "hinge-standard",
  slide: "slide-premium",
  lift: "lift-standard",
  handle: "handle",
  leg: "leg",
  gola: "gola",
  golaEnd: "gola-end",
  push: "push",
  opening: "handles",
};
export const categories: Record<Category, string> = {
  body: "Korpus / pločasti materijali",
  front: "Frontovi",
  back: "Leđa",
  worktop: "Radne ploče",
  edge: "Kant trake",
  gola: "GOLA profili",
  golaEnd: "GOLA završeci",
  handle: "Ručke",
  hinge: "Šarke",
  slide: "Klizači",
  lift: "Podizni mehanizmi",
  leg: "Nogice",
  push: "Push-to-open",
  other: "Ostali okovi",
  labor: "Radovi",
};
export interface Template {
  kind: ElementKind;
  name: string;
  group: string;
  width: number;
  height: number;
  depth: number;
  doors: number;
  drawers: number;
  shelves: number;
  rule: string;
  unsupported?: boolean;
  constructionKind?: ElementKind;
  visual?: ElementVisual;
  corner?: boolean;
  bridge?: boolean;
}
const legacyTemplates: Template[] = [
  {
    kind: "base1",
    name: "Donji sa jednim vratima",
    group: "Donji",
    width: 600,
    height: 720,
    depth: 560,
    doors: 1,
    drawers: 0,
    shelves: 1,
    rule: "Dve stranice, puno dno, dve gornje vezne letve 100 mm, HDF leđa, jedna polica; četiri nogice.",
  },
  {
    kind: "base2",
    name: "Donji sa dvoja vrata",
    group: "Donji",
    width: 800,
    height: 720,
    depth: 560,
    doors: 2,
    drawers: 0,
    shelves: 1,
    rule: "Dve stranice, dno i dve vezne letve 100 mm. Dva puna fronta; četiri ili šest nogica za širinu preko 900 mm.",
  },
  ...([2, 3, 4] as const).map((n) => ({
    kind: `drawer${n}` as ElementKind,
    name: `Fiokar sa ${n} fioke`,
    group: "Donji",
    width: 600,
    height: 720,
    depth: 560,
    doors: 0,
    drawers: n,
    shelves: 0,
    rule: `Dve stranice, dno, dve letve, HDF leđa; ${n} jednake drvene fioke. Svaka: dve stranice, dve poprečne stranice, HDF dno i jedan komplet klizača. Proveriti dimenzije prema stvarnom sistemu klizača.`,
  })),
  {
    kind: "sink",
    name: "Element za sudoperu",
    group: "Donji",
    width: 800,
    height: 720,
    depth: 560,
    doors: 2,
    drawers: 0,
    shelves: 0,
    rule: "Dve stranice, dno i dve gornje letve 100 mm. Bez leđa i polica radi instalacija. Izrezi sudopere nisu uključeni.",
  },
  {
    kind: "oven",
    name: "Element za ugradnu rernu",
    group: "Donji",
    width: 600,
    height: 720,
    depth: 560,
    doors: 0,
    drawers: 0,
    shelves: 0,
    rule: "Dve stranice, dno, jedna noseća polica, dve letve. Bez leđa, frontova i šarki. Proveriti ventilaciju i ugradni otvor rerne.",
  },
  {
    kind: "corner",
    name: "Ugaoni donji element",
    group: "Donji",
    width: 900,
    height: 720,
    depth: 900,
    doors: 1,
    drawers: 0,
    shelves: 1,
    rule: "Ugaona geometrija i mehanizmi nisu implementirani za precizan obračun.",
    unsupported: true,
  },
  {
    kind: "wall1",
    name: "Viseći sa jednim vratima",
    group: "Gornji",
    width: 600,
    height: 720,
    depth: 320,
    doors: 1,
    drawers: 0,
    shelves: 2,
    rule: "Dve stranice, puno dno i krov, dve police i HDF leđa. Vešanje i ankeri se proveravaju posebno.",
  },
  {
    kind: "wall2",
    name: "Viseći sa dvoja vrata",
    group: "Gornji",
    width: 800,
    height: 720,
    depth: 320,
    doors: 2,
    drawers: 0,
    shelves: 2,
    rule: "Puni pravougaoni korpus, dve police, HDF leđa i dva fronta.",
  },
  {
    kind: "lift",
    name: "Viseći sa podiznim frontom",
    group: "Gornji",
    width: 800,
    height: 400,
    depth: 320,
    doors: 1,
    drawers: 0,
    shelves: 1,
    rule: "Pravougaoni viseći korpus, jedan front i jedan komplet podiznog mehanizma. Nosivost proveriti prema masi fronta.",
  },
  {
    kind: "open",
    name: "Otvorena polica",
    group: "Gornji",
    width: 600,
    height: 720,
    depth: 320,
    doors: 0,
    drawers: 0,
    shelves: 2,
    rule: "Dve stranice, dno, krov, leđa i police; bez frontova i okova za otvaranje.",
  },
  {
    kind: "tall",
    name: "Visoki ormar",
    group: "Visoki",
    width: 600,
    height: 2100,
    depth: 560,
    doors: 2,
    drawers: 0,
    shelves: 4,
    rule: "Dve pune stranice, dno, krov, četiri police i leđa. Dva fronta jedan iznad drugog. Nogice uključene.",
  },
  {
    kind: "fridge",
    name: "Element za ugradni frižider",
    group: "Visoki",
    width: 600,
    height: 2100,
    depth: 560,
    doors: 2,
    drawers: 0,
    shelves: 1,
    rule: "Dno, krov i jedna noseća polica; bez leđa. Dva vertikalno podeljena fronta 60/40. Ugradne šarke aparata nisu uključene; proveriti ventilaciju i model frižidera.",
  },
  {
    kind: "tallOven",
    name: "Visoki element za rernu",
    group: "Visoki",
    width: 600,
    height: 2100,
    depth: 560,
    doors: 2,
    drawers: 0,
    shelves: 3,
    rule: "Visoki korpus bez leđa, tri police; centralni otvor za rernu 600 mm. Preostala visina podeljena na gornji i donji front.",
  },
  {
    kind: "worktop",
    name: "Radna ploča",
    group: "Dodatni",
    width: 3000,
    height: 38,
    depth: 600,
    doors: 0,
    drawers: 0,
    shelves: 0,
    rule: "Jedna ploča širina × dubina. Kantovanje vidljive prednje i dve bočne ivice; bez izreza, spojeva i zaobljenja.",
  },
  {
    kind: "side",
    name: "Završna bočna obloga",
    group: "Dodatni",
    width: 580,
    height: 820,
    depth: 18,
    doors: 0,
    drawers: 0,
    shelves: 0,
    rule: "Jedan panel širina × visina u materijalu fronta. Sve četiri ivice kantovane.",
  },
  {
    kind: "plinth",
    name: "Sokla",
    group: "Dodatni",
    width: 3000,
    height: 100,
    depth: 18,
    doors: 0,
    drawers: 0,
    shelves: 0,
    rule: "Jedan panel širina × visina u korpusnom materijalu. Sve ivice kantovane.",
  },
  {
    kind: "panel",
    name: "Dekorativni panel",
    group: "Dodatni",
    width: 600,
    height: 2100,
    depth: 18,
    doors: 0,
    drawers: 0,
    shelves: 0,
    rule: "Jedan panel širina × visina od izabranog materijala fronta, kantovan po obimu.",
  },
  {
    kind: "island",
    name: "Jednostavan ostrvski element",
    group: "Dodatni",
    width: 900,
    height: 720,
    depth: 600,
    doors: 2,
    drawers: 0,
    shelves: 1,
    rule: "Jednostavan samostalan pravougaoni element sa dvoja vrata i punim korpusnim leđima. Radna ploča dodaje se posebno.",
  },
];
const derived = (
  kind: ElementKind,
  name: string,
  group: string,
  source: ElementKind,
  options: Partial<Template> = {},
): Template => {
  const parent = legacyTemplates.find((t) => t.kind === source)!;
  return {
    ...parent,
    ...options,
    kind,
    name,
    group,
    constructionKind: options.unsupported ? undefined : source,
    rule: options.unsupported
      ? "Za ovaj tip nema posebnog konstrukcionog pravila; obračun ide po opštem modelu najbližeg tipa elementa."
      : parent.rule,
  };
};
const newTemplates: Template[] = [
  derived("base1Right", "Jedna vrata — desno", "Donji", "base1", {
    visual: { hinge: "right" },
  }),
  derived("drawer2Door", "Fiokar — 2 fioke + vrata", "Donji", "drawer2", {
    doors: 1,
    unsupported: true,
  }),
  derived("drawer3Door", "Fiokar — 3 fioke + vrata", "Donji", "drawer3", {
    doors: 1,
    unsupported: true,
  }),
  derived("sinkOne", "Sudopera — jedna vrata", "Donji", "sink", {
    width: 600,
    doors: 1,
    visual: { appliance: "sink" },
  }),
  derived("dishwasherBuilt", "Ugradna mašina za sudove", "Donji", "oven", {
    visual: { appliance: "dishwasher" },
    unsupported: true,
  }),
  derived("cornerBlind", "Ugaoni donji — slepi ugao", "Donji", "corner", {
    unsupported: true,
  }),
  derived("baseOpen", "Otvorene police", "Donji", "open", {
    height: 720,
    depth: 560,
    unsupported: true,
  }),
  derived("baseCargo", "Izvlačna korpa / cargo", "Donji", "base1", {
    width: 300,
    unsupported: true,
  }),
  derived("wall1Right", "Jedna vrata — desno", "Gornji", "wall1", {
    visual: { hinge: "right" },
  }),
  derived("liftDouble", "Dva podizna fronta", "Gornji", "lift", {
    doors: 2,
    height: 720,
    unsupported: true,
  }),
  derived("liftFolding", "Harmonika podizni front", "Gornji", "lift", {
    doors: 2,
    height: 720,
    unsupported: true,
  }),
  derived("wallGlass1", "Staklena vrata — jedna", "Gornji", "wall1", {
    visual: { glass: true },
    unsupported: true,
  }),
  derived("wallGlass2", "Staklena vrata — dvoja", "Gornji", "wall2", {
    visual: { glass: true },
    unsupported: true,
  }),
  derived("wallHood", "Element za aspirator", "Gornji", "wall1", {
    visual: { appliance: "hob" },
    unsupported: true,
  }),
  derived("wallCorner", "Ugaoni viseći", "Gornji", "wall1", {
    width: 900,
    depth: 900,
    unsupported: true,
  }),
  derived("wallBridgeFridge", "Most iznad frižidera", "Gornji", "wall2", {
    height: 400,
    shelves: 0,
  }),
  derived("wallBridgeOven", "Most iznad rerne ili nape", "Gornji", "wall2", {
    height: 400,
    shelves: 0,
  }),
  derived("tallOne", "Jedna vrata", "Visoki", "tall", { doors: 1 }),
  derived("tallDrawer", "Visoki fiokar", "Visoki", "tall", {
    doors: 0,
    drawers: 5,
    unsupported: true,
  }),
  derived("tallFreezer", "Ugradni zamrzivač", "Visoki", "fridge", {
    visual: { appliance: "fridge" },
    unsupported: true,
  }),
  derived("tallOvenMicrowave", "Rerna i mikrotalasna", "Visoki", "tallOven", {
    visual: { appliance: "oven" },
    unsupported: true,
  }),
  derived("tallCargo", "Visoki cargo", "Visoki", "tall", {
    doors: 1,
    unsupported: true,
  }),
  derived("tallPantry", "Ostava sa policama", "Visoki", "tall", {
    doors: 2,
    shelves: 5,
  }),
  derived("tallCombined", "Kombinovani ormar", "Visoki", "tall", {
    unsupported: true,
  }),
  derived("islandDrawer", "Ostrvski fiokar", "Ostrvski", "island", {
    doors: 0,
    drawers: 3,
    unsupported: true,
  }),
  derived(
    "islandBack",
    "Ostrvski element sa zadnjom oblogom",
    "Ostrvski",
    "island",
    { unsupported: true },
  ),
  derived("bar", "Šank / produžetak radne ploče", "Ostrvski", "worktop", {
    width: 1200,
    depth: 600,
    unsupported: true,
  }),
  derived("filler", "Blenda / maska", "Dodatni", "panel", { width: 100 }),
  derived("freeFridge", "Samostojeći frižider", "Dodatni", "fridge", {
    visual: { appliance: "fridge" },
    unsupported: true,
  }),
  derived("freeStove", "Samostojeći šporet", "Dodatni", "oven", {
    visual: { appliance: "oven" },
    unsupported: true,
  }),
  derived("freeDishwasher", "Samostojeća mašina za sudove", "Dodatni", "oven", {
    visual: { appliance: "dishwasher" },
    unsupported: true,
  }),
];
const verifiedReferences: Record<string, ElementKind> = {
  reference001: "base1",
  reference004: "drawer2",
  reference007: "drawer3",
  reference008: "drawer4",
  reference029: "wall1",
  reference032: "open",
  reference065: "tall",
};
const referenceTemplates: Template[] = referenceCatalog.map((record) => {
  const canonical = verifiedReferences[record.kind];
  const base = canonical
    ? legacyTemplates.find((t) => t.kind === canonical)
    : undefined;
  return {
    kind: record.kind as ElementKind,
    name: record.name,
    group: record.group,
    width: record.width,
    height: record.height,
    depth: record.depth,
    doors: record.kind === "reference062" ? 2 : record.kind === "reference065" ? 1 : (base?.doors ?? record.doors),
    drawers: base?.drawers ?? record.drawers,
    shelves:
      record.kind === "reference029" || record.kind === "reference032"
        ? 1
        : record.kind === "reference062"
          ? 5
          : record.kind === "reference065"
            ? 4
            : (base?.shelves ?? record.shelves),
    corner: record.corner,
    bridge: record.bridge,
    ...(canonical
      ? { constructionKind: canonical, rule: base!.rule }
      : {
          unsupported: true,
          rule: "Za ovaj tip nema posebnog konstrukcionog pravila; obračun ide po opštem modelu najbližeg tipa elementa.",
        }),
  };
});
export const templates: Template[] = [
  ...legacyTemplates,
  ...newTemplates,
  ...referenceTemplates,
];
export const libraryGroups = [
  "Donji",
  "Viseći",
  "Visoki",
  "Most",
  "Ostrvski",
  "Dodaci",
] as const;
const libraryKinds: Record<(typeof libraryGroups)[number], ElementKind[]> = {
  Donji: [
    "base1",
    "base1Right",
    "base2",
    "drawer2",
    "drawer3",
    "drawer4",
    "drawer2Door",
    "drawer3Door",
    "sinkOne",
    "sink",
    "oven",
    "dishwasherBuilt",
    "corner",
    "cornerBlind",
    "baseOpen",
    "baseCargo",
  ],
  Viseći: [
    "wall1",
    "wall1Right",
    "wall2",
    "lift",
    "liftDouble",
    "liftFolding",
    "wallGlass1",
    "wallGlass2",
    "open",
    "wallHood",
    "wallCorner",
  ],
  Visoki: [
    "tallOne",
    "tall",
    "tallDrawer",
    "fridge",
    "tallFreezer",
    "tallOven",
    "tallOvenMicrowave",
    "tallCargo",
    "tallPantry",
    "tallCombined",
  ],
  Most: ["wallBridgeFridge", "wallBridgeOven"],
  Ostrvski: ["island", "islandDrawer", "islandBack", "bar"],
  Dodaci: [
    "side",
    "plinth",
    "worktop",
    "panel",
    "filler",
    "freeFridge",
    "freeStove",
    "freeDishwasher",
  ],
};
const names: Partial<Record<ElementKind, string>> = {
  base1: "Jedna vrata — levo",
  base2: "Dvoja vrata",
  drawer2: "Fiokar — 2 fioke",
  drawer3: "Fiokar — 3 fioke",
  drawer4: "Fiokar — 4 fioke",
  sink: "Sudopera — dvoja vrata",
  oven: "Ugradna rerna",
  corner: "Ugaoni donji — L front",
  wall1: "Jedna vrata — levo",
  wall2: "Dvoja vrata",
  lift: "Horizontalni podizni front",
  open: "Otvorene police",
  tall: "Dvoja vrata",
  fridge: "Ugradni frižider",
  tallOven: "Ugradna rerna",
  island: "Ostrvski element sa vratima",
  side: "Završni panel",
  panel: "Zidna obloga",
  worktop: "Radna ploča",
  plinth: "Sokla",
};
export const libraryTemplates = [
  ...libraryGroups.flatMap((group) =>
    libraryKinds[group].map((kind) => ({
      ...templates.find((t) => t.kind === kind)!,
      name: names[kind] || templates.find((t) => t.kind === kind)!.name,
      group,
    })),
  ),
  ...referenceCatalog.map((record) => ({
    ...referenceTemplates.find((t) => t.kind === record.kind)!,
    group: record.bridge
      ? "Most"
      : record.libraryGroup === "Ostali"
        ? "Dodaci"
        : record.libraryGroup,
  })),
];
export function newElement(
  kind: ElementKind,
  selection = defaultSelection,
): KitchenElement {
  const t = templates.find((x) => x.kind === kind)!;
  return {
    id: uid(),
    kind,
    width: t.width,
    height:
      kind === "worktop" ? (selection.worktopThickness ?? t.height) : t.height,
    depth: t.depth,
    quantity: 1,
    doors: t.doors,
    drawers: t.drawers,
    shelves: t.shelves,
    locked: false,
    selection: { ...selection },
    extra: 0,
    note: "",
    ...(t.visual ? { visual: { ...t.visual } } : {}),
  };
}
export function demoElements(): KitchenElement[] {
  return [
    "base1",
    "drawer3",
    "drawer3",
    "sink",
    "oven",
    "wall1",
    "wall2",
    "wall1",
    "tall",
    "worktop",
  ].map((k) => newElement(k as ElementKind));
}
export function findProduct(
  prices: Product[],
  category: Category,
  tier?: Tier,
  kind?: string,
  preferred?: string,
): Product | undefined {
  const a = prices.filter(
    (p) =>
      p.active &&
      p.category === category &&
      (!tier || p.tier === tier) &&
      (!kind || p.kind === kind),
  );
  return a.find((p) => p.supplier === preferred) || a[0];
}
