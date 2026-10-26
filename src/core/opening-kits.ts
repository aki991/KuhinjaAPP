import { construct } from "./construction";
import { effectiveSelection, validPushRule } from "./opening";
import type { KitchenElement, Product, Selection, Settings } from "./types";
export interface PushKit {
  mechanism: Product;
  hinge?: Product;
  lift?: Product;
}
export function pushKits(
  elements: KitchenElement[],
  selection: Selection,
  products: Product[],
  settings: Settings,
): PushKit[] {
  return products
    .filter(
      (p) => p.active && p.category === "push" && validPushRule(p.pushRule),
    )
    .flatMap((mechanism) => {
      const r = mechanism.pushRule!;
      const hinges = products.filter(
        (p) => p.active && p.category === "hinge" && r.hinges.includes(p.id),
      );
      const lifts = products.filter(
        (p) => p.active && p.category === "lift" && r.lifts?.includes(p.id),
      );
      const useLift = elements.some((e) => e.kind === "lift");
      const choices: PushKit[] = useLift
        ? lifts.flatMap((lift) =>
            hinges.length
              ? hinges.map((hinge) => ({ mechanism, hinge, lift }))
              : [{ mechanism, lift }],
          )
        : hinges.map((hinge) => ({ mechanism, hinge }));
      return choices.filter(
        (k) =>
          elements.length > 0 &&
          elements.every(
            (e) =>
              !construct(
                e,
                {
                  ...effectiveSelection(e, selection),
                  opening: "push",
                  push: mechanism.id,
                  hinge: k.hinge?.id ?? selection.hinge,
                  lift: k.lift?.id ?? selection.lift,
                },
                settings,
                products,
              ).errors.length,
          ) &&
          (r.components ?? []).every((c) =>
            products.some((p) => p.id === c.product && p.active),
          ),
      );
    });
}
export function pushSelection(s: Selection, k: PushKit): Selection {
  return {
    ...s,
    opening: "push",
    push: k.mechanism.id,
    hinge: k.hinge?.id ?? s.hinge,
    lift: k.lift?.id ?? s.lift,
  };
}
