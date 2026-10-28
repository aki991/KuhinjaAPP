import { describe, expect, it } from "vitest";
import { libraryTemplates } from "../src/core/catalog";
import { fold, matchesLibrary } from "../src/core/library-search";

const find = (q: string) => libraryTemplates.filter((t) => matchesLibrary(t, q));

describe("pretraga biblioteke elemenata", () => {
  it("frižider prikazuje frižidere, i sa kvačicama i bez njih", () => {
    const withMarks = find("frižider").map((t) => t.kind);
    expect(withMarks.length).toBeGreaterThan(1);
    expect(find("frizider").map((t) => t.kind)).toEqual(withMarks);
    expect(withMarks).toContain("fridge");
    expect(withMarks).toContain("freeFridge");
  });
  it("bela tehnika prikazuje frižidere, rerne, mašine za sudove i aspiratore", () => {
    const kinds = find("bela tehnika").map((t) => t.kind);
    for (const k of ["fridge", "oven", "dishwasherBuilt", "freeHood", "reference039"])
      expect(kinds, k).toContain(k);
    expect(kinds).not.toContain("base1");
  });
  it("napa i aspirator su isto, sudomašina i mašina za sudove su isto", () => {
    expect(find("napa").map((t) => t.kind)).toEqual(find("aspirator").map((t) => t.kind));
    expect(find("sudomašina").map((t) => t.kind)).toContain("dishwasherBuilt");
    expect(find("mašina za sudove").map((t) => t.kind)).toContain("dishwasherBuilt");
  });
  it("više reči se traži zajedno, a prazan upit prikazuje sve", () => {
    expect(find("viseći staklena").every((t) => /stakle/i.test(t.name))).toBe(true);
    expect(find("viseći staklena").length).toBeGreaterThan(0);
    expect(find("").length).toBe(libraryTemplates.length);
    expect(find("xyzxyz")).toEqual([]);
  });
  it("dj i đ se izjednačavaju", () => {
    expect(fold("Đerdap")).toBe(fold("djerdap"));
  });
});
