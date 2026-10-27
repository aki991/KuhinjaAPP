import Dexie, { type Table } from "dexie";
import {
  defaultSelection,
  defaults,
  demoElements,
  demoPrices,
  templates,
  uid,
} from "./catalog";
import type { Client, Offer, Product, Settings, Supplier } from "./types";
import { TEMPLATE_VERSION } from "./types";
import { validateBackup } from "./backup-validation";
import { ensureLayout } from "./layout";
import { defaultElevation, ensureElevation } from "./elevation";
import { calculateOffer, onlyUnsupportedErrors } from "./engine";
import { ensureOpenings, upgradeDemoPush } from "./opening";
import { siteMaterials } from "./site-materials";
export class KitchenDB extends Dexie {
  products!: Table<Product, string>;
  offers!: Table<Offer, string>;
  suppliers!: Table<Supplier, string>;
  settings!: Table<{ id: string; value: Settings }, string>;
  meta!: Table<{ id: string; value: unknown }, string>;
  clients!: Table<Client & { id: string }, string>;
  templates!: Table<
    { id: string; version: string; rules: typeof templates },
    string
  >;
  constructor(name = "KuhinjaKalkulator") {
    super(name);
    this.version(1).stores({
      products: "id,category,supplier,code",
      offers: "id,updatedAt",
      suppliers: "id,name",
      settings: "id",
      meta: "id",
      clients: "id,name",
      templates: "id,version",
    });
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("offers")
          .toCollection()
          .modify((offer: Offer) => {
            Object.assign(offer, ensureLayout(offer));
          });
        const draft = await tx.table("meta").get("draft");
        if (draft?.value)
          await tx
            .table("meta")
            .put({ id: "draft", value: ensureLayout(draft.value) });
      });
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("offers")
          .toCollection()
          .modify((offer: Offer) => {
            Object.assign(offer, ensureLayout(offer));
          });
        const draft = await tx.table("meta").get("draft");
        if (draft?.value)
          await tx
            .table("meta")
            .put({ id: "draft", value: ensureLayout(draft.value) });
      });
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("offers")
          .toCollection()
          .modify((o: Offer) => Object.assign(o, ensureElevation(o)));
        const draft = await tx.table("meta").get("draft");
        if (draft?.value)
          await tx
            .table("meta")
            .put({ id: "draft", value: ensureElevation(draft.value) });
      });
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("products")
          .toCollection()
          .modify((p: Product) => {
            Object.assign(p, upgradeDemoPush(p));
          });
        await tx
          .table("offers")
          .toCollection()
          .modify((o: Offer) => {
            Object.assign(o, ensureOpenings(o));
          });
        const draft = await tx.table("meta").get("draft");
        if (draft?.value)
          await tx
            .table("meta")
            .put({ id: "draft", value: ensureOpenings(draft.value) });
      });
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("products")
          .toCollection()
          .modify((p: Product) => Object.assign(p, upgradeDemoPush(p)));
        await tx
          .table("offers")
          .toCollection()
          .modify((o: Offer) => Object.assign(o, ensureOpenings(o)));
        const draft = await tx.table("meta").get("draft");
        if (draft?.value)
          await tx
            .table("meta")
            .put({ id: "draft", value: ensureOpenings(draft.value) });
      });
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table("templates").put({
          id: "library-1.1",
          version: "1.1.0",
          rules: templates,
        });
      });
    this.version(8)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("templates")
          .put({ id: "library-1.2", version: "1.2.0", rules: templates });
      });
    this.version(9)
      .stores({})
      .upgrade(async (tx) => {
        // Materials from the supplied list; existing articles are never overwritten.
        const products = tx.table("products");
        for (const m of siteMaterials)
          if (!(await products.get(m.id))) await products.put(structuredClone(m));
      });
    this.version(10)
      .stores({})
      .upgrade(async (tx) => {
        // Choosing an opening in the element editor used to lock all of the element's
        // materials, so later decor changes were ignored. Keep only its own opening.
        await tx
          .table("offers")
          .toCollection()
          .modify((o: Offer) => Object.assign(o, unlockOpenings(o)));
        const draft = await tx.table("meta").get("draft");
        if (draft?.value)
          await tx
            .table("meta")
            .put({ id: "draft", value: unlockOpenings(draft.value) });
      });
  }
}
function unlockOpenings<T extends Pick<Offer, "elements" | "variants">>(o: T): T {
  const unlock = (elements: Offer["elements"]) =>
    elements.map((e) => (e.locked ? { ...e, locked: false, ownOpening: true } : e));
  return {
    ...o,
    elements: unlock(o.elements),
    variants: (o.variants ?? []).map((v) => ({ ...v, elements: unlock(v.elements) })),
  };
}
export const db = new KitchenDB();
export function createOffer(demo = false): Offer {
  const now = new Date().toISOString();
  const offer: Offer = {
    id: uid(),
    client: {
      name: demo ? "Marko Petrović" : "",
      phone: demo ? "064 123 4567" : "",
      project: demo ? "Kuhinja Petrović — Demo" : "Nova kuhinja",
      location: demo ? "Novi Beograd" : "",
      layout: "L kuhinja",
    },
    elements: demo ? demoElements() : [],
    selection: {
      ...defaultSelection,
      wallOpening: "handles",
      tallOpening: "handles",
      frontOverhang: 20,
    },
    prices: structuredClone(demoPrices),
    settings: { ...defaults },
    variants: [],
    createdAt: now,
    updatedAt: now,
    status: "draft",
    templateVersion: TEMPLATE_VERSION,
    note: "Rok izrade i detalji montaže po dogovoru.",
    demo,
    elevation: defaultElevation(),
  };
  if (demo)
    offer.variants.push({
      id: uid(),
      name: "Premium",
      selection: structuredClone(offer.selection),
      elements: structuredClone(offer.elements),
      prices: structuredClone(offer.prices),
      settings: structuredClone(offer.settings),
      elevation: structuredClone(offer.elevation),
      createdAt: now,
    });
  return offer;
}
export async function seedDatabase(database = db) {
  await database.transaction(
    "rw",
    [
      database.meta,
      database.products,
      database.offers,
      database.suppliers,
      database.settings,
      database.templates,
    ],
    async () => {
      if (await database.meta.get("initialized")) return;
      await database.products.bulkPut(structuredClone(demoPrices));
      await database.products.bulkPut(structuredClone(siteMaterials));
      await database.settings.put({ id: "main", value: { ...defaults } });
      await database.suppliers.put({
        id: "demo",
        name: "Demo materijali",
        isDefault: true,
      });
      await database.templates.put({
        id: TEMPLATE_VERSION,
        version: TEMPLATE_VERSION,
        rules: templates,
      });
      const offer = createOffer(true);
      await database.offers.put(offer);
      const second = createOffer(true);
      second.id = uid();
      second.client = {
        ...second.client,
        name: "Ana Jovanović",
        project: "Stan Jovanović",
        location: "Zemun",
      };
      second.demo = false;
      second.status = "sent";
      second.elements = second.elements.slice(0, 5);
      second.updatedAt = new Date(Date.now() - 86400000).toISOString();
      second.selection = {
        ...second.selection,
        slide: "slide-standard",
        front: "front-univer",
      };
      await database.offers.put(second);
      const third = createOffer(true);
      third.id = uid();
      third.client = {
        ...third.client,
        name: "Nikola Ilić",
        project: "Kuhinja Ilić",
        location: "Novi Sad",
      };
      third.demo = false;
      third.status = "accepted";
      third.updatedAt = new Date(Date.now() - 172800000).toISOString();
      third.selection.slide = "slide-standard";
      await database.offers.put(third);
      await database.meta.put({ id: "initialized", value: true });
    },
  );
}
export async function saveOffer(offer: Offer, database = db) {
  const saved = ensureOpenings(
    ensureElevation(
      ensureLayout({
        ...offer,
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
  await database.transaction(
    "rw",
    database.offers,
    database.clients,
    async () => {
      await database.offers.put(saved);
      if (saved.client.name)
        await database.clients.put({ ...saved.client, id: saved.id });
    },
  );
  return saved;
}
/** Commit the shared working copy and valid saved project in one transaction. */
export async function persistProject(offer: Offer, database = db) {
  const cost = calculateOffer(offer);
  return database.transaction(
    "rw",
    database.meta,
    database.offers,
    database.clients,
    async () => {
      await database.meta.put({ id: "draft", value: offer });
      if (
        (!cost.errors.length || onlyUnsupportedErrors(offer)) &&
        (cost.count > 0 || (await database.offers.get(offer.id)))
      ) {
        await database.offers.put(offer);
        if (offer.client.name)
          await database.clients.put({ ...offer.client, id: offer.id });
        return true;
      }
      return false;
    },
  );
}
export async function exportBackup(database = db) {
  return {
    format: "kuhinja-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    products: await database.products.toArray(),
    offers: await database.offers.toArray(),
    suppliers: await database.suppliers.toArray(),
    settings: await database.settings.toArray(),
    templates: await database.templates.toArray(),
    clients: await database.clients.toArray(),
    importFormats: (await database.meta.toArray())
      .filter((row) => row.id.startsWith("import-format:"))
      .map(
        (row) =>
          row.value as { supplier: string; mapping: Record<string, string> },
      ),
  };
}
export type Backup = Awaited<ReturnType<typeof exportBackup>>;
export async function restoreBackup(data: Backup, database = db) {
  validateBackup(data);
  await database.transaction(
    "rw",
    [
      database.products,
      database.offers,
      database.suppliers,
      database.settings,
      database.templates,
      database.clients,
      database.meta,
    ],
    async () => {
      for (const table of [
        database.products,
        database.offers,
        database.suppliers,
        database.settings,
        database.templates,
        database.clients,
      ])
        await table.clear();
      await database.products.bulkPut(data.products);
      await database.offers.bulkPut(
        data.offers.map((o) =>
          ensureOpenings(ensureElevation(ensureLayout(o))),
        ),
      );
      await database.suppliers.bulkPut(data.suppliers);
      await database.settings.bulkPut(data.settings);
      await database.templates.bulkPut(data.templates);
      await database.clients.bulkPut(data.clients);
      await database.meta.where("id").startsWith("import-format:").delete();
      for (const format of data.importFormats ?? [])
        await database.meta.put({
          id: `import-format:${format.supplier.toLowerCase()}`,
          value: format,
        });
      await database.meta.put({ id: "initialized", value: true });
    },
  );
}
