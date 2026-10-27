import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { kitsKitchen } from "./fixtures/opening-kits";
import { calculateOffer } from "../src/core/engine";
import { construct } from "../src/core/construction";
import { newElement } from "../src/core/catalog";
import {
  effectiveSelection,
  validPushRule,
  validVerticalGolaRule,
} from "../src/core/opening";
import { pushKits, pushSelection } from "../src/core/opening-kits";
import { elevationScene } from "../src/core/elevation";
import WallElevation from "../src/components/elevation/WallElevation";
const quantity = (o: ReturnType<typeof kitsKitchen>, id: string) =>
  calculateOffer(o).usage.find((u) => u.product.id === id)?.quantity ?? 0;
describe("GOLA visoki i potvrđeni Push kompleti", () => {
  it.skip("komplet ne prihvata pogrešne jedinice, vrata van pravila ni aparat prikazan kao običan ormar", () => {
    const o = kitsKitchen(),
      wall = o.elements.slice(3);
    o.prices = o.prices.filter((p) => p.id !== "silent-test");
    o.prices.find((p) => p.id === "push")!.unit = "m";
    expect(pushKits(wall, o.selection, o.prices, o.settings)).toEqual([]);
    o.prices.find((p) => p.id === "push")!.unit = "kom";
    o.prices.find((p) => p.id === "hinge-economy")!.unit = "m";
    expect(pushKits(wall, o.selection, o.prices, o.settings)).toEqual([]);
    o.prices.find((p) => p.id === "hinge-economy")!.unit = "kom";
    o.prices.find((p) => p.id === "push")!.pushRule!.minWidth = 650;
    expect(pushKits(wall, o.selection, o.prices, o.settings)).toEqual([]);
    o.prices.find((p) => p.id === "push")!.pushRule!.minWidth = 0;
    wall[0].doors = 0;
    expect(pushKits(wall, o.selection, o.prices, o.settings)).toEqual([]);
    const high = o.elements[2];
    o.prices.find((p) => p.id === "push")!.pushRule!.kinds.push("tall");
    high.visual = { appliance: "oven" };
    expect(pushKits([high], o.selection, o.prices, o.settings)).toEqual([]);
  });
  it("vertikalni profil prati stvarnu visinu, završetke, nosače i suženje fronta bez promene korpusa", () => {
    const o = kitsKitchen(),
      before = calculateOffer(o);
    o.selection.tallOpening = "gola";
    o.selection.verticalGola = "vertical-test";
    const c = calculateOffer(o);
    expect(c.errors).toEqual([]);
    expect(quantity(o, "vertical-test")).toBeCloseTo(
      (o.elements[2].height - 50) / 1000,
    );
    expect(quantity(o, "other")).toBe(3);
    expect(quantity(o, "gola-end")).toBe(10); // 8 donji + 2 vertikalni
    expect(quantity(o, "gola")).toBe(2.4);
    expect(
      c.elements[2].panels.find((p) => p.name === "Front vrata 1")!.width,
    ).toBe(o.elements[2].width - 4 - 25);
    expect(
      c.elements[2].panels.filter((p) => !p.name.startsWith("Front")),
    ).toEqual(
      before.elements[2].panels.filter((p) => !p.name.startsWith("Front")),
    );
    expect(c.elements[2].hardware.some((h) => h.label === "Ručke")).toBe(false);
    expect(c.elements.slice(0, 2)).toEqual(before.elements.slice(0, 2));
  });
  it("dva profila i količina elementa množe sve komponente tačno jednom", () => {
    const o = kitsKitchen();
    o.selection.tallOpening = "gola";
    o.selection.verticalGola = "vertical-test";
    o.prices.find((p) => p.id === "vertical-test")!.verticalGolaRule!.profiles =
      2;
    o.elements[2].quantity = 2;
    expect(quantity(o, "vertical-test")).toBeCloseTo(
      (4 * (o.elements[2].height - 50)) / 1000,
    );
    expect(quantity(o, "other")).toBe(12);
    expect(quantity(o, "gola-end")).toBe(16);
  });
  it.skip("aparatni i kombinovani elementi ne nasleđuju potvrdu za običan ormar", () => {
    const o = kitsKitchen();
    o.selection.tallOpening = "gola";
    o.selection.verticalGola = "vertical-test";
    for (const kind of ["fridge", "tallOven"] as const) {
      o.elements[2] = { ...newElement(kind), id: "aparat" };
      expect(calculateOffer(o).errors.join()).toContain("Vertikalna GOLA");
    }
    o.elements[2] = { ...newElement("tall"), visual: { appliance: "oven" } };
    expect(calculateOffer(o).errors.length).toBeGreaterThan(0);
    o.selection.tallOpening = "handles";
    expect(calculateOffer(o).errors).toEqual([]);
  });
  it.skip("nepoznati profil, predugačak ormar i nedostajući delovi ostaju nepotpuni", () => {
    const o = kitsKitchen();
    o.selection.tallOpening = "gola";
    o.selection.verticalGola = "gola";
    expect(calculateOffer(o).errors.length).toBeGreaterThan(0);
    o.selection.verticalGola = "vertical-test";
    o.elements[2].height = 2500;
    expect(calculateOffer(o).errors.join()).toContain("dimenzije");
    o.elements[2].height = 2100;
    o.prices = o.prices.filter((p) => p.id !== "other");
    expect(calculateOffer(o).errors.join()).toContain("Komplet");
  });
  it("klasični komplet nudi konkretne osnovne šarke, Silent samo eksplicitno potvrđene premium", () => {
    const o = kitsKitchen(),
      wall = o.elements.slice(3),
      kits = pushKits(wall, o.selection, o.prices, o.settings);
    expect(kits.map((k) => [k.mechanism.id, k.hinge?.id])).toEqual([
      ["push", "hinge-economy"],
      ["silent-test", "hinge-premium"],
    ]);
    expect(o.selection.hinge).toBe("hinge-premium"); // predlog nije zamena
    o.prices.find((p) => p.id === "silent-test")!.pushRule!.source = "";
    expect(pushKits(wall, o.selection, o.prices, o.settings)).toHaveLength(1);
  });
  it.each(["classic", "silent"] as const)(
    "%s zamenjuje šarke, 1+2 vrata bez duplih ručki/mehanizama i obračunava dodatni rad",
    (system) => {
      const o = kitsKitchen(),
        before = calculateOffer(o),
        kit = pushKits(
          o.elements.slice(3),
          o.selection,
          o.prices,
          o.settings,
        ).find((k) => (k.mechanism.pushRule?.system ?? "classic") === system)!;
      o.selection.wallOpening = "push";
      o.selection.wallPush = kit.mechanism.id;
      o.selection.wallHinge = kit.hinge!.id;
      const c = calculateOffer(o);
      expect(c.errors).toEqual([]);
      expect(c.elements.slice(0, 3)).toEqual(before.elements.slice(0, 3));
      expect(
        c.elements
          .slice(3)
          .flatMap((e) => e.hardware)
          .filter((h) => h.label === "Šarke")
          .reduce((s, h) => s + h.quantity, 0),
      ).toBe(6);
      expect(quantity(o, kit.mechanism.id)).toBe(3);
      expect(quantity(o, system === "classic" ? "silent-test" : "push")).toBe(
        0,
      );
      expect(
        c.elements
          .slice(3)
          .flatMap((e) => e.hardware)
          .some((h) => h.label === "Ručke"),
      ).toBe(false);
      expect(c.area).toBe(before.area);
      expect(c.edge).toBe(before.edge);
      if (system === "silent") {
        expect(quantity(o, "other")).toBe(6);
        expect(c.labor - before.labor).toBe(3 * 60);
        expect(c.hardware - before.hardware).toBe(3 * 620 + 6 * 90 - 3 * 380);
        expect(c.total - before.total).toBeCloseTo(
          (3 * 620 + 6 * 90 + 3 * 60 - 3 * 380) / 0.8,
        );
      }
    },
  );
  it.skip("nepotvrđene šarke i prevelike dimenzije ne nude kompatibilan komplet", () => {
    const o = kitsKitchen();
    o.elements[3].width = 2000;
    expect(
      pushKits(o.elements.slice(3), o.selection, o.prices, o.settings),
    ).toHaveLength(0);
    o.selection.wallOpening = "push";
    expect(calculateOffer(o).errors.join()).toContain("nisu potvrđeni");
  });
  it("podizni front zahteva konkretan podizni model i obračunava se jednom", () => {
    const o = kitsKitchen(),
      lift = newElement("lift"),
      p = o.prices.find((p) => p.id === "push")!;
    expect(pushKits([lift], o.selection, o.prices, o.settings)).toEqual([]);
    p.pushRule = {
      ...p.pushRule!,
      kinds: ["lift"],
      hinges: [],
      lifts: ["lift-standard"],
      source: "Test modela podizanja",
    };
    const kit = pushKits([lift], o.selection, o.prices, o.settings)[0];
    expect(kit.lift!.id).toBe("lift-standard");
    const b = construct(
      lift,
      pushSelection(o.selection, kit),
      o.settings,
      o.prices,
    );
    expect(b.errors).toEqual([]);
    expect(
      b.hardware.filter((h) => h.label === "Podizni mehanizam"),
    ).toHaveLength(1);
    expect(
      b.hardware.some((h) => h.label === "Šarke" || h.label === "Ručke"),
    ).toBe(false);
  });
  it.skip("visoki Push poštuje dozvoljene konstrukcije i zadržava individualni izbor", () => {
    const o = kitsKitchen(),
      high = o.elements[2];
    expect(
      pushKits([high], o.selection, o.prices, o.settings).map(
        (k) => k.mechanism.id,
      ),
    ).toEqual(["push"]);
    o.prices.find((p) => p.id === "push")!.pushRule!.kinds = ["wall1", "wall2"];
    expect(pushKits([high], o.selection, o.prices, o.settings)).toEqual([]);
    o.prices.find((p) => p.id === "push")!.pushRule!.kinds.push("tall");
    const kit = pushKits([high], o.selection, o.prices, o.settings)[0];
    expect(kit).toBeDefined();
    high.locked = true;
    high.selection = pushSelection(o.selection, kit);
    o.selection.tallOpening = "gola";
    expect(effectiveSelection(high, o.selection).opening).toBe("push");
    expect(calculateOffer(o).errors).toEqual([]);
  });
  it("sudopera sa horizontalnom GOLA ima jedan profil, dva završetka, skraćene frontove i nema ručke", () => {
    const o = kitsKitchen();
    o.elements = [
      {
        ...newElement("sink"),
        quantity: 2,
        placement: { wall: "A", offset: 0, order: 0 },
      },
    ];
    const c = calculateOffer(o),
      r = c.elements[0];
    expect(c.errors).toEqual([]);
    expect(quantity(o, "gola")).toBe(1.6);
    expect(quantity(o, "gola-end")).toBe(4);
    expect(c.handleCount).toBe(0);
    expect(quantity(o, "push")).toBe(0);
    expect(
      r.panels.filter((p) => p.name.startsWith("Front vrata")),
    ).toHaveLength(2);
    expect(r.panels.find((p) => p.name === "Front vrata 1")!.height).toBe(686);
    expect(r.panels.some((p) => p.name === "Leđa" || p.name === "Polica")).toBe(
      false,
    );
    expect(
      r.panels.find((p) => p.name === "GOLA konstrukciona letva")!.quantity,
    ).toBe(1);
    expect(
      r.hardware
        .filter((h) => h.label === "Šarke")
        .reduce((s, h) => s + h.quantity, 0),
    ).toBe(4);
    const svg = renderToStaticMarkup(
      <WallElevation
        scene={elevationScene(o, "A")}
        scale={0.15}
        selected={null}
      />,
    );
    expect(svg.match(/data-gola="horizontal"/g)).toHaveLength(2);
    expect(svg).not.toContain('class="technical-handle"');
  });
  it.skip("Push za običan visoki ormar računa mehanizam po frontu bez promene materijala i korpusa", () => {
    const o = kitsKitchen();
    o.elements = [{ ...newElement("tall"), quantity: 2 }];
    const before = calculateOffer(o);
    o.selection.tallOpening = "push";
    o.selection.tallHinge = "hinge-economy";
    const c = calculateOffer(o);
    expect(c.errors).toEqual([]);
    expect(quantity(o, "push")).toBe(4);
    expect(c.handleCount).toBe(0);
    expect(c.hingeCount).toBe(12);
    expect(c.elements[0].panels).toEqual(before.elements[0].panels);
    expect(c.total - before.total).toBeCloseTo(
      (4 * 620 + 12 * 110 - 4 * 380 - 12 * 690) / 0.8,
    );
    o.elements[0].doors = 1;
    o.elements[0].height = 1800;
    expect(calculateOffer(o).errors.join()).toContain("dimenzije");
  });
  it("2D prikazuje samo podržan vertikalni profil i čuva dimenzije korpusa", () => {
    const o = kitsKitchen();
    o.selection.tallOpening = "gola";
    o.selection.verticalGola = "vertical-test";
    const scene = elevationScene(o, "A"),
      entry = scene.entries.find((e) => e.id === "kit-2")!;
    expect(entry.rect.width).toBe(o.elements[2].width);
    expect(entry.rect.height).toBe(o.elements[2].height);
    const svg = renderToStaticMarkup(
      <WallElevation scene={scene} scale={0.15} selected={null} />,
    );
    expect(svg).toContain('data-gola="vertical"');
  });
  it("nevalidna i duplirana pravila se odbijaju bez rušenja", () => {
    const o = kitsKitchen(),
      r = o.prices.find((p) => p.id === "push")!.pushRule!;
    expect(validPushRule({ ...r, components: [null] as never })).toBe(false);
    expect(
      validPushRule({
        ...r,
        components: [{ product: "other", quantity: 1, basis: "profile" }],
      }),
    ).toBe(false);
    expect(
      validPushRule({
        ...r,
        components: [
          { product: "other", quantity: 1, basis: "door" },
          { product: "other", quantity: 1, basis: "door" },
        ],
      }),
    ).toBe(false);
    expect(
      validVerticalGolaRule({
        ...o.prices.find((p) => p.id === "vertical-test")!.verticalGolaRule!,
        profiles: 0,
      }),
    ).toBe(false);
  });
});
