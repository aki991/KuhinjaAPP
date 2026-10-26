import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Upload,
  Download,
  Search,
  Pencil,
  Package,
  Check,
  Store,
  ArrowRight,
  Archive,
  RefreshCw,
} from "lucide-react";
import { categories, uid } from "../core/catalog";
import { db } from "../core/db";
import {
  columns,
  guessMapping,
  validateRows,
  type Mapping,
} from "../core/importer";
import { exampleExcel, readExcel } from "../core/files";
import type { Category, Product, Settings, Supplier } from "../core/types";
import { Field, IconBox, Modal, money, SectionHeading } from "./UI";
export default function PriceList({
  products,
  suppliers,
  settings,
  onRefresh,
  notify,
}: {
  products: Product[];
  suppliers: Supplier[];
  settings: Settings;
  onRefresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [cat, setCat] = useState("all"),
    [edit, setEdit] = useState<Product | null>(null),
    [supplierModal, setSupplierModal] = useState(false),
    [supplierName, setSupplierName] = useState(""),
    [showInactive, setShowInactive] = useState(false);
  const [imported, setImported] = useState<{
      headers: string[];
      rows: Record<string, unknown>[];
      name: string;
    } | null>(null),
    [mapping, setMapping] = useState<Mapping>(guessMapping([])),
    [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const validation = useMemo(
    () => (imported ? validateRows(imported.rows, mapping, products) : null),
    [imported, mapping, products],
  );
  const filtered = products.filter(
    (p) =>
      (showInactive || p.active) &&
      (cat === "all" || p.category === cat) &&
      `${p.name} ${p.code} ${p.supplier}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function load(file?: File) {
    if (!file) return;
    try {
      const data = await readExcel(file);
      setImported({ ...data, name: file.name });
      setMapping(guessMapping(data.headers));
    } catch (e) {
      notify((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function saveProduct() {
    if (!edit) return;
    const test = validateRows(
      [
        {
          Šifra: edit.code,
          Naziv: edit.name,
          Kategorija: edit.category,
          Dobavljač: edit.supplier,
          "Jedinica mere": edit.unit,
          Cena: edit.price,
          Valuta: edit.currency,
          "Širina table": edit.sheetWidth,
          "Visina table": edit.sheetHeight,
        },
      ],
      Object.fromEntries(columns.map((x) => [x, x])) as Mapping,
      products.filter((p) => p.id !== edit.id),
    );
    if (test.errors.length) {
      notify(test.errors[0]);
      return;
    }
    if (
      products.some(
        (p) =>
          p.id !== edit.id &&
          p.code.toLowerCase() === edit.code.toLowerCase() &&
          p.supplier.toLowerCase() === edit.supplier.toLowerCase(),
      )
    ) {
      notify("Ova šifra već postoji kod tog dobavljača.");
      return;
    }
    await db.products.put(edit);
    if (!suppliers.some((s) => s.name === edit.supplier))
      await db.suppliers.put({
        id: uid(),
        name: edit.supplier,
        isDefault: false,
      });
    await onRefresh();
    setEdit(null);
    notify("Artikal sačuvan.");
  }
  const update = (patch: Partial<Product>) =>
    setEdit(edit ? { ...edit, ...patch } : null);
  return (
    <>
      <SectionHeading title="Cenovnik">
        <button
          className="btn primary"
          onClick={() =>
            setEdit({
              id: uid(),
              code: "",
              name: "",
              category: "body",
              supplier:
                suppliers.find((s) => s.isDefault)?.name || "Moj dobavljač",
              manufacturer: "",
              unit: "m²",
              price: 0,
              currency: "RSD",
              active: true,
              note: "",
              kind: "univer",
            })
          }
        >
          <Plus size={20} /> Dodaj artikal
        </button>
      </SectionHeading>
      <div className="price-actions">
        <button
          className="btn secondary"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={20} /> Uvezi cenovnik
        </button>
        <button
          className="btn secondary"
          onClick={() => setSupplierModal(true)}
        >
          <Store size={20} /> Dobavljači
        </button>
      </div>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".xlsx,.csv"
        onChange={(e) => load(e.target.files?.[0])}
      />
      <div className="list-controls">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Pretraži artikle"
            placeholder="Pretraži artikle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Kategorija cenovnika"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">Sve kategorije</option>
          {Object.entries(categories).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="price-list">
        {filtered.map((p) => (
          <button
            className={`price-row ${!p.active ? "inactive" : ""}`}
            key={p.id}
            onClick={() => setEdit({ ...p })}
          >
            <IconBox
              icon={p.category === "labor" ? RefreshCw : Package}
              tone="gray"
            />
            <span className="price-name">
              <strong>{p.name}</strong>
              <small>
                {p.supplier}
                {!p.active ? " · Neaktivan" : ""}
              </small>
            </span>
            <span className="price-value">
              <strong>
                {new Intl.NumberFormat("sr-Latn-RS").format(p.price)}{" "}
                {p.currency}
              </strong>
              <small>
                po {p.unit}
                {p.processing ? ` + obrada ${p.processing}` : ""}
              </small>
            </span>
            <Pencil size={16} className="muted" />
          </button>
        ))}
        {!filtered.length && (
          <div className="empty">Nema artikala za izabrani filter.</div>
        )}
      </div>
      <div className="price-footer">
        <button className="text-btn" onClick={exampleExcel}>
          <Download size={16} /> Preuzmi primer Excel fajla
        </button>
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />{" "}
        Prikaži i neaktivne artikle
      </label>
      {edit && (
        <Modal
          title={
            products.some((p) => p.id === edit.id)
              ? "Izmeni artikal"
              : "Novi artikal"
          }
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveProduct();
            }}
          >
            <Field label="Naziv proizvoda">
              <input
                required
                value={edit.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <div className="field-grid">
              <Field label="Šifra">
                <input
                  required
                  value={edit.code}
                  onChange={(e) => update({ code: e.target.value })}
                />
              </Field>
              <Field label="Kategorija">
                <select
                  value={edit.category}
                  onChange={(e) => {
                    const category = e.target.value as Category;
                    update({
                      category,
                      unit: ["body", "front", "back", "worktop"].includes(
                        category,
                      )
                        ? "m²"
                        : ["edge", "gola"].includes(category)
                          ? "m"
                          : category === "slide" || category === "lift"
                            ? "komplet"
                            : "kom",
                    });
                  }}
                >
                  {Object.entries(categories).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Dobavljač">
              <input
                required
                list="suppliers"
                value={edit.supplier}
                onChange={(e) => update({ supplier: e.target.value })}
              />
              <datalist id="suppliers">
                {suppliers.map((s) => (
                  <option key={s.id}>{s.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Proizvođač">
              <input
                value={edit.manufacturer}
                onChange={(e) => update({ manufacturer: e.target.value })}
              />
            </Field>
            <div className="field-grid">
              <Field label="Nabavna cena">
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={edit.price}
                  onChange={(e) => update({ price: Number(e.target.value) })}
                />
              </Field>
              <Field label="Valuta">
                <select
                  value={edit.currency}
                  onChange={(e) =>
                    update({ currency: e.target.value as Product["currency"] })
                  }
                >
                  <option>RSD</option>
                  <option>EUR</option>
                </select>
              </Field>
              <Field label="Jedinica mere">
                <select
                  value={edit.unit}
                  onChange={(e) =>
                    update({ unit: e.target.value as Product["unit"] })
                  }
                >
                  {["m²", "m", "kom", "komplet", "tabla"].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            {edit.unit === "tabla" && (
              <div className="field-grid">
                <Field label="Širina table (mm)">
                  <input
                    type="number"
                    required
                    min="1"
                    value={edit.sheetWidth || ""}
                    onChange={(e) =>
                      update({ sheetWidth: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Visina table (mm)">
                  <input
                    type="number"
                    required
                    min="1"
                    value={edit.sheetHeight || ""}
                    onChange={(e) =>
                      update({ sheetHeight: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
            )}
            {["slide", "hinge", "lift"].includes(edit.category) && (
              <Field label="Cenovna klasa">
                <select
                  value={edit.tier || "standard"}
                  onChange={(e) =>
                    update({ tier: e.target.value as Product["tier"] })
                  }
                >
                  <option value="economy">Ekonomični</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </Field>
            )}
            {edit.category === "front" && (
              <>
                <Field label="Tip fronta">
                  <select
                    value={edit.kind || "univer"}
                    onChange={(e) => update({ kind: e.target.value })}
                  >
                    <option value="univer">Univer</option>
                    <option value="mdf">MDF</option>
                    <option value="lacquer">Lakirani MDF</option>
                  </select>
                </Field>
                <Field label="Dodatna obrada po m² (u izabranoj valuti)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={edit.processing || 0}
                    onChange={(e) =>
                      update({ processing: Number(e.target.value) })
                    }
                  />
                </Field>
              </>
            )}
            <Field label="Napomena">
              <textarea
                rows={2}
                value={edit.note}
                onChange={(e) => update({ note: e.target.value })}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => update({ active: e.target.checked })}
              />{" "}
              Aktivan artikal
            </label>
            <div className="form-actions">
              {products.some((p) => p.id === edit.id) && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={async () => {
                    await db.products.update(edit.id, { active: false });
                    await onRefresh();
                    setEdit(null);
                    notify(
                      "Artikal deaktiviran. Snimci u ponudama su sačuvani.",
                    );
                  }}
                >
                  <Archive size={17} /> Deaktiviraj
                </button>
              )}
              <button className="btn primary" type="submit">
                <Check size={18} /> Sačuvaj artikal
              </button>
            </div>
          </form>
        </Modal>
      )}
      {supplierModal && (
        <Modal title="Moji dobavljači" onClose={() => setSupplierModal(false)}>
          <p className="muted">
            Podrazumevani dobavljač ima prednost pri izboru novih modela. Isti
            materijal može imati više šifara dobavljača.
          </p>
          {suppliers.map((s) => (
            <div className="supplier-row" key={s.id}>
              <span>
                <Store size={18} />
                {s.name}
              </span>
              <button
                className={`btn small ${s.isDefault ? "primary" : "secondary"}`}
                onClick={async () => {
                  await db.transaction("rw", db.suppliers, async () => {
                    await db.suppliers.bulkPut(
                      suppliers.map((x) => ({
                        ...x,
                        isDefault: x.id === s.id,
                      })),
                    );
                  });
                  await onRefresh();
                }}
              >
                {s.isDefault ? (
                  <>
                    <Check size={15} /> Podrazumevan
                  </>
                ) : (
                  "Izaberi"
                )}
              </button>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supplierName.trim()) return;
              if (
                suppliers.some(
                  (s) =>
                    s.name.toLowerCase() === supplierName.trim().toLowerCase(),
                )
              ) {
                notify("Dobavljač već postoji.");
                return;
              }
              await db.suppliers.put({
                id: uid(),
                name: supplierName.trim(),
                isDefault: false,
              });
              await onRefresh();
              setSupplierName("");
            }}
          >
            <Field label="Novi dobavljač">
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
              />
            </Field>
            <button className="btn primary full">
              <Plus size={17} /> Dodaj dobavljača
            </button>
          </form>
        </Modal>
      )}
      {imported && validation && (
        <Modal title="Uvoz cenovnika" wide onClose={() => setImported(null)}>
          <div className="info-note">
            <Upload size={19} />
            <span>
              <strong>{imported.name}</strong>
              <br />
              {imported.rows.length} redova. Obrada se odvija na ovom uređaju.
            </span>
          </div>
          <h3>1. Proverite mapiranje kolona</h3>
          <div className="mapping-grid">
            {columns.map((c) => (
              <Field key={c} label={c}>
                <select
                  value={mapping[c]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [c]: e.target.value })
                  }
                >
                  <option value="">— Nije mapirano —</option>
                  {imported.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <h3>2. Pregled prvih redova</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {imported.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imported.rows.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    {imported.headers.map((h) => (
                      <td key={h}>{String(r[h])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="validation-summary">
            <strong>{validation.valid.length} validnih artikala</strong>
            <span>
              {validation.errors.length} grešaka ·{" "}
              {validation.duplicates.length} ažuriranja
            </span>
          </div>
          {validation.errors.length > 0 && (
            <div className="error-note">
              {validation.errors.slice(0, 10).map((x, i) => (
                <p key={i}>{x}</p>
              ))}
              <strong>
                Ispravite fajl ili mapiranje. Uvoz sa greškama je blokiran.
              </strong>
            </div>
          )}
          {validation.duplicates.length > 0 && (
            <div className="info-note">
              <span>
                {validation.duplicates.slice(0, 6).map((x, i) => (
                  <p key={i}>{x}</p>
                ))}
              </span>
            </div>
          )}
          <button
            className="btn primary full"
            disabled={
              !!validation.errors.length ||
              !validation.valid.length ||
              importing
            }
            onClick={async () => {
              setImporting(true);
              try {
                await db.transaction(
                  "rw",
                  db.products,
                  db.suppliers,
                  async () => {
                    await db.products.bulkPut(validation.valid);
                    for (const name of new Set(
                      validation.valid.map((p) => p.supplier),
                    ))
                      if (!suppliers.some((s) => s.name === name))
                        await db.suppliers.put({
                          id: uid(),
                          name,
                          isDefault: false,
                        });
                  },
                );
                await onRefresh();
                setImported(null);
                notify("Cenovnik uvezen.");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing
              ? "Uvoz u toku…"
              : `Potvrdi uvoz · ${validation.valid.length} artikala`}
          </button>
        </Modal>
      )}
    </>
  );
}
