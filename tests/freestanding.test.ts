import { describe, expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { newElement, isFreestanding } from "../src/core/catalog";
import { calculateOffer } from "../src/core/engine";
import { ensureLayout } from "../src/core/layout";

it("samostojeći aparati se ne računaju kao korpus: bez materijala, ručki i rada", () => {
  expect(isFreestanding("freeFridge")).toBe(true);
  expect(isFreestanding("reference086")).toBe(true);
  expect(isFreestanding("fridge")).toBe(false);
  expect(isFreestanding("freeHood")).toBe(false);
  const o = createOffer();
  o.elements = [newElement("wall1")];
  const alone = calculateOffer(ensureLayout(o));
  o.elements.push(newElement("freeFridge"), newElement("reference086"));
  const withFridge = calculateOffer(ensureLayout(o));
  expect(withFridge.total).toBe(alone.total);
  expect(withFridge.usage.map((u) => [u.product.id, u.quantity])).toEqual(
    alone.usage.map((u) => [u.product.id, u.quantity]),
  );
});

it("dekorativna napa je samo simulacija: ne ulazi u cenu", () => {
  const o = createOffer();
  o.elements = [newElement("wall1")];
  const alone = calculateOffer(ensureLayout(o)).total;
  o.elements.push(newElement("freeHood"));
  expect(calculateOffer(ensureLayout(o)).total).toBe(alone);
});

import { elevationScene as sceneOf } from "../src/core/elevation";
import { ensureLayout as ensure } from "../src/core/layout";
import { createOffer as makeOffer } from "../src/core/db";
import { newElement as make } from "../src/core/catalog";

describe("samostojeći frižider ne podiže viseće elemente", () => {
  it("viseći red ostaje na istoj visini kao sa ugradnim frižiderom", () => {
    const build = (fridgeKind: "fridge" | "freeFridge") => {
      const o = makeOffer();
      o.layout = { walls: [{ id: "A", name: "Zid A", length: 3000 }], activeWall: "A", version: 3, spacers: [] };
      o.elements = [make("drawer3"), make("base1"), make(fridgeKind), make("wall1")];
      return sceneOf(ensure(o), "A");
    };
    const built = build("fridge"),
      free = build("freeFridge");
    expect(free.baseTop).toBe(built.baseTop);
    expect(free.upperBottom).toBe(built.upperBottom);
    const wall = (s: typeof free) => s.entries.find((e) => e.item.kind === "wall1")!.rect.y;
    expect(wall(free)).toBe(wall(built));
    // viseći element ne ulazi iznad frižidera
    const fridge = free.entries.find((e) => e.item.kind === "freeFridge")!;
    const upper = free.entries.find((e) => e.item.kind === "wall1")!;
    expect(upper.rect.x >= fridge.rect.x + fridge.rect.width || upper.rect.x + upper.rect.width <= fridge.rect.x).toBe(true);
  });
});
