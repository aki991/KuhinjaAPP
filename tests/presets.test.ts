import { describe, expect, it } from "vitest";
import { createOffer } from "../src/core/db";
import { demoPrices } from "../src/core/catalog";
import { siteMaterials } from "../src/core/site-materials";
import { applyPreset, presets, missingMaterials } from "../src/core/presets";
import {
  defaultLayout,
  endOf,
  ensureLayout,
  junctionReservations,
  laneOf,
  reservedLength,
} from "../src/core/layout";
import { calculateOffer } from "../src/core/engine";
import { tileById } from "../src/core/tiles";

const products = [...demoPrices, ...siteMaterials];
const shapes = [
  ["Prava kuhinja", [3200]],
  ["Prava kuhinja", [2400]],
  ["L kuhinja", [3400, 2800]],
  ["U kuhinja", [3000, 3600, 3000]],
  ["U kuhinja", [2600, 2400, 2600]],
] as const;

function offerFor(shape: string, lengths: readonly number[]) {
  const o = createOffer();
  o.client.layout = shape;
  o.layout = defaultLayout(shape);
  o.layout.walls.forEach((w, i) => (w.length = lengths[i]));
  return o;
}

it("ima 20 predloga sa jedinstvenim imenima i postojećim materijalima i pločicama", () => {
  expect(presets).toHaveLength(20);
  expect(new Set(presets.map((p) => p.name)).size).toBe(20);
  for (const p of presets) {
    expect(missingMaterials(p, products), p.name).toEqual([]);
    expect(tileById(p.wallTile), p.name).toBeTruthy();
    expect(tileById(p.floorTile), p.name).toBeTruthy();
  }
});

it("svaki predlog daje kuhinju koja staje u sve oblike prostora", () => {
  for (const preset of presets)
    for (const [shape, lengths] of shapes) {
      const out = ensureLayout(applyPreset(offerFor(shape, lengths), preset, products));
      const label = `${preset.name} ${shape} ${lengths.join("/")}`;
      expect(out.elements.length, label).toBeGreaterThan(4);
      const reservations = junctionReservations(out.elements, out.layout!);
      for (const wall of out.layout!.walls.filter((w) => w.id !== "island"))
        for (const row of ["base", "wall"] as const) {
          const lane = out.elements.filter(
            (e) => e.placement?.wall === wall.id && laneOf(e) === row,
          );
          for (const e of lane)
            expect(endOf(e), `${label} ${wall.id} ${row} ${e.kind}`).toBeLessThanOrEqual(
              wall.length - reservedLength(reservations, wall.id, row, "end") + 1,
            );
        }
      expect(out.selection.wallTile).toBe(preset.wallTile);
      expect(() => calculateOffer(out)).not.toThrow();
    }
});

it("predlog primenjuje materijale i dodaje ih u cenovnik projekta", () => {
  const preset = presets.find((p) => p.id === "kopaonik")!;
  const out = applyPreset(offerFor("U kuhinja", [3200, 3600, 3200]), preset, products);
  expect(out.selection.front).toBe("site-front-graphite-grey-2162");
  expect(out.selection.opening).toBe("gola");
  expect(out.selection.golaColor).toBe("black");
  expect(out.selection.applianceColor).toBe("black");
  expect(out.prices.some((p) => p.id === "site-worktop-bazalt")).toBe(true);
  // ostrvo samo kada ima mesta
  expect(out.layout!.walls.some((w) => w.id === "island")).toBe(true);
  expect(out.elements.every((e) => e.selection.front === out.selection.front)).toBe(true);
});

it("dvobojni predlog ima drugu boju na visećim elementima", () => {
  const preset = presets.find((p) => p.id === "dunav")!;
  const out = applyPreset(offerFor("L kuhinja", [3400, 2800]), preset, products);
  const upper = out.elements.find((e) => e.kind === "wall2" || e.kind === "wall1")!;
  const lower = out.elements.find((e) => e.kind === "drawer3")!;
  expect(upper.selection.front).toBe("site-front-diamond-white-1570");
  expect(lower.selection.front).toBe("site-front-graphite-grey-2162");
});

it("aspirator je iznad ploče za kuvanje", () => {
  const preset = presets.find((p) => p.id === "tara")!;
  const out = ensureLayout(applyPreset(offerFor("Prava kuhinja", [3600]), preset, products));
  const oven = out.elements.find((e) => e.kind === "oven")!;
  const hood = out.elements.find((e) => e.kind === "reference039")!;
  expect(hood.placement!.offset).toBeCloseTo(oven.placement!.offset, -1);
});

it("pregled svakog predloga se crta za sve zidove", async () => {
  const { elevationScene } = await import("../src/core/elevation");
  for (const preset of presets) {
    const out = applyPreset(offerFor("U kuhinja", [3000, 3600, 3000]), preset, products);
    for (const wall of out.layout!.walls)
      expect(() => elevationScene(out, wall.id), preset.name).not.toThrow();
  }
});

describe("logika slaganja predloga", () => {
  const lengths = [2400, 2700, 3000, 3200, 3600, 4200];
  const cases: [string, number[]][] = [];
  for (const a of lengths) cases.push(["Prava kuhinja", [a]]);
  for (const a of lengths) for (const b of lengths) cases.push(["L kuhinja", [a, b]]);
  for (const a of [2400, 3000, 3600]) for (const b of lengths) for (const c of [2400, 3000, 3600])
    cases.push(["U kuhinja", [a, b, c]]);

  it("ugaoni element je poslednji na zidu i stoji uz sam ugao; nema preklapanja ni upozorenja", { timeout: 60000 }, async () => {
    const { elevationScene } = await import("../src/core/elevation");
    const { kitchenPlan } = await import("../src/core/top-view");
    for (const preset of presets)
      for (const [shape, ls] of cases) {
        const out = ensureLayout(applyPreset(offerFor(shape, ls), preset, products));
        const label = `${preset.name} ${shape} ${ls.join("/")}`;
        const walls = out.layout!.walls.filter((w) => w.id !== "island");
        walls.forEach((wall, i) => {
          const base = out.elements
            .filter((e) => e.placement?.wall === wall.id && laneOf(e) === "base")
            .sort((a, b) => a.placement!.offset - b.placement!.offset);
          const corners = base.filter((e) => e.kind === "reference014");
          if (i < walls.length - 1) {
            expect(corners, label).toHaveLength(1);
            expect(base.at(-1)!.kind, label).toBe("reference014");
            expect(endOf(base.at(-1)!), label).toBe(wall.length);
          } else expect(corners, label).toHaveLength(0);
          for (let k = 1; k < base.length; k++)
            expect(base[k].placement!.offset, label).toBeGreaterThanOrEqual(endOf(base[k - 1]));
          // frižider i ostava nikad nisu uz ugao
          for (const tall of base.filter((e) => ["fridge", "tallPantry"].includes(e.kind))) {
            const next = base[base.indexOf(tall) + 1];
            expect(next?.kind, label).not.toBe("reference014");
          }
          expect(elevationScene(out, wall.id).warnings, label).toEqual([]);
          // zid koji skreće u sledeći završava visećim slepim ugaonim, uz sam ugao
          const uppers = out.elements
            .filter((e) => e.placement?.wall === wall.id && laneOf(e) === "wall")
            .sort((a, b) => a.placement!.offset - b.placement!.offset);
          if (i < walls.length - 1 && preset.upper !== "minimal" && uppers.length) {
            expect(uppers.at(-1)!.kind, label).toBe("reference035");
            expect(endOf(uppers.at(-1)!), label).toBe(wall.length);
          }
          // viseći elementi dva zida se ne sudaraju u uglu
          if (i > 0) {
            const upper = (id: string) =>
              out.elements
                .filter((e) => e.placement?.wall === id && laneOf(e) === "wall")
                .sort((a, b) => a.placement!.offset - b.placement!.offset);
            const prevEnd = Math.max(0, ...upper(walls[i - 1].id).map(endOf));
            const first = upper(wall.id)[0];
            if (first && prevEnd >= walls[i - 1].length - 5)
              expect(first.placement!.offset, label).toBeGreaterThanOrEqual(320);
          }
        });
        const warnings = kitchenPlan(out, "all").warnings.filter((w) => !w.startsWith("Ostrvo"));
        expect(warnings, label).toEqual([]);
        const isSink = (k: string) => k === "sink" || k === "sinkOne";
        expect(out.elements.some((e) => isSink(e.kind)), `${label} sudopera`).toBe(true);
        for (const kind of ["oven", "fridge"])
          expect(out.elements.some((e) => e.kind === kind), `${label} ${kind}`).toBe(true);
        // sudopera i ploča nisu na istom zidu kada ima više zidova
        if (walls.length > 1) {
          const sink = out.elements.find((e) => isSink(e.kind))!,
            oven = out.elements.find((e) => e.kind === "oven")!;
          expect(sink.placement!.wall, label).not.toBe(oven.placement!.wall);
        }
      }
  });
});
