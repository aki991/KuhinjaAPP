import { describe, it, expect } from "vitest";
import { dimensionChains } from "../src/components/elevation/Dimensions";
import { createOffer } from "../src/core/db";
import { newElement } from "../src/core/catalog";
import { defaultLayout, ensureLayout } from "../src/core/layout";
import { elevationScene } from "../src/core/elevation";
it("kote uskih elemenata raspoređuju čitljive brojeve u redove bez preklapanja", () => {
  const o = createOffer();
  o.layout = defaultLayout("Prava kuhinja", 2000);
  o.elements = Array.from({ length: 8 }, (_, i) => ({
    ...newElement("base1"),
    id: "n" + i,
    width: 80,
    placement: { wall: "A", offset: 0, order: i },
  }));
  const scene = elevationScene(ensureLayout(o), "A"),
    copy = structuredClone(scene),
    chain = dimensionChains(scene, 0.1);
  for (const a of scene.entries)
    for (const b of scene.entries) {
      if (
        a.key >= b.key ||
        chain.base.offsets.get(a.key) !== chain.base.offsets.get(b.key)
      )
        continue;
      expect(
        Math.abs(
          (a.rect.x + a.rect.width / 2 - b.rect.x - b.rect.width / 2) * 0.1,
        ),
      ).toBeGreaterThanOrEqual(29);
    }
  expect(chain.totalY).toBeGreaterThan(
    chain.baseY + Math.max(...chain.base.offsets.values()) + 14,
  );
  expect(scene).toEqual(copy);
});
it("kote donjeg i visećeg reda i ukupna širina imaju odvojene linije", () => {
  const o = createOffer();
  o.layout = defaultLayout("Prava kuhinja", 2000);
  o.elements = (["base1", "base2", "wall1", "wall2"] as const).map(
    (kind, i) => ({
      ...newElement(kind),
      id: "e" + i,
      placement: { wall: "A", offset: 0, order: i },
    }),
  );
  const c = dimensionChains(elevationScene(ensureLayout(o), "A"), 0.15);
  expect(c.wallY).toBeGreaterThan(
    c.baseY + Math.max(...c.base.offsets.values()) + 14,
  );
  expect(c.totalY).toBeGreaterThan(
    c.wallY + Math.max(...c.wall.offsets.values()) + 14,
  );
});
