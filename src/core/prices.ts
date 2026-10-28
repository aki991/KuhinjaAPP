import type { Offer, Product } from "./types";

/**
 * The price list is the single source of truth: a project's price snapshot is refreshed from it,
 * so a price changed in the price list is the price used when that material is chosen.
 * Items that are only in the project (not in the price list) are left alone.
 * Returns the same object when nothing changed.
 */
export function syncPrices<
  T extends { prices: Product[]; variants?: { prices: Product[] }[] },
>(project: T, products: Product[]): T {
  const byId = new Map(products.map((p) => [p.id, p]));
  const refresh = (prices: Product[]) => {
    let changed = false;
    const next = prices.map((p) => {
      const current = byId.get(p.id);
      if (!current || JSON.stringify(current) === JSON.stringify(p)) return p;
      changed = true;
      return structuredClone(current);
    });
    return changed ? next : prices;
  };
  const prices = refresh(project.prices);
  let variantsChanged = false;
  const variants = project.variants?.map((v) => {
    const next = refresh(v.prices);
    if (next === v.prices) return v;
    variantsChanged = true;
    return { ...v, prices: next };
  });
  if (prices === project.prices && !variantsChanged) return project;
  return { ...project, prices, ...(variants ? { variants } : {}) };
}

/** Only drafts follow the price list: an offer already sent or accepted keeps the price it was made at. */
export const followsPriceList = (o: Pick<Offer, "status">) =>
  o.status === "draft";
