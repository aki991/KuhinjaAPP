import { expect, it } from "vitest";
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
