import { createOffer } from "../../src/core/db";
import { newElement } from "../../src/core/catalog";
import { defaultLayout, ensureLayout } from "../../src/core/layout";
import type { Product, VerticalGolaRule } from "../../src/core/types";
export const verticalRule = (): VerticalGolaRule => ({
  source: "Test pravilo konkretnog modela",
  profiles: 1,
  top: 20,
  bottom: 30,
  frontInset: 25,
  maxHeight: 2400,
  maxWidth: 800,
  end: "gola-end",
  ends: 2,
  components: [{ product: "other", quantity: 3, basis: "profile" }],
});
export function kitsKitchen() {
  const o = createOffer();
  o.id = "opening-kits";
  o.client.project = "Kompleti otvaranja";
  o.layout = defaultLayout("L kuhinja", 4500);
  o.elements = (["base1", "drawer3", "tall", "wall1", "wall2"] as const).map(
    (kind, i) => ({
      ...newElement(kind),
      id: `kit-${i}`,
      placement: { wall: "A", offset: 0, order: i },
    }),
  );
  const clone = (id: string, patch: Partial<Product>) => ({
    ...structuredClone(o.prices.find((p) => p.id === id)!),
    ...patch,
  });
  o.prices.push(
    clone("gola", {
      id: "vertical-test",
      name: "Vertikalni profil — test",
      verticalGolaRule: verticalRule(),
    }),
  );
  o.prices.push(
    clone("push", {
      id: "silent-test",
      name: "Potvrđeni Silent — test",
      unit: "komplet",
      pushRule: {
        ...o.prices.find((p) => p.id === "push")!.pushRule!,
        kinds: ["wall1", "wall2"],
        system: "silent",
        source: "Test dokumentacija; nije proizvodni model",
        hinges: ["hinge-premium"],
        hingesPerDoor: 2,
        components: [
          { product: "other", quantity: 1, basis: "hinge" },
          { product: "labor-cut", quantity: 1, basis: "door" },
        ],
      },
    }),
  );
  o.selection = {
    ...o.selection,
    opening: "gola",
    tallOpening: "handles",
    wallOpening: "handles",
    hinge: "hinge-premium",
  };
  return ensureLayout(o);
}
