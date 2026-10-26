export type Tier = "economy" | "standard" | "premium";
export type Category =
  | "body"
  | "front"
  | "back"
  | "worktop"
  | "edge"
  | "gola"
  | "golaEnd"
  | "handle"
  | "hinge"
  | "slide"
  | "lift"
  | "leg"
  | "push"
  | "other"
  | "labor";
export type Unit = "m²" | "m" | "kom" | "komplet" | "tabla";
export interface Product {
  id: string;
  code: string;
  name: string;
  category: Category;
  supplier: string;
  manufacturer: string;
  unit: Unit;
  price: number;
  currency: "RSD" | "EUR";
  tier?: Tier;
  kind?: string;
  active: boolean;
  note: string;
  sheetWidth?: number;
  sheetHeight?: number;
  processing?: number;
  pushRule?: PushRule;
  verticalGolaRule?: VerticalGolaRule;
}
export interface KitComponent {
  product: string;
  quantity: number;
  basis: "door" | "hinge" | "cabinet" | "profile";
}
export interface VerticalGolaRule {
  source: string;
  profiles: number;
  top: number;
  bottom: number;
  frontInset: number;
  maxHeight: number;
  maxWidth: number;
  end: string;
  ends: number;
  components: KitComponent[];
}
export interface PushRule {
  system?: "classic" | "silent";
  source?: string;
  components?: KitComponent[];
  hingesPerDoor?: number;
  lifts?: string[];
  perDoor: number;
  hinges: string[];
  kinds: ("wall1" | "wall2" | "lift" | "tall")[];
  maxHeight: number;
  maxWidth: number;
  minGap: number;
  minHeight?: number;
  minWidth?: number;
}
export interface Supplier {
  id: string;
  name: string;
  isDefault: boolean;
}
export type Opening = "handles" | "gola" | "push" | "overhang";
export type WallOpening = "handles" | "push" | "overhang";
export interface Selection {
  body: string;
  front: string;
  back: string;
  edge: string;
  worktop: string;
  hinge: string;
  slide: string;
  lift: string;
  handle: string;
  leg: string;
  gola: string;
  golaEnd: string;
  push: string;
  opening: Opening;
  wallOpening?: WallOpening;
  tallOpening?: Exclude<Opening, "overhang">;
  frontOverhang?: number;
  wallHinge?: string;
  wallPush?: string;
  wallLift?: string;
  tallHinge?: string;
  tallPush?: string;
  verticalGola?: string;
}
export type SelectionProductKey =
  | "body"
  | "front"
  | "back"
  | "edge"
  | "worktop"
  | "hinge"
  | "slide"
  | "lift"
  | "handle"
  | "leg"
  | "gola"
  | "golaEnd"
  | "push";
export type ElementKind =
  | "base1"
  | "base2"
  | "drawer2"
  | "drawer3"
  | "drawer4"
  | "sink"
  | "oven"
  | "corner"
  | "wall1"
  | "wall2"
  | "lift"
  | "open"
  | "tall"
  | "fridge"
  | "tallOven"
  | "worktop"
  | "side"
  | "plinth"
  | "panel"
  | "island";
export type LayoutRow = "base" | "wall" | "tall" | "extra";
export type LayoutLane = "base" | "wall" | "extra";
export interface Placement {
  wall: string;
  /** Derived cache for older readers. Order and widths determine the position. */
  offset: number;
  order?: number;
  row?: LayoutLane;
}
export interface LayoutSpacer {
  id: string;
  kind: "spacer";
  width: number;
  quantity: 1;
  placement: Placement;
}
export type LayoutItem = KitchenElement | LayoutSpacer;
export interface KitchenWall {
  id: string;
  name: string;
  length: number;
}
export interface KitchenLayout {
  walls: KitchenWall[];
  activeWall: string;
  version?: 3;
  spacers?: LayoutSpacer[];
  migrationNotes?: string[];
}
export interface KitchenElement {
  id: string;
  kind: ElementKind;
  width: number;
  height: number;
  depth: number;
  quantity: number;
  doors: number;
  drawers: number;
  shelves: number;
  locked: boolean;
  selection: Selection;
  extra: number;
  note: string;
  placement?: Placement;
  visual?: ElementVisual;
}
export type VisualAppliance =
  "auto" | "none" | "oven" | "sink" | "hob" | "fridge" | "dishwasher";
export interface ElementVisual {
  hinge?: "left" | "right";
  glass?: boolean;
  appliance?: VisualAppliance;
  hob?: boolean;
  offset?: number;
  bottom?: number;
}
export interface WallObject {
  id: string;
  wall: string;
  kind: "window" | "door" | "column" | "niche";
  x: number;
  width: number;
  height: number;
  bottom: number;
}
export interface ElevationConfig {
  version: 1;
  toeKick: number;
  upperGap: number;
  wallHeight: number;
  objects: WallObject[];
}
export interface Settings {
  thickness: number;
  backThickness: number;
  gap: number;
  clearance: number;
  waste: number;
  cutPrice: number;
  edgeLabor: number;
  assembly: number;
  transport: number;
  laborPerElement: number;
  margin: number;
  markup: number;
  profitMode: "margin" | "markup";
  eurRate: number;
  purchaseMode: "area" | "sheets";
  edgeMode: "front" | "all";
}
export interface Client {
  name: string;
  phone: string;
  project: string;
  location: string;
  layout: string;
}
export interface Variant {
  id: string;
  name: string;
  selection: Selection;
  elements: KitchenElement[];
  prices: Product[];
  settings: Settings;
  createdAt: string;
  layout?: KitchenLayout;
  elevation?: ElevationConfig;
}
export interface Offer {
  id: string;
  client: Client;
  elements: KitchenElement[];
  selection: Selection;
  prices: Product[];
  settings: Settings;
  variants: Variant[];
  updatedAt: string;
  createdAt: string;
  status: "draft" | "sent" | "accepted";
  templateVersion: string;
  note: string;
  demo?: boolean;
  layout?: KitchenLayout;
  elevation?: ElevationConfig;
}
export interface Panel {
  name: string;
  width: number;
  height: number;
  thickness: number;
  quantity: number;
  material: string;
  edge: number;
}
export interface Hardware {
  product: string;
  quantity: number;
  label: string;
}
export interface ElementResult {
  element: KitchenElement;
  panels: Panel[];
  hardware: Hardware[];
  materials: number;
  hardwareCost: number;
  labor: number;
  edge: number;
  area: number;
  warnings: string[];
  errors: string[];
  cost: number;
}
export interface Usage {
  product: Product;
  area: number;
  quantity: number;
  edge: number;
  cost: number;
  sheets: number;
  purchaseArea: number;
}
export interface Calculation {
  elements: ElementResult[];
  usage: Usage[];
  material: number;
  hardware: number;
  labor: number;
  assembly: number;
  transport: number;
  cost: number;
  profit: number;
  total: number;
  count: number;
  edge: number;
  area: number;
  warnings: string[];
  errors: string[];
  slideCount: number;
  hingeCount: number;
  handleCount: number;
}
export const TEMPLATE_VERSION = "1.0.0";
