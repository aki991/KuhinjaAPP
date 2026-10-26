import type { Product, ProductAppearance, Selection } from "./types";
export const validColor = (s: unknown): s is string =>
  typeof s === "string" && /^#[\da-f]{6}$/i.test(s);
export function validAppearance(a: ProductAppearance | undefined) {
  return (
    !!a &&
    validColor(a.color) &&
    ["solid", "wood", "stone"].includes(a.texture) &&
    (a.image === undefined ||
      (typeof a.image === "string" &&
        a.image.length < 3_000_000 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.image)))
  );
}
export function productAppearance(p: Product | undefined): ProductAppearance {
  if (p?.appearance && validAppearance(p.appearance)) return p.appearance;
  const name = (p?.name ?? "").toLocaleLowerCase();
  if (p?.category === "handle")
    return {
      color:
        name.includes("crna") || name.includes("crno") ? "#292b29" : "#b8b9b7",
      texture: "solid",
    };
  if (p?.id === "body-white" || name.includes("beli") || name.includes("bela"))
    return { color: "#f4f1e7", texture: "solid" };
  if (name.includes("hrast") || name.includes("sonoma"))
    return { color: "#bd966b", texture: "wood" };
  if (name.includes("antracit")) return { color: "#343a38", texture: "solid" };
  if (name.includes("siva") || name.includes("sivi"))
    return { color: "#b7baba", texture: "solid" };
  return { color: "#ddcfb5", texture: "solid" };
}
export const selectionMaterials = (s: Selection): Selection =>
  s.frontMode === "body" ? { ...s, front: s.body } : { ...s };
export const productThickness = (p: Product) =>
  p.thickness ??
  (() => {
    const match = p.name.match(/(\d+)\s*mm/i);
    const n = Number(match?.[1]);
    return n > 0 && n <= 100 ? n : undefined;
  })();
