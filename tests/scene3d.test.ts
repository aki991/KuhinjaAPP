import { expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { ensureLayout } from "../src/core/layout";
import { buildScene } from "../src/components/elevation/Kitchen3DViewport";

it("3D scena sa frižiderom, aspiratorom i dekorativnom napom se gradi", () => {
  const o = createOffer();
  o.elements = [
    newElement("fridge"),
    newElement("wall1"),
    newElement("reference038"),
    newElement("freeHood"),
  ];
  const { bounds } = buildScene(ensureLayout(o));
  expect(bounds.isEmpty()).toBe(false);
});

it("3D scena demo projekta ostaje u razumnim granicama (metri)", () => {
  const { bounds } = buildScene(ensureLayout(createOffer(true)));
  const size = bounds.getSize(new (bounds.min.constructor as any)());
  expect(Math.max(size.x, size.y, size.z)).toBeLessThan(10);
});
