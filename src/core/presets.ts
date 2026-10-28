import { newElement } from "./catalog";
import {
  appendPlacement,
  blockedSpans,
  defaultLayout,
  connectedWalls,
  endOf,
  isSpacer,
  junctionReservations,
  laneOf,
  reservedLength,
  newSpacer,
  packLayout,
} from "./layout";
import { productThickness } from "./appearance";
import type {
  ElementKind,
  GolaColor,
  KitchenElement,
  KitchenLayout,
  LayoutLane,
  Offer,
  Opening,
  Product,
  Selection,
  WallOpening,
} from "./types";

/** Ready-made kitchens a fitter can suggest to a customer who does not know what they want. */
export interface FrontLook {
  front: string;
  frontMode?: "separate" | "body" | "ral";
  /** Lacquered fronts in a RAL colour. */
  ralColor?: string;
  ralCode?: string;
  body?: string;
}
export interface Preset extends FrontLook {
  id: string;
  name: string;
  style: string;
  description: string;
  body: string;
  worktop: string;
  /** Handle article (also used for wall cabinets); GOLA and push presets leave it as a spare. */
  handle: string;
  opening: Opening;
  wallOpening: WallOpening;
  golaColor?: GolaColor;
  applianceColor: GolaColor;
  wallTile: string;
  floorTile: string;
  /** Another colour for the wall cabinets (two-tone kitchens). */
  upperLook?: FrontLook;
  base: "drawers" | "doors" | "mixed";
  upper: "full" | "open" | "glass" | "minimal";
  hood: "cabinet" | "free";
  island?: boolean;
}

const W = (id: string) => `site-worktop-${id}`;
const H = (id: string) => `site-handle-${id}`;
const B = (id: string) => `site-body-${id}`;
const F = (id: string) => `site-front-${id}`;
const lacquer = "front-lacquer";
const bronze = H("285-13b-128-5-bronze");

export const presets: Preset[] = [
  {
    id: "tara",
    name: "Tara",
    style: "Skandinavska",
    description:
      "Bele fronte i topla svetla hrastova ploča, crne ručke. Svetla, mirna kuhinja koja odgovara skoro svakom prostoru.",
    body: B("bela"),
    front: F("diamond-white-1570"),
    worktop: W("amber-hrast"),
    handle: H("466-43-128-crno"),
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-bela-metro",
    floorTile: "floor-hrast-parket",
    base: "drawers",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "kopaonik",
    name: "Kopaonik",
    style: "Moderna tamna",
    description:
      "Grafit fronte bez ručki (GOLA), tamna kamena ploča i crna bela tehnika. Sa ostrvom kada ima mesta.",
    body: B("antracit"),
    front: F("graphite-grey-2162"),
    worktop: W("bazalt"),
    handle: H("466-43-128-crno"),
    opening: "gola",
    wallOpening: "push",
    golaColor: "black",
    applianceColor: "black",
    wallTile: "wall-crni-mat",
    floorTile: "floor-antracit-60",
    base: "drawers",
    upper: "minimal",
    hood: "free",
    island: true,
  },
  {
    id: "zlatibor",
    name: "Zlatibor",
    style: "Rustik / seoska kuća",
    description:
      "Magnolija fronte, tamna drvena ploča i bronzane ručke. Topla kuhinja sa staklenim vitrinama.",
    body: B("aligator-beli"),
    front: F("magnolia-2507"),
    worktop: W("americki-kesten"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-krem-metro",
    floorTile: "floor-terakota-30",
    base: "doors",
    upper: "glass",
    hood: "cabinet",
  },
  {
    id: "fruska",
    name: "Fruška",
    style: "Topla zemlja",
    description:
      "Trufel bež fronte, smeđi korpus i drvena ploča. Prirodni, topli tonovi koji danas zamenjuju hladnu sivu.",
    body: B("aligator-sme-i"),
    front: F("truffle-beige-22860"),
    worktop: W("artwood"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-bez-mermer",
    floorTile: "floor-bez-45",
    base: "mixed",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "drina",
    name: "Drina",
    style: "Siva minimalistička",
    description:
      "Svetlosive fronte bez ručki i betonski izgled zida. Čist, moderan izgled sa slobodnom napom.",
    body: B("svetlo-siva"),
    front: F("agate-grey-2171"),
    worktop: W("atelje-svetli"),
    handle: H("361-25-160-mnil"),
    opening: "gola",
    wallOpening: "push",
    golaColor: "gray",
    applianceColor: "gray",
    wallTile: "wall-sivi-beton",
    floorTile: "floor-siva-60",
    base: "drawers",
    upper: "minimal",
    hood: "free",
  },
  {
    id: "sava",
    name: "Sava",
    style: "Bela klasika",
    description:
      "Potpuno bela kuhinja sa mermernom pločom i hrom ručkama. Vanvremenski izbor koji se uvek traži.",
    body: B("bela"),
    front: F("crystal-white-27018"),
    worktop: W("bela-andromeda"),
    handle: H("208-10-160-mcre"),
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-bela-sjajna",
    floorTile: "floor-mermer-bela",
    base: "doors",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "dunav",
    name: "Dunav",
    style: "Dvobojna: grafit i bela",
    description:
      "Donji elementi u grafitu, viseći u beloj. GOLA profili i beli zid; ostrvo kada prostor dozvoljava.",
    body: B("antracit"),
    front: F("graphite-grey-2162"),
    worktop: W("bela-dina"),
    handle: H("466-43-128-crno"),
    opening: "gola",
    wallOpening: "push",
    golaColor: "black",
    applianceColor: "black",
    wallTile: "wall-bela-metro",
    floorTile: "floor-antracit-60",
    upperLook: { front: F("diamond-white-1570"), body: B("bela") },
    base: "drawers",
    upper: "full",
    hood: "cabinet",
    island: true,
  },
  {
    id: "morava",
    name: "Morava",
    style: "Žalfija zelena",
    description:
      "Prigušena zelena (RAL 6021) sa bronzanim ručkama i svetlom pločom. Zelena je trenutno najtraženija boja posle bele.",
    body: B("bela"),
    front: lacquer,
    frontMode: "ral",
    ralColor: "#89ac76",
    ralCode: "6021",
    worktop: W("atelje-svetli"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-krem-metro",
    floorTile: "floor-hrast-parket",
    base: "mixed",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "ibar",
    name: "Ibar",
    style: "Tamnoplava",
    description:
      "Duboka plava (RAL 5011) sa belom pločom i bronzom. Elegantna kuhinja za one koji žele boju.",
    body: B("svetlo-siva"),
    front: lacquer,
    frontMode: "ral",
    ralColor: "#1a2b3c",
    ralCode: "5011",
    worktop: W("bela-andromeda"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-bela-sjajna",
    floorTile: "floor-siva-60",
    base: "mixed",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "uvac",
    name: "Uvac",
    style: "Terakota / glina",
    description:
      "Toplo crvenkasto-smeđe fronte (RAL 8004) uz krem pločice. Zemljani ton sa karakterom.",
    body: B("aligator-beli"),
    front: lacquer,
    frontMode: "ral",
    ralColor: "#8e402a",
    ralCode: "8004",
    worktop: W("atelje-svetli"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-krem-metro",
    floorTile: "floor-terakota-30",
    base: "doors",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "lim",
    name: "Lim",
    style: "Crna mat luksuz",
    description:
      "Crne mat fronte sa zlatnim (bronza) ručkama i tamnom pločom. Upečatljiva kuhinja, uz ostrvo.",
    body: B("antracit-271-kora"),
    front: F("black-2190"),
    worktop: W("bazalt"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "black",
    wallTile: "wall-crni-mat",
    floorTile: "floor-antracit-60",
    base: "drawers",
    upper: "minimal",
    hood: "free",
    island: true,
  },
  {
    id: "zlatar",
    name: "Zlatar",
    style: "Prirodni hrast",
    description:
      "Čitava kuhinja u dekoru hrasta, bez ručki. Najčešća kombinacija sa belim zidom i betonskim podom.",
    body: B("hrast-halifax-natur"),
    front: F("cashmere-27049"),
    frontMode: "body",
    worktop: W("atelje-svetli"),
    handle: H("466-43-128-crno"),
    opening: "gola",
    wallOpening: "push",
    golaColor: "black",
    applianceColor: "white",
    wallTile: "wall-bela-sjajna",
    floorTile: "floor-beton-80",
    base: "drawers",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "vlasina",
    name: "Vlasina",
    style: "Crno-beli kontrast",
    description:
      "Crni donji, beli viseći elementi i mermerna ploča. Jak kontrast koji se uvek lepo vidi.",
    body: B("antracit"),
    front: F("black-2190"),
    worktop: W("bela-andromeda"),
    handle: H("466-43-128-crno"),
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "black",
    wallTile: "wall-bela-metro",
    floorTile: "floor-siva-60",
    upperLook: { front: F("crystal-white-27018"), body: B("bela") },
    base: "drawers",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "derdap",
    name: "Đerdap",
    style: "Industrijska",
    description:
      "Tamnosive fronte, betonski izgled, čelične ručke i otvorene police. Loft izgled.",
    body: B("antracit"),
    front: F("basalt-2166"),
    worktop: W("bakar-oksid"),
    handle: H("326-15-160-mcre"),
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "black",
    wallTile: "wall-sivi-beton",
    floorTile: "floor-beton-80",
    base: "mixed",
    upper: "open",
    hood: "free",
  },
  {
    id: "stara-planina",
    name: "Stara planina",
    style: "Skandi sa hrastom",
    description:
      "Kašmir fronte na korpusu od hrasta sonoma, ploča u drvetu. Mirna, prirodna kuhinja.",
    body: B("hrast-sonoma"),
    front: F("cashmere-27049"),
    worktop: W("artwood"),
    handle: H("361-25-160-mnil"),
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-krem-metro",
    floorTile: "floor-hrast-parket",
    base: "mixed",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "rtanj",
    name: "Rtanj",
    style: "Mermer i bela",
    description:
      "Bele fronte bez ručki, bela mermerna ploča i mermer na podu. Luksuzan, svetao izgled sa ostrvom.",
    body: B("bela"),
    front: F("crystal-white-27018"),
    worktop: W("bela-andromeda"),
    handle: H("208-10-128-cr"),
    opening: "gola",
    wallOpening: "push",
    golaColor: "white",
    applianceColor: "white",
    wallTile: "wall-bez-mermer",
    floorTile: "floor-mermer-bela",
    base: "drawers",
    upper: "minimal",
    hood: "free",
    island: true,
  },
  {
    id: "golija",
    name: "Golija",
    style: "Šampanj elegancija",
    description:
      "Šampanj fronte sa staklenim vitrinama i bronzanim ručkama. Svečan, topao izgled.",
    body: B("aligator-beli"),
    front: F("champagne-27045"),
    worktop: W("atelje-svetli"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-krem-metro",
    floorTile: "floor-bez-45",
    base: "doors",
    upper: "glass",
    hood: "cabinet",
  },
  {
    id: "divcibare",
    name: "Divčibare",
    style: "Planinska brvnara",
    description:
      "Tamni orah, magnolija fronte i terakota na zidu. Topla planinska kuhinja sa otvorenim policama.",
    body: B("admiral-orah"),
    front: F("magnolia-2507"),
    worktop: W("americki-kesten"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-terakota-sest",
    floorTile: "floor-orah-parket",
    base: "doors",
    upper: "open",
    hood: "cabinet",
  },
  {
    id: "sar-planina",
    name: "Šar planina",
    style: "Plava i drvo",
    description:
      "Tamnoplavi donji elementi i beli viseći, uz svetlu drvenu ploču. Svež i živ izgled.",
    body: B("bela"),
    front: lacquer,
    frontMode: "ral",
    ralColor: "#1a2b3c",
    ralCode: "5011",
    worktop: W("amber-hrast"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-bela-sjajna",
    floorTile: "floor-hrast-parket",
    upperLook: { front: F("diamond-white-1570"), body: B("bela") },
    base: "mixed",
    upper: "full",
    hood: "cabinet",
  },
  {
    id: "sokobanja",
    name: "Sokobanja",
    style: "Retro menta",
    description:
      "Pastelna menta fronte, zelene pločice i zlatne ručke. Vedra kuhinja u retro duhu.",
    body: B("bela"),
    front: lacquer,
    frontMode: "ral",
    ralColor: "#b7d9b1",
    ralCode: "6019",
    worktop: W("bela-dina"),
    handle: bronze,
    opening: "handles",
    wallOpening: "handles",
    applianceColor: "white",
    wallTile: "wall-zeleni-zelij",
    floorTile: "floor-sestougao-crno-bela",
    base: "doors",
    upper: "full",
    hood: "cabinet",
  },
];

export const presetById = (id: string | undefined) =>
  presets.find((p) => p.id === id);

/** "Ugaoni slepi" from the catalogue: the first cabinet of the wall that leaves the corner. */
const CORNER_KIND = "reference014" as ElementKind,
  CORNER_WIDTH = 1050,
  /** Depth of that cabinet: the previous wall gives up this much at its end. */
  CORNER_DEPTH = 560,
  MIN = 300,
  MAX = 900;
type Slot = {
  kind?: ElementKind;
  width?: number;
  flex?: boolean;
  /** Lower numbers are dropped first when the wall is too short. */
  priority: number;
};
const fixed = (kind: ElementKind, width: number, priority: number): Slot => ({
  kind,
  width,
  priority,
});
const flexSlot = (): Slot => ({ flex: true, priority: 0 });

/**
 * Which cabinets go on which wall: the longest wall gets the sink, the next one the hob, the rest the
 * fridge. The run of flexible cabinets takes whatever length remains.
 */
function plans(lengths: number[]): Slot[][] {
  const count = lengths.length,
    fridge = () => fixed("fridge", 600, 3),
    sink = () => fixed("sink", 800, 9),
    dish = () => fixed("dishwasherBuilt", 600, 2),
    oven = () => fixed("oven", 600, 9),
    pantry = () => fixed("tallPantry", 600, 1),
    corner = () => fixed(CORNER_KIND, CORNER_WIDTH, 8);
  const room = lengths.map(
    (length, i) =>
      length - (i > 0 ? CORNER_WIDTH : 0) - (i < count - 1 ? CORNER_DEPTH : 0),
  );
  const rank = lengths.map((_, i) => i).sort((x, y) => room[y] - room[x]);
  const zone: Slot[][] = lengths.map(() => []);
  if (count === 1)
    zone[0] = [
      fridge(),
      flexSlot(),
      sink(),
      dish(),
      flexSlot(),
      oven(),
      flexSlot(),
      ...(lengths[0] >= 3600 ? [pantry()] : []),
    ];
  else {
    const [main, second, third] = rank;
    zone[main] = [flexSlot(), sink(), dish(), flexSlot()];
    zone[second] = [flexSlot(), oven(), flexSlot()];
    if (count === 2) zone[main].unshift(fridge());
    else zone[third] = [fridge(), flexSlot()];
    // A tall pantry stands at the free end of the first or last wall.
    const pantryWall = count === 2 ? second : zone[third].length ? third : second;
    if (pantryWall === 0) zone[pantryWall].unshift(pantry());
    else if (pantryWall === count - 1) zone[pantryWall].push(pantry());
  }
  return zone.map((list, i) => (i > 0 ? [corner(), ...list] : list));
}

/** Widths for one run of flexible cabinets, as even as possible between 300 and 900 mm. */
function runWidths(total: number) {
  const n = Math.max(1, Math.ceil(total / MAX)),
    each = Math.floor(total / n),
    widths = Array<number>(n).fill(each);
  widths[n - 1] += total - each * n;
  return widths;
}

function baseKind(style: Preset["base"], index: number, width: number) {
  const cycle: Record<Preset["base"], ElementKind[]> = {
    drawers: ["drawer3", "drawer3", "base2"],
    doors: ["base2", "drawer3", "base2"],
    mixed: ["drawer3", "base2", "drawer2"],
  };
  let kind = cycle[style][index % 3];
  if (kind === "base2" && width <= 600) kind = "base1";
  return kind;
}

function upperKind(style: Preset["upper"], index: number, width: number) {
  if (style === "open" && index % 3 === 1) return "open" as ElementKind;
  if (style === "glass" && index % 2 === 1)
    return (width >= 700 ? "wallGlass2" : "wallGlass1") as ElementKind;
  return (width >= 700 ? "wall2" : "wall1") as ElementKind;
}

function lookFor(preset: Preset, upper: boolean): FrontLook {
  return upper && preset.upperLook ? preset.upperLook : preset;
}

/**
 * Builds the kitchen of a preset for the walls of the offer: cabinets sized to the wall lengths,
 * the preset's materials, tiles and white goods. Existing cabinets are replaced; wall objects stay.
 */
export function applyPreset(
  offer: Offer,
  preset: Preset,
  products: Product[] = [],
): Offer {
  const known = new Map<string, Product>();
  for (const p of [...products, ...offer.prices]) known.set(p.id, p);
  const missing = new Set<string>();
  const need = (id: string | undefined, fallback: string) => {
    if (id && known.has(id)) return id;
    if (id) missing.add(id);
    return fallback;
  };
  const prev = offer.selection;
  const selection: Selection = {
    ...prev,
    body: need(preset.body, prev.body),
    front: need(preset.front, prev.front),
    frontMode: preset.frontMode ?? "separate",
    ralColor: preset.ralColor,
    ralCode: preset.ralCode,
    worktop: need(preset.worktop, prev.worktop),
    handle: need(preset.handle, prev.handle),
    wallHandle: need(preset.handle, prev.handle),
    opening: preset.opening,
    wallOpening: preset.wallOpening,
    tallOpening: "handles",
    golaColor: preset.golaColor ?? prev.golaColor,
    applianceColor: preset.applianceColor,
    wallTile: preset.wallTile,
    floorTile: preset.floorTile,
  };
  const worktop = known.get(selection.worktop),
    thickness = worktop ? productThickness(worktop) : undefined;
  if (thickness) selection.worktopThickness = thickness;
  const prices = [...offer.prices];
  for (const id of [
    selection.body,
    selection.front,
    selection.worktop,
    selection.handle,
    preset.upperLook?.front,
    preset.upperLook?.body,
  ]) {
    const product = id ? known.get(id) : undefined;
    if (product && !prices.some((p) => p.id === product.id))
      prices.push(structuredClone(product));
  }
  const upperSelection = (): Selection => {
    const look = lookFor(preset, true);
    if (look === preset) return selection;
    return {
      ...selection,
      front: need(look.front, selection.front),
      body: need(look.body ?? preset.body, selection.body),
      frontMode: look.frontMode ?? "separate",
      ralColor: look.ralColor,
      ralCode: look.ralCode,
    };
  };

  const base = structuredClone({ ...offer, prices, selection });
  const walls = connectedWalls(
      base.layout ?? defaultLayout("Prava kuhinja"),
    ).slice(0, 3),
    layout: KitchenLayout = {
      ...(base.layout ?? { activeWall: "A" }),
      walls: [...walls],
      activeWall: walls.some((w) => w.id === base.layout?.activeWall)
        ? base.layout!.activeWall
        : walls[0].id,
      version: 3,
      spacers: [],
      islandPosition: undefined,
    } as KitchenLayout;
  const elements: KitchenElement[] = [],
    flexible = new Set<string>(),
    orders = new Map<string, number>();
  const place = (wall: string, el: KitchenElement) => {
    const lane = laneOf(el),
      key = `${wall}:${lane}`,
      order = orders.get(key) ?? 0;
    orders.set(key, order + 1);
    el.placement = { wall, row: lane, order, offset: 0 };
    elements.push(el);
    return el;
  };
  const make = (kind: ElementKind, width: number, upper = false) => {
    const el = newElement(kind, upper ? upperSelection() : selection);
    el.width = width;
    return el;
  };

  // Lower cabinets and tall cabinets, wall by wall.
  const slots = plans(walls.map((w) => w.length));
  let runIndex = 0;
  walls.forEach((wall, i) => {
    const available = wall.length - (i < walls.length - 1 ? CORNER_DEPTH : 0);
    let list = [...(slots[i] ?? [])];
    const total = () =>
      list.reduce((sum, s) => sum + (s.flex ? 0 : (s.width ?? 0)), 0);
    while (total() > available) {
      const least = list
        .filter((s) => !s.flex)
        .sort((a, b) => a.priority - b.priority)[0];
      if (!least) break;
      list = list.filter((s) => s !== least);
    }
    let flexSlots = list.filter((s) => s.flex);
    let share = flexSlots.length
      ? (available - total()) / flexSlots.length
      : 0;
    while (flexSlots.length && share < MIN) {
      const last = flexSlots.at(-1)!;
      list = list.filter((s) => s !== last);
      flexSlots = flexSlots.slice(0, -1);
      share = flexSlots.length ? (available - total()) / flexSlots.length : 0;
    }
    for (const slot of list) {
      if (slot.flex) {
        const widths = runWidths(Math.floor(share));
        widths.forEach((w, j) => {
          const el = place(
            wall.id,
            make(baseKind(preset.base, runIndex + j, w), w),
          );
          flexible.add(el.id);
        });
        runIndex += widths.length;
      } else place(wall.id, make(slot.kind!, slot.width!));
    }
  });

  // One worktop per wall, as long as its base cabinets.
  const underWorktop = (e: KitchenElement) =>
    laneOf(e) === "base" &&
    [
      "base1",
      "base2",
      "drawer2",
      "drawer3",
      "sink",
      "oven",
      "dishwasherBuilt",
      "cornerBlind",
    ].includes(e.kind);
  let work: Offer = {
    ...base,
    elements,
    layout,
  };
  for (const wall of walls)
    if (elements.some((e) => e.placement?.wall === wall.id && underWorktop(e))) {
      const top = newElement("worktop", selection);
      top.autoTopFor = wall.id;
      top.placement = appendPlacement(elements, top, wall.id, layout);
      elements.push(top);
    }
  work = { ...work, ...packLayout(work.elements, layout, work.elevation) };

  // Wall cabinets fill the free stretches between tall cabinets and wall objects.
  const spacers = layout.spacers!;
  const wallOrders = new Map<string, number>();
  const placeUpper = (
    wallId: string,
    el: KitchenElement | ReturnType<typeof newSpacer>,
  ) => {
    const order = wallOrders.get(wallId) ?? 0;
    wallOrders.set(wallId, order + 1);
    el.placement = { wall: wallId, row: "wall", order, offset: 0 };
    const run = upperRuns.get(wallId) ?? [];
    upperRuns.set(wallId, run);
    run.push({
      width: el.width,
      spacer: isSpacer(el),
      depth: isSpacer(el) ? 0 : el.depth,
    });
    if (isSpacer(el)) spacers.push(el);
    else work.elements.push(el);
  };
  /**
   * The next wall gives up the depth of the last wall cabinet when the cabinets of a wall add up to
   * (nearly) its length; this is the same rule the layout applies, so both agree on the start.
   */
  const upperRuns = new Map<string, { width: number; spacer: boolean; depth: number }[]>();
  const reserved = new Map<string, number>();
  const reservationAt = (wallId: string): number => {
    const index = walls.findIndex((w) => w.id === wallId);
    if (index <= 0) return 0;
    const before = walls[index - 1],
      run = upperRuns.get(before.id) ?? [],
      last = run.at(-1);
    if (!last || last.spacer) return 0;
    const used = (reserved.get(before.id) ?? 0) + run.reduce((a, r) => a + r.width, 0);
    return used > before.length - 320 || used >= before.length ? last.depth : 0;
  };
  walls.forEach((wall) => {
    const items = [...work.elements, ...spacers],
      blocks = blockedSpans(items, wall.id, "wall", work.elevation),
      start = reservationAt(wall.id);
    reserved.set(wall.id, start);
    const segments: { a: number; b: number }[] = [];
    let cursor = start;
    for (const s of blocks) {
      if (s.start > cursor) segments.push({ a: cursor, b: Math.min(s.start, wall.length) });
      cursor = Math.max(cursor, s.end);
    }
    if (cursor < wall.length) segments.push({ a: cursor, b: wall.length });
    const oven = work.elements.find(
      (e) => e.placement?.wall === wall.id && e.kind === "oven",
    );
    // The hood goes over the hob; near a tall cabinet or a window it slides sideways to fit.
    const centre = oven ? oven.placement!.offset + oven.width / 2 : undefined;
    const home =
      centre === undefined
        ? undefined
        : segments.find((g) => centre >= g.a && centre <= g.b);
    const hoodWidth = home
      ? Math.min(preset.hood === "free" ? 900 : 600, Math.floor(home.b - home.a))
      : 0;
    const hoodX = home
      ? Math.round(
          Math.min(Math.max(centre! - hoodWidth / 2, home.a), home.b - hoodWidth),
        )
      : undefined;
    let index = 0;
    for (const { a, b } of segments) {
      const hasHood = !!home && hoodWidth >= 400 && a === home.a;
      const parts: { from: number; to: number; hood?: boolean }[] = hasHood
        ? [
            { from: a, to: hoodX! },
            { from: hoodX!, to: hoodX! + hoodWidth, hood: true },
            { from: hoodX! + hoodWidth, to: b },
          ]
        : [{ from: a, to: b }];
      for (const part of parts) {
        const len = Math.round(part.to - part.from);
        if (part.hood) {
          placeUpper(
            wall.id,
            make(
              preset.hood === "free" && len >= 700 ? "freeHood" : ("reference039" as ElementKind),
              len,
              true,
            ),
          );
          continue;
        }
        if (len <= 0) continue;
        if (preset.upper === "minimal" || len < 250) {
          // Leave the stretch empty, but keep the hood where it belongs.
          if (hasHood && len > 0) placeUpper(wall.id, newSpacer(wall.id, "wall", len));
          continue;
        }
        runWidths(len).forEach((w) => {
          const el = make(upperKind(preset.upper, index++, w), w, true);
          placeUpper(wall.id, el);
          flexible.add(el.id);
        });
      }
    }
  });
  work = {
    ...work,
    ...packLayout(work.elements, { ...layout, spacers }, work.elevation),
  };

  // Island for kitchens that can take one.
  if (preset.island && walls.length >= 2 && Math.min(...walls.map((w) => w.length)) >= 3000) {
    work.layout!.walls.push({ id: "island", name: "Ostrvo", length: 2700 });
    for (const kind of ["islandDrawer", "islandDrawer", "islandBack"] as const) {
      const el = make(kind, 900);
      el.placement = appendPlacement(work.elements, el, "island", work.layout!);
      work.elements.push(el);
    }
  }

  // Trim whatever still sticks out past a wall (short walls, objects in the way).
  for (let guard = 0; guard < 40; guard++) {
    let changed = false;
    const reservations = junctionReservations(work.elements, work.layout!);
    for (const wall of walls)
      for (const row of ["base", "wall"] as const) {
        const lane = work.elements
          .filter((e) => e.placement?.wall === wall.id && laneOf(e) === row)
          .sort((a, b) => a.placement!.offset - b.placement!.offset);
        const last = lane.at(-1);
        if (!last) continue;
        const over =
          endOf(last) - (wall.length - reservedLength(reservations, wall.id, row, "end"));
        if (over <= 0) continue;
        const target = [...lane]
          .reverse()
          .find((e) => flexible.has(e.id) && e.width - over >= MIN);
        if (target) target.width -= over;
        else work.elements = work.elements.filter((e) => e !== last);
        work = { ...work, ...packLayout(work.elements, work.layout!, work.elevation) };
        changed = true;
      }
    if (!changed) break;
  }
  return {
    ...work,
    selection,
    prices,
    updatedAt: new Date().toISOString(),
  };
}

/** Product ids a preset needs that neither the project nor the price list has. */
export function missingMaterials(preset: Preset, known: Product[]) {
  const ids = [
    preset.body,
    preset.front,
    preset.worktop,
    preset.handle,
    preset.upperLook?.front,
    preset.upperLook?.body,
  ].filter((id): id is string => !!id);
  return ids.filter((id) => !known.some((p) => p.id === id));
}
