import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, it, expect } from "vitest";
import {
  KitchenDB,
  createOffer,
  exportBackup,
  restoreBackup,
  saveOffer,
  seedDatabase,
  persistProject,
} from "../src/core/db";
import { calculateOffer } from "../src/core/engine";
import { defaultLayout, ensureLayout, newSpacer } from "../src/core/layout";
import { newElement } from "../src/core/catalog";
import { kitsKitchen } from "./fixtures/opening-kits";
const databases: KitchenDB[] = [];
const database = () => {
  const d = new KitchenDB("test-" + crypto.randomUUID());
  databases.push(d);
  return d;
};
afterEach(async () => {
  for (const d of databases.splice(0)) await d.delete();
});
describe("Trajna lokalna baza", () => {
  it("čuva elemente iz priloga i vraća ih iz rezervne kopije", async () => {
    const a = database(),
      b = database();
    await seedDatabase(a);
    const offer = ensureLayout(createOffer());
    const reference = newElement("reference002");
    reference.placement = { wall: "A", row: "base", offset: 0, order: 0 };
    offer.elements = [reference];
    expect(await persistProject(offer, a)).toBe(true);
    expect(
      (await a.templates.get("1.0.0"))?.rules.some(
        (r) => r.kind === "reference092",
      ),
    ).toBe(true);
    await restoreBackup(JSON.parse(JSON.stringify(await exportBackup(a))), b);
    expect((await b.offers.get(offer.id))?.elements[0]).toMatchObject({
      kind: "reference002",
      width: reference.width,
      height: reference.height,
    });
  });
  it("čuva nepotpun novi tip i format dobavljača u bazi i rezervnoj kopiji", async () => {
    const a = database(),
      b = database();
    const offer = ensureLayout(createOffer());
    const cargo = newElement("baseCargo");
    cargo.placement = { wall: "A", row: "base", offset: 0, order: 0 };
    offer.elements = [cargo];
    expect(await persistProject(offer, a)).toBe(true);
    expect((await a.offers.get(offer.id))!.elements[0].kind).toBe("baseCargo");
    await a.meta.put({
      id: "import-format:stolar",
      value: { supplier: "Stolar", mapping: { Šifra: "SKU" } },
    });
    await restoreBackup(JSON.parse(JSON.stringify(await exportBackup(a))), b);
    expect((await b.offers.get(offer.id))!.elements[0].kind).toBe("baseCargo");
    expect((await b.meta.get("import-format:stolar"))?.value).toEqual({
      supplier: "Stolar",
      mapping: { Šifra: "SKU" },
    });
  });
  it("izgled, fotografije dekora, RAL, ručice i debljina ploče preživljavaju JSON i ponovno otvaranje", async () => {
    const a = database(),
      b = database(),
      o = ensureLayout(createOffer(true));
    o.selection = {
      ...o.selection,
      frontMode: "body",
      body: "body-oak",
      wallHandle: "handle",
      handlePosition: "horizontal",
      ralCode: "Test",
      ralColor: "#223344",
      worktopThickness: 28,
    };
    o.prices.find((p) => p.id === "body-oak")!.appearance = {
      color: "#ad825c",
      texture: "wood",
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
    };
    const total = calculateOffer(o).total;
    await saveOffer(o, a);
    await restoreBackup(JSON.parse(JSON.stringify(await exportBackup(a))), b);
    const saved = (await b.offers.get(o.id))!;
    expect(saved.selection).toEqual(o.selection);
    expect(saved.prices).toEqual(o.prices);
    expect(calculateOffer(saved).total).toBe(total);
    const invalid = await exportBackup(a);
    invalid.offers[0].prices.find(
      (p) => p.id === "body-oak",
    )!.appearance!.color = "invalid";
    await expect(restoreBackup(invalid, b)).rejects.toThrow();
    expect((await b.offers.get(o.id))!.selection).toEqual(o.selection);
  });
  it("v5→v6 omogućava demo Push za visoki ormar i čuva prilagođena pravila i cene", async () => {
    const name = "v5-" + crypto.randomUUID(),
      legacy = new Dexie(name);
    legacy.version(5).stores({
      products: "id,category,supplier,code",
      offers: "id,updatedAt",
      suppliers: "id,name",
      settings: "id",
      meta: "id",
      clients: "id,name",
      templates: "id,version",
    });
    const o = ensureLayout(createOffer(true));
    const push = o.prices.find((p) => p.id === "push")!;
    push.pushRule!.kinds = ["wall1", "wall2"];
    const custom = o.variants[0].prices.find((p) => p.id === "push")!;
    custom.pushRule!.kinds = ["wall1", "wall2"];
    custom.pushRule!.maxHeight = 1400;
    o.elements[8].locked = true;
    o.elements[8].selection = { ...o.selection, opening: "handles" };
    const original = structuredClone(o);
    await legacy.table("products").put(push);
    await legacy.table("offers").put(o);
    await legacy.table("meta").put({ id: "draft", value: o });
    legacy.close();
    const d = new KitchenDB(name);
    databases.push(d);
    await d.open();
    const saved = (await d.offers.get(o.id))!;
    // v10 keeps only the element's own opening instead of locking its materials.
    expect(saved.elements).toEqual(((els: typeof original.elements) => els.map((e) => (e.locked ? { ...e, locked: false, ownOpening: true } : e)))(original.elements));
    expect(saved.selection).toEqual(original.selection);
    expect(saved.prices.map((p) => p.price)).toEqual(
      original.prices.map((p) => p.price),
    );
    expect(
      saved.prices.find((p) => p.id === "push")!.pushRule!.kinds,
    ).toContain("tall");
    expect((await d.products.get("push"))!.pushRule!.kinds).toContain("tall");
    expect(
      ((await d.meta.get("draft"))!.value as typeof o).prices.find(
        (p) => p.id === "push",
      )!.pushRule!.kinds,
    ).toContain("tall");
    expect(
      saved.variants[0].prices.find((p) => p.id === "push")!.pushRule,
    ).toEqual(custom.pushRule);
  });
  it("čuva GOLA pravilo, Push komplet, komponente, individualne izbore i cenu kroz ponovno otvaranje i JSON", async () => {
    const a = database(),
      b = database(),
      o = kitsKitchen();
    o.selection.tallOpening = "gola";
    o.selection.verticalGola = "vertical-test";
    o.selection.wallOpening = "push";
    o.selection.wallPush = "silent-test";
    o.selection.wallHinge = "hinge-premium";
    o.elements[4].locked = true;
    o.elements[4].selection = { ...o.selection, opening: "handles" };
    const total = calculateOffer(o).total;
    expect(calculateOffer(o).errors).toEqual([]);
    await saveOffer(o, a);
    a.close();
    await a.open();
    const reopened = (await a.offers.get(o.id))!;
    expect(reopened.selection).toEqual(o.selection);
    expect(reopened.prices).toEqual(o.prices);
    expect(calculateOffer(reopened).total).toBe(total);
    await restoreBackup(JSON.parse(JSON.stringify(await exportBackup(a))), b);
    expect(calculateOffer((await b.offers.get(o.id))!).total).toBe(total);
    expect((await b.offers.get(o.id))!.elements).toEqual(reopened.elements);
    const invalid = await exportBackup(a);
    invalid.offers[0].prices.find(
      (p) => p.id === "vertical-test",
    )!.verticalGolaRule!.components[0].quantity = -1;
    await expect(restoreBackup(invalid, b)).rejects.toThrow();
    expect(calculateOffer((await b.offers.get(o.id))!).total).toBe(total);
  });
  it("v4→v5 dodaje odvojene izbore i demo pravila, bez promene cena, korpusa i zaključanih izbora", async () => {
    const name = "v4-" + crypto.randomUUID(),
      legacy = new Dexie(name);
    legacy.version(4).stores({
      products: "id,category,supplier,code",
      offers: "id,updatedAt",
      suppliers: "id,name",
      settings: "id",
      meta: "id",
      clients: "id,name",
      templates: "id,version",
    });
    const o = ensureLayout(createOffer(true));
    delete o.selection.wallOpening;
    delete o.selection.tallOpening;
    delete o.selection.frontOverhang;
    o.elements[5].locked = true;
    for (const p of o.prices) delete p.pushRule;
    for (const v of o.variants) {
      delete v.selection.wallOpening;
      delete v.selection.tallOpening;
      delete v.selection.frontOverhang;
      for (const p of v.prices) delete p.pushRule;
    }
    const original = structuredClone(o),
      price = calculateOffer(o).total;
    await legacy.table("offers").put(o);
    await legacy.table("meta").put({ id: "draft", value: o });
    await legacy.table("products").bulkPut(o.prices);
    legacy.close();
    const d = new KitchenDB(name);
    databases.push(d);
    await d.open();
    const migrated = (await d.offers.get(o.id))!;
    expect(migrated.elements).toEqual(((els: typeof original.elements) => els.map((e) => (e.locked ? { ...e, locked: false, ownOpening: true } : e)))(original.elements));
    expect(migrated.selection).toMatchObject({
      wallOpening: "handles",
      tallOpening: "handles",
      frontOverhang: 20,
    });
    expect(migrated.prices.map((p) => p.price)).toEqual(
      original.prices.map((p) => p.price),
    );
    expect(
      migrated.prices.find((p) => p.id === "push")!.pushRule!.perDoor,
    ).toBe(1);
    expect(calculateOffer(migrated).total).toBe(price);
    expect(((await d.meta.get("draft"))!.value as typeof o).selection).toEqual(
      migrated.selection,
    );
    expect(migrated.variants[0].selection.wallOpening).toBe("handles");
    expect((await d.products.get("push"))!.pushRule!.hinges).toEqual([
      "hinge-economy",
    ]);
  });
  it("sva tri otvaranja visećih i zaključani prepust preživljavaju JSON i ponovno otvaranje", async () => {
    const d = database();
    for (const mode of ["handles", "push", "overhang"] as const) {
      const o = createOffer();
      o.id = `wall-${mode}`;
      o.layout = defaultLayout("L kuhinja", 4000);
      o.selection = {
        ...o.selection,
        opening: "gola",
        wallOpening: mode,
        wallHinge: "hinge-economy",
        frontOverhang: 20,
      };
      o.elements = (
        ["base1", "drawer3", "wall1", "wall2", "wall1"] as const
      ).map((kind, i) => ({
        ...newElement(kind, o.selection),
        id: `${mode}-${i}`,
        placement: { wall: "A", offset: 0, order: i },
      }));
      o.elements[4].locked = true;
      o.elements[4].selection = {
        ...o.selection,
        opening: "overhang",
        frontOverhang: 35,
      };
      o.variants = [
        {
          id: "v-" + mode,
          name: mode,
          createdAt: o.createdAt,
          selection: structuredClone(o.selection),
          elements: structuredClone(o.elements),
          prices: structuredClone(o.prices),
          settings: structuredClone(o.settings),
          layout: structuredClone(o.layout),
        },
      ];
      await saveOffer(o, d);
    }
    const before = await d.offers.toArray(),
      backup = await exportBackup(d);
    await restoreBackup(backup, d);
    d.close();
    await d.open();
    for (const o of before) {
      const loaded = (await d.offers.get(o.id))!;
      expect(loaded.selection).toEqual(o.selection);
      expect(loaded.elements).toEqual(o.elements);
      expect(loaded.variants[0].selection).toEqual(o.variants[0].selection);
      expect(calculateOffer(loaded)).toEqual(calculateOffer(o));
    }
    const invalid = structuredClone(backup);
    invalid.offers[0].prices.find((p) => p.id === "push")!.pushRule!.perDoor =
      0;
    await expect(restoreBackup(invalid, d)).rejects.toThrow("nevalidne");
    expect(await d.offers.count()).toBe(3);
  });
  it("automatsko čuvanje upisuje iste dimenzije u radnu kopiju i sačuvani projekat", async () => {
    const d = database(),
      o = ensureLayout(createOffer(true));
    await persistProject(o, d);
    o.elements[1].width = 400;
    const edited = ensureLayout(o);
    await persistProject(edited, d);
    expect((await d.offers.get(o.id))!.elements).toEqual(edited.elements);
    expect(((await d.meta.get("draft"))!.value as typeof o).elements).toEqual(
      edited.elements,
    );
    edited.elements = [];
    await persistProject(edited, d);
    expect((await d.offers.get(o.id))!.elements).toEqual([]);
  });
  it("neispravno radno stanje ne zamenjuje poslednji validan sačuvani projekat", async () => {
    const d = database(),
      o = ensureLayout(createOffer(true));
    await persistProject(o, d);
    const invalid = structuredClone(o);
    invalid.elements[0].width = -1;
    await persistProject(invalid, d);
    expect((await d.offers.get(o.id))!.elements[0].width).toBe(
      o.elements[0].width,
    );
    expect(
      ((await d.meta.get("draft"))!.value as typeof o).elements[0].width,
    ).toBe(-1);
  });
  it("migrira v3 na v4 bez promene rasporeda i cene u ponudi, varijanti i radnoj kopiji", async () => {
    const name = "v3-" + crypto.randomUUID(),
      legacy = new Dexie(name);
    legacy.version(3).stores({
      products: "id,category,supplier,code",
      offers: "id,updatedAt",
      suppliers: "id,name",
      settings: "id",
      meta: "id",
      clients: "id,name",
      templates: "id,version",
    });
    const o = ensureLayout(createOffer(true));
    delete o.elevation;
    for (const v of o.variants) delete v.elevation;
    const original = structuredClone(o),
      price = calculateOffer(o);
    await legacy.table("offers").put(o);
    await legacy.table("meta").put({ id: "draft", value: o });
    legacy.close();
    const d = new KitchenDB(name);
    databases.push(d);
    await d.open();
    const migrated = (await d.offers.get(o.id))!;
    expect(migrated.elements).toEqual(original.elements);
    expect(migrated.layout).toEqual(original.layout);
    expect(migrated.elevation).toMatchObject({
      version: 1,
      toeKick: 100,
      upperGap: 600,
      objects: [],
    });
    expect(migrated.variants[0].elevation?.version).toBe(1);
    expect(calculateOffer(migrated)).toEqual(price);
    expect(((await d.meta.get("draft"))!.value as typeof o).elevation).toEqual(
      migrated.elevation,
    );
  });
  it("2D podešavanja i vizuelni uređaji preživljavaju čuvanje, JSON i ponovno otvaranje", async () => {
    const d = database(),
      o = ensureLayout(createOffer(true));
    o.elements[0].visual = {
      hinge: "right",
      glass: true,
      appliance: "dishwasher",
      hob: true,
    };
    o.elevation = {
      version: 1,
      toeKick: 120,
      upperGap: 550,
      wallHeight: 2800,
      objects: [
        {
          id: "window",
          wall: "A",
          kind: "window",
          x: 1200,
          width: 1000,
          height: 900,
          bottom: 1100,
        },
      ],
    };
    o.variants[0].elevation = structuredClone(o.elevation);
    // Saving packs the layout around the window, so compare against the packed project.
    const price = calculateOffer(ensureLayout(o));
    await saveOffer(o, d);
    const copy = await exportBackup(d);
    await restoreBackup(copy, d);
    d.close();
    await d.open();
    const loaded = (await d.offers.get(o.id))!;
    expect(loaded.elevation).toEqual(o.elevation);
    expect(loaded.elements[0].visual).toEqual(o.elements[0].visual);
    expect(loaded.variants[0].elevation).toEqual(o.elevation);
    expect(calculateOffer(loaded)).toEqual(price);
    const invalid = structuredClone(copy);
    invalid.offers[0].elevation!.objects[0].width = -10;
    await expect(restoreBackup(invalid, d)).rejects.toThrow("nevalidne");
    expect((await d.offers.get(o.id))!.elevation).toEqual(o.elevation);
  });
  it("migrira v2 praznine u Razmak u ponudi, radnoj kopiji i varijanti", async () => {
    const name = "v2-" + crypto.randomUUID(),
      legacy = new Dexie(name);
    legacy.version(1).stores({
      products: "id,category,supplier,code",
      offers: "id,updatedAt",
      suppliers: "id,name",
      settings: "id",
      meta: "id",
      clients: "id,name",
      templates: "id,version",
    });
    legacy.version(2).stores({});
    const o = createOffer(true);
    o.layout = defaultLayout("L kuhinja");
    delete o.layout.version;
    o.elements = o.elements.slice(0, 2);
    o.elements[0].placement = { wall: "A", offset: 100 };
    o.elements[1].placement = { wall: "A", offset: 900 };
    o.variants[0].elements = structuredClone(o.elements);
    o.variants[0].layout = structuredClone(o.layout);
    const price = calculateOffer(o).total;
    await legacy.table("offers").put(o);
    await legacy.table("meta").put({ id: "draft", value: o });
    legacy.close();
    const migrated = new KitchenDB(name);
    databases.push(migrated);
    await migrated.open();
    expect(
      (await migrated.templates.get("library-1.2"))?.rules.some(
        (r) => r.kind === "reference092",
      ),
    ).toBe(true);
    let saved = (await migrated.offers.get(o.id))!;
    expect(saved.layout!.spacers!.map((s) => s.width)).toEqual([100, 200]);
    expect(saved.variants[0].layout!.spacers!.map((s) => s.width)).toEqual([
      100, 200,
    ]);
    expect(saved.elements.map((e) => e.placement!.offset)).toEqual([100, 900]);
    expect(calculateOffer(saved).total).toBe(price);
    const ids = saved.layout!.spacers!.map((s) => s.id);
    const draft = (await migrated.meta.get("draft"))!.value as typeof o;
    expect(draft.layout!.spacers!.map((s) => s.width)).toEqual([100, 200]);
    migrated.close();
    await migrated.open();
    saved = (await migrated.offers.get(o.id))!;
    expect(saved.layout!.spacers!.map((s) => s.id)).toEqual(ids);
  });
  it("novi redosled i razmaci preživljavaju JSON izvoz i ponovno učitavanje", async () => {
    const d = database(),
      o = ensureLayout(createOffer(true));
    const first = o.elements[0];
    first.placement!.order = 5;
    const gap = newSpacer("A", "base", 200);
    gap.placement.order = 0;
    o.layout!.spacers = [gap];
    const n = ensureLayout(o);
    await saveOffer(n, d);
    const copy = await exportBackup(d);
    await restoreBackup(copy, d);
    const saved = (await d.offers.get(o.id))!;
    expect(saved.elements.map((e) => e.placement)).toEqual(
      n.elements.map((e) => e.placement),
    );
    expect(saved.layout).toEqual(n.layout);
    expect(saved.layout!.spacers![0].width).toBe(200);
  });
  it("nevalidan Razmak u kopiji odbija se pre menjanja baze", async () => {
    const d = database();
    await seedDatabase(d);
    const backup = await exportBackup(d),
      offer = ensureLayout(backup.offers[0]);
    offer.layout!.spacers = [newSpacer("A", "base", 200)];
    offer.layout!.spacers[0].width = -1;
    backup.offers[0] = offer;
    await expect(restoreBackup(backup, d)).rejects.toThrow();
    expect(await d.offers.count()).toBe(3);
  });
  it("bezbedno migrira pravu bazu verzije 1, uključujući radnu kopiju i varijante", async () => {
    const name = "migration-" + crypto.randomUUID();
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      products: "id,category,supplier,code",
      offers: "id,updatedAt",
      suppliers: "id,name",
      settings: "id",
      meta: "id",
      clients: "id,name",
      templates: "id,version",
    });
    const offer = createOffer(true),
      total = calculateOffer(offer).total;
    await legacy.table("offers").put(offer);
    await legacy.table("meta").put({ id: "draft", value: offer });
    await legacy.table("products").put(offer.prices[0]);
    legacy.close();
    const migrated = new KitchenDB(name);
    databases.push(migrated);
    await migrated.open();
    const loaded = await migrated.offers.get(offer.id);
    expect(loaded?.layout?.walls.map((w) => w.id)).toEqual(["A", "B"]);
    expect(loaded?.elements.every((e) => !!e.placement)).toBe(true);
    expect(loaded?.prices).toEqual(offer.prices);
    expect(calculateOffer(loaded!).total).toBe(total);
    expect(loaded?.variants[0].layout).toBeDefined();
    expect((await migrated.meta.get("draft"))?.value).toMatchObject({
      id: offer.id,
      layout: loaded?.layout,
    });
    expect((await migrated.products.get(offer.prices[0].id))?.price).toBe(
      offer.prices[0].price,
    );
  });
  it("čuva i ponovno učitava ponudu sa istom cenom", async () => {
    const d = database(),
      o = createOffer(true);
    await saveOffer(o, d);
    const saved = await d.offers.get(o.id);
    expect(saved).toBeDefined();
    expect(calculateOffer(saved!).total).toBe(calculateOffer(o).total);
    expect((await d.clients.get(o.id))?.name).toBe(o.client.name);
  });
  it("demo se ubacuje samo prvi put i ne prepisuje korisničke cene", async () => {
    const d = database();
    await seedDatabase(d);
    await d.products.update("body-white", { price: 123 });
    const count = await d.offers.count();
    await seedDatabase(d);
    expect((await d.products.get("body-white"))?.price).toBe(123);
    expect(await d.offers.count()).toBe(count);
  });
  it("izmene cenovnika ne menjaju snimak u sačuvanoj ponudi", async () => {
    const d = database();
    await seedDatabase(d);
    const before = (await d.offers.toArray())[0],
      total = calculateOffer(before).total;
    await d.products.update("front-mdf", { price: 99000 });
    const after = await d.offers.get(before.id);
    expect(calculateOffer(after!).total).toBe(total);
  });
  it("JSON backup vraća ponude, cene i podešavanja", async () => {
    const a = database(),
      b = database();
    await seedDatabase(a);
    const backup = JSON.parse(JSON.stringify(await exportBackup(a)));
    await restoreBackup(backup, b);
    expect(await b.offers.count()).toBe(3);
    expect(await b.products.count()).toBe(await a.products.count());
    expect((await b.settings.get("main"))?.value.margin).toBe(20);
  });
  it("nevalidna kopija ne briše postojeće podatke", async () => {
    const d = database();
    await seedDatabase(d);
    const b = await exportBackup(d);
    b.products[0].price = -1;
    await expect(restoreBackup(b, d)).rejects.toThrow();
    expect(await d.offers.count()).toBe(3);
  });
  it("odbija nevalidnu konstrukciju i podešavanja u kopiji", async () => {
    const d = database();
    await seedDatabase(d);
    const a = await exportBackup(d);
    a.offers[0].elements[0].width = -2;
    await expect(restoreBackup(a, d)).rejects.toThrow();
    const b = await exportBackup(d);
    b.settings[0].value.margin = 100;
    await expect(restoreBackup(b, d)).rejects.toThrow();
    expect(await d.offers.count()).toBe(3);
  });
});
