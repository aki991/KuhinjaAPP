import { expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { elevationScene } from "../src/core/elevation";
import { ensureLayout } from "../src/core/layout";
import { allTiles, floorTiles, tileById, wallTiles } from "../src/core/tiles";
import { buildScene } from "../src/components/elevation/Kitchen3DViewport";

it("10 zidnih i 10 podnih pločica, svaka sa jedinstvenim id-om", () => {
  expect(wallTiles).toHaveLength(10);
  expect(floorTiles).toHaveLength(10);
  expect(new Set(allTiles.map((t) => t.id)).size).toBe(20);
  expect(tileById("floor-terazo")?.pattern).toBe("terrazzo");
});

it("boja bele tehnike: projekat, pa izmena na elementu; ostali elementi je nemaju", () => {
  const o = createOffer();
  o.selection.applianceColor = "black";
  const fridge = newElement("freeFridge"),
    hood = newElement("freeHood"),
    cabinet = newElement("wall1");
  hood.visual = { ...hood.visual, applianceColor: "gray" };
  o.elements = [fridge, hood, cabinet];
  const entries = elevationScene(ensureLayout(o), "A").entries,
    color = (id: string) => entries.find((e) => e.id === id)!.applianceColor;
  expect(color(fridge.id)).toBe("black");
  expect(color(hood.id)).toBe("gray");
  expect(color(cabinet.id)).toBeUndefined();
});

it("3D scena se gradi sa izabranim pločicama i bojom tehnike", () => {
  const o = createOffer(true);
  o.selection = { ...o.selection, wallTile: "wall-bela-metro", floorTile: "floor-terazo", applianceColor: "gray" };
  const { bounds } = buildScene(ensureLayout(o));
  expect(bounds.isEmpty()).toBe(false);
});
