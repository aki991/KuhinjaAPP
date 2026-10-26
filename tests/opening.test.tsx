import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createOffer } from "../src/core/db";
import {
  newElement,
  defaults,
  demoPrices,
  defaultSelection,
} from "../src/core/catalog";
import { calculateOffer } from "../src/core/engine";
import { construct } from "../src/core/construction";
import { defaultLayout, ensureLayout, newSpacer } from "../src/core/layout";
import {
  effectiveSelection,
  ensureOpenings,
  wallFrontHeight,
} from "../src/core/opening";
import { elevationScene } from "../src/core/elevation";
import WallElevation from "../src/components/elevation/WallElevation";
import type { WallOpening } from "../src/core/types";
function kitchen(mode: WallOpening = "handles") {
  const o = createOffer();
  o.layout = defaultLayout("L kuhinja", 4000);
  o.elements = (["base1", "drawer3", "wall1", "wall2", "wall1"] as const).map(
    (kind, i) => ({
      ...newElement(kind),
      id: `e${i}`,
      placement: { wall: "A", offset: 0, order: i },
    }),
  );
  o.selection = {
    ...o.selection,
    opening: "gola",
    wallOpening: mode,
    tallOpening: "handles",
    wallHinge: "hinge-economy",
    frontOverhang: 20,
  };
  return ensureLayout(o);
}
describe("Nezavisno otvaranje donjih, visećih i visokih", () => {
  it("GOLA donji + fiokar + tri viseća imaju kompletan obračun i 4 ručke", () => {
    const o = kitchen(),
      c = calculateOffer(o);
    expect(c.errors).toEqual([]);
    expect(c.handleCount).toBe(4);
    expect(c.hingeCount).toBe(10); // 2 base + 8 upper
    expect(c.usage.find((u) => u.product.id === "gola")!.quantity).toBeCloseTo(
      2.4,
    );
    expect(c.usage.find((u) => u.product.id === "gola-end")!.quantity).toBe(8);
    expect(c.usage.find((u) => u.product.id === "push")).toBeUndefined();
  });
  it("push ima 1 mehanizam po vratima, bez ručki, i ne menja frontove ni GOLA profile", () => {
    const a = calculateOffer(kitchen("handles")),
      b = calculateOffer(kitchen("push"));
    expect(b.errors).toEqual([]);
    expect(b.handleCount).toBe(0);
    expect(b.usage.find((u) => u.product.id === "push")!.quantity).toBe(4);
    expect(b.area).toBe(a.area);
    expect(b.edge).toBe(a.edge);
    expect(b.total - a.total).toBeCloseTo((4 * 620 - 4 * 380) / 0.8, 2);
    expect(b.elements.slice(0, 2)).toEqual(a.elements.slice(0, 2));
  });
  it("prepust 20 mm daje front 738 mm uz korpus 720 mm; materijal i kant se dodaju samo jednom", () => {
    const high = kitchen();
    high.elements = [
      {
        ...newElement("tall"),
        locked: true,
        selection: { ...defaultSelection, opening: "push" },
      },
    ];
    expect(calculateOffer(high).errors.join()).toContain("nisu potvrđeni");
    const o = kitchen("overhang"),
      before = structuredClone(o),
      a = calculateOffer(kitchen()),
      b = calculateOffer(o);
    expect(b.errors).toEqual([]);
    expect(b.handleCount).toBe(0);
    expect(b.usage.find((u) => u.product.id === "push")).toBeUndefined();
    const upper = b.elements.slice(2);
    expect(
      upper.flatMap((r) =>
        r.panels
          .filter((p) => p.name.startsWith("Front vrata"))
          .map((p) => p.height),
      ),
    ).toEqual([738, 738, 738, 738]);
    expect(o.elements.slice(2).map((e) => e.height)).toEqual([720, 720, 720]);
    const widthSum = 596 + 397 * 2 + 596,
      areaDelta = (widthSum * 22) / 1e6,
      edgeDelta = (4 * 2 * 22) / 1000;
    expect(b.area - a.area).toBeCloseTo(areaDelta, 10);
    expect(b.edge - a.edge).toBeCloseTo(edgeDelta, 10);
    expect(b.total - a.total).toBeCloseTo(
      (areaDelta * 1.1 * 6200 + edgeDelta * (85 + 70) - 4 * 380) / 0.8,
      2,
    );
    for (let i = 2; i < 5; i++)
      expect(
        b.elements[i].panels.filter((p) => !p.name.startsWith("Front vrata")),
      ).toEqual(
        a.elements[i].panels.filter((p) => !p.name.startsWith("Front vrata")),
      );
    expect(b.elements.slice(0, 2)).toEqual(a.elements.slice(0, 2));
    expect(o).toEqual(before);
  });
  it("promena prepusta 20→30 menja samo potrebnu površinu, kant i pripadajući rad", () => {
    const o = kitchen("overhang"),
      a = calculateOffer(o);
    o.selection.frontOverhang = 30;
    const b = calculateOffer(o);
    expect(b.area - a.area).toBeCloseTo(1.986 * 0.01);
    expect(b.edge - a.edge).toBeCloseTo(0.08);
    expect(b.hardware).toBe(a.hardware);
    expect(b.total - a.total).toBeCloseTo(
      (1.986 * 0.01 * 1.1 * 6200 + 0.08 * (85 + 70)) / 0.8,
      2,
    );
  });
  it("broj šarki prati stvarnu visinu produženog fronta", () => {
    const e = { ...newElement("wall1"), height: 900 };
    const r = construct(
      e,
      { ...defaultSelection, opening: "overhang", frontOverhang: 20 },
      defaults,
      demoPrices,
    );
    expect(r.panels.find((p) => p.name === "Front vrata 1")!.height).toBe(918);
    expect(r.hardware.find((h) => h.label === "Šarke")!.quantity).toBe(3);
  });
  it("zaključani izbori ručke, push i pojedinačnog prepusta ostaju nezavisni", () => {
    const o = kitchen("overhang");
    o.elements[2].locked = true;
    o.elements[2].selection = {
      ...defaultSelection,
      handle: "custom-handle",
      opening: "handles",
    };
    o.prices.push({
      ...demoPrices.find((p) => p.id === "handle")!,
      id: "custom-handle",
      price: 500,
    });
    o.elements[3].locked = true;
    o.elements[3].selection = {
      ...defaultSelection,
      opening: "overhang",
      frontOverhang: 35,
    };
    const a = calculateOffer(o);
    expect(a.handleCount).toBe(1);
    expect(
      a.usage.find((u) => u.product.id === "custom-handle")!.quantity,
    ).toBe(1);
    expect(
      a.elements[3].panels.find((p) => p.name === "Front vrata 1")!.height,
    ).toBe(753);
    o.selection.wallOpening = "handles";
    expect(calculateOffer(o).elements[3]).toEqual(a.elements[3]);
    expect(effectiveSelection(o.elements[2], o.selection).handle).toBe(
      "custom-handle",
    );
  });
  it("ne pretpostavlja kompatibilnost push mehanizma sa standardnim usporivačima ili nepoznatim modelom", () => {
    const o = kitchen("push");
    o.selection.wallHinge = "hinge-standard";
    expect(calculateOffer(o).errors.join()).toContain("nisu potvrđeni");
    o.selection.wallHinge = "hinge-economy";
    delete o.prices.find((p) => p.id === "push")!.pushRule;
    expect(calculateOffer(o).errors.join()).toContain("nema definisano");
  });
  it("količina mehanizama i ograničenja potiču iz konkretnog modela", () => {
    const o = kitchen("push"),
      p = o.prices.find((p) => p.id === "push")!;
    p.pushRule!.perDoor = 2;
    expect(
      calculateOffer(o).usage.find((u) => u.product.id === "push")!.quantity,
    ).toBe(8);
    p.pushRule!.maxHeight = 700;
    expect(calculateOffer(o).errors.join()).toContain("dimenzije fronta");
    p.pushRule!.maxHeight = 1600;
    o.settings.gap = 1;
    expect(calculateOffer(o).errors.join()).toContain("zazor");
  });
  it("nepodržani GOLA donji/ugaoni/visoki i individualno nepodržano otvaranje ostaju nepotpuni", () => {
    for (const kind of ["island", "corner", "tall"] as const) {
      const o = kitchen();
      o.elements = [
        {
          ...newElement(kind),
          locked: true,
          selection: { ...defaultSelection, opening: "gola" },
        },
      ];
      expect(calculateOffer(o).errors.length).toBeGreaterThan(0);
    }
    const o = kitchen("overhang"),
      lift = {
        ...newElement("lift"),
        id: "lift",
        placement: { wall: "A", offset: 0, order: 4 },
      };
    o.elements.push(lift);
    expect(effectiveSelection(lift, o.selection).opening).toBe("handles");
    const c = calculateOffer(o);
    expect(c.errors).toEqual([]);
    expect(
      c.elements
        .find((r) => r.element.id === "lift")!
        .hardware.some((h) => h.label === "Ručke"),
    ).toBe(true);
  });
  it("neispravan ili prevelik prepust i nedovoljan prostor sprečavaju kompletan obračun", () => {
    for (const extension of [0, -1, 101, NaN]) {
      const o = kitchen("overhang");
      o.selection.frontOverhang = extension;
      expect(calculateOffer(o).errors.join()).toContain("Prepušteni front");
    }
    const o = kitchen("overhang");
    o.elevation!.upperGap = 10;
    expect(calculateOffer(o).errors.join()).toContain(
      "nema dovoljno slobodnog prostora",
    );
    const clear = kitchen("overhang");
    clear.elevation!.objects = [
      {
        id: "window",
        wall: "A",
        kind: "window",
        x: 0,
        width: 600,
        height: 100,
        bottom: 1400,
      },
    ];
    expect(calculateOffer(clear).errors.join()).toContain(
      "nema dovoljno slobodnog prostora",
    );
  });
  it("SVG produžuje front naniže uz nepromenjen korpus i bez klasičnih ručki", () => {
    const o = kitchen("overhang"),
      s = elevationScene(o, "A"),
      entry = s.entries.find((e) => e.id === "e2")!;
    expect(entry.frontOverhang).toBe(20);
    expect(entry.frontHeight).toBe(738);
    expect(entry.rect.height).toBe(720);
    expect(entry.visible[0].y).toBe(entry.rect.y - 20);
    const svg = renderToStaticMarkup(
      <WallElevation scene={s} scale={0.2} selected={null} />,
    );
    expect(svg).toContain('data-front-overhang="20"');
    expect(svg).toContain('data-front-height="738"');
    expect(svg).not.toContain('class="technical-handle"');
  });
});
