/** Room tiles for the visual simulation. They carry no price: they only help to judge the kitchen colours. */
export type TilePattern =
  | "grid"
  | "subway"
  | "hex"
  | "marble"
  | "terrazzo"
  | "planks"
  | "zellige"
  | "mosaic"
  | "concrete";

export interface Tile {
  id: string;
  name: string;
  area: "wall" | "floor";
  pattern: TilePattern;
  /** Main colour of the tile. */
  color: string;
  /** Second colour: veins, chips, grain or colour variation. */
  accent: string;
  grout: string;
  /** Tile size in mm (planks: width × length). */
  width: number;
  height: number;
}

const t = (
  id: string,
  name: string,
  area: Tile["area"],
  pattern: TilePattern,
  color: string,
  accent: string,
  grout: string,
  width: number,
  height: number,
): Tile => ({ id, name, area, pattern, color, accent, grout, width, height });

export const wallTiles: Tile[] = [
  t("wall-bela-metro", "Bela metro 10 × 20", "wall", "subway", "#f4f3ef", "#e6e4dd", "#cfcdc4", 100, 200),
  t("wall-bela-sjajna", "Bela sjajna 20 × 20", "wall", "grid", "#f7f7f5", "#e9e9e5", "#d4d4cf", 200, 200),
  t("wall-krem-metro", "Krem metro 7,5 × 15", "wall", "subway", "#ebdcc0", "#dccaa5", "#c8b995", 75, 150),
  t("wall-zeleni-zelij", "Zeleni zelij 10 × 10", "wall", "zellige", "#3f7a63", "#6aa88c", "#2c5848", 100, 100),
  t("wall-plavi-zelij", "Plavi zelij 10 × 10", "wall", "zellige", "#2f6f9c", "#6ea5cc", "#234f6e", 100, 100),
  t("wall-sivi-beton", "Sivi beton 60 × 60", "wall", "concrete", "#9da0a2", "#7f8386", "#8a8d90", 600, 600),
  t("wall-bez-mermer", "Bež mermer 30 × 60", "wall", "marble", "#e9dfcf", "#b9a98f", "#d6cab6", 300, 600),
  t("wall-crni-mat", "Crna mat 30 × 60", "wall", "grid", "#2c2e30", "#3a3d40", "#1a1b1c", 300, 600),
  t("wall-terakota-sest", "Terakota šestougao", "wall", "hex", "#b8643f", "#d68a62", "#8c4a2e", 150, 150),
  t("wall-mozaik-siva", "Mozaik sivi 5 × 5", "wall", "mosaic", "#8e969b", "#c3c8cb", "#6f777c", 50, 50),
];

export const floorTiles: Tile[] = [
  t("floor-hrast-parket", "Svetli hrast parket", "floor", "planks", "#c9a572", "#a8814e", "#b08d5c", 120, 900),
  t("floor-orah-parket", "Tamni orah parket", "floor", "planks", "#6d4a30", "#4c3220", "#523823", 120, 900),
  t("floor-siva-60", "Siva keramika 60 × 60", "floor", "grid", "#b4b6b6", "#a2a4a5", "#8f9192", 600, 600),
  t("floor-antracit-60", "Antracit 60 × 60", "floor", "grid", "#45494c", "#383c3e", "#26292b", 600, 600),
  t("floor-bez-45", "Bež 45 × 45", "floor", "grid", "#d8cbb2", "#cabb9f", "#b3a78f", 450, 450),
  t("floor-mermer-bela", "Bela mermerna 60 × 60", "floor", "marble", "#efeeea", "#a9adb0", "#d2d2cc", 600, 600),
  t("floor-terazo", "Terazo 60 × 60", "floor", "terrazzo", "#d9d4cb", "#8c6f5a", "#bdb7ac", 600, 600),
  t("floor-sestougao-crno-bela", "Šestougao sivo-beli", "floor", "hex", "#cfd2d3", "#6f7679", "#a3a7a9", 200, 200),
  t("floor-terakota-30", "Terakota 30 × 30", "floor", "grid", "#b4623e", "#9d532f", "#86482c", 300, 300),
  t("floor-beton-80", "Beton efekat 80 × 80", "floor", "concrete", "#a7a9a8", "#8b8e8d", "#8d8f8e", 800, 800),
];

export const allTiles = [...wallTiles, ...floorTiles];
export const tileById = (id: string | undefined) =>
  id ? allTiles.find((tile) => tile.id === id) : undefined;
