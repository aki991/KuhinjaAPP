/** Search in the element library: by name, group and everyday words ("frižider", "napa", "bela tehnika"). */
export const fold = (text: string) =>
  text
    .toLocaleLowerCase("sr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .trim();

/** Extra words by kind or name, so the same thing is found under any common name. */
const synonyms: { when: RegExp; words: string }[] = [
  {
    when: /frizider|zamrziv|kombinovan.*aparat|hladnjak|freefridge|^fridge$|tallfreezer/,
    words: "frizider hladnjak zamrzivac lednica bela tehnika",
  },
  {
    when: /rerna|sporet|^oven$|tallovenmicrowave|^talloven$|freestove|mikrotalas/,
    words: "rerna sporet pecnica ploca bela tehnika",
  },
  {
    when: /sudomasin|masina za sudove|dishwasher/,
    words: "sudomasina masina za sudove bela tehnika",
  },
  {
    when: /aspirator|napa|freehood|wallhood|reference03[89]/,
    words: "aspirator napa bela tehnika",
  },
  { when: /^sink|sudoper/, words: "sudopera lavabo sudoper" },
];

export function libraryText(template: { kind: string; name: string; group: string }) {
  const base = fold(`${template.name} ${template.group}`),
    kind = template.kind.toLowerCase(),
    extra = synonyms
      .filter((s) => s.when.test(base) || s.when.test(kind))
      .map((s) => s.words)
      .join(" ");
  return `${base} ${extra}`;
}

/** Every word of the query must appear somewhere in the template's text. */
export function matchesLibrary(
  template: { kind: string; name: string; group: string },
  query: string,
) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = libraryText(template);
  return words.every((w) => text.includes(w));
}
