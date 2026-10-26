import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  SlidersHorizontal,
  Save,
  Download,
  RotateCcw,
  Plus,
  GitCompareArrows,
  Trash2,
  RefreshCw,
  LockKeyhole,
  FileText,
} from "lucide-react";
import { categories, findProduct, templates, uid } from "../core/catalog";
import { calculate, calculateOffer, repriceOffer, rsd } from "../core/engine";
import { displayProject, ensureLayout } from "../core/layout";
import { exportPDF } from "../core/files";
import type {
  Category,
  Offer,
  Product,
  Selection,
  Supplier,
  Tier,
  Variant,
} from "../core/types";
import QuoteSettings from "./QuoteSettings";
import { Cabinet, Field, Modal, money, number } from "./UI";
type CostGroup =
  "material" | "hardware" | "labor" | "assembly" | "transport" | "profit";
export default function OfferView({
  offer,
  onChange,
  onSave,
  onBack,
  products,
  suppliers,
  notify,
}: {
  offer: Offer;
  onChange: (o: Offer) => void;
  onSave: () => Promise<void>;
  onBack: () => void;
  products: Product[];
  suppliers: Supplier[];
  notify: (s: string) => void;
  onNew?: () => void;
}) {
  const [screen, setScreen] = useState<"summary" | "optimize" | "customer">(
      "summary",
    ),
    [previous, setPrevious] = useState<Offer | null>(null),
    [baseline, setBaseline] = useState<{ total: number; cost: number } | null>(
      null,
    ),
    [quoteSettings, setQuoteSettings] = useState(false),
    [variantModal, setVariantModal] = useState(false),
    [variantName, setVariantName] = useState("Standardna"),
    [compare, setCompare] = useState(false),
    [compareIds, setCompareIds] = useState<string[]>([]),
    [reprice, setReprice] = useState(false),
    [detail, setDetail] = useState<string | null>(null),
    [costGroup, setCostGroup] = useState<CostGroup | null>(null);
  const c = useMemo(() => calculateOffer(offer), [offer]),
    preferred = suppliers.find((s) => s.isDefault)?.name;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);
  const product = (id: string) => offer.prices.find((p) => p.id === id);
  const change = (patch: Partial<Offer>) => {
    setPrevious(structuredClone(offer));
    onChange({ ...offer, ...patch, updatedAt: new Date().toISOString() });
  };
  const selectModel = (
    key: keyof Selection,
    category: Category,
    tier?: Tier,
    kind?: string,
  ) => {
    const p = findProduct(offer.prices, category, tier, kind, preferred);
    if (p) {
      if (p.id !== offer.selection[key])
        change({ selection: { ...offer.selection, [key]: p.id } });
    } else notify("Nema aktivnog modela za ovaj izbor.");
  };
  const models = (key: keyof Selection, category: Category) => {
    const selected = product(offer.selection[key]),
      choices = offer.prices.filter(
        (p) =>
          p.active &&
          p.category === category &&
          (!selected?.tier || p.tier === selected.tier) &&
          (!selected?.kind || p.kind === selected.kind),
      );
    return (
      <Field key={key} label={categories[category]}>
        <select
          value={offer.selection[key]}
          onChange={(e) =>
            change({ selection: { ...offer.selection, [key]: e.target.value } })
          }
        >
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.supplier} · {money(rsd(p, offer.settings))}/{p.unit}
            </option>
          ))}
          {selected && !choices.some((p) => p.id === selected.id) && (
            <option value={selected.id}>{selected.name}</option>
          )}
        </select>
      </Field>
    );
  };
  const comparisons = compareIds
      .map((id) => offer.variants.find((v) => v.id === id))
      .filter((v): v is Variant => !!v)
      .map((v) => ({
        v,
        c: calculate(v.elements, v.selection, v.prices, v.settings),
      })),
    detailResult = c.elements.find((r) => r.element.id === detail),
    recalc = reprice ? calculateOffer(repriceOffer(offer, products)) : null;
  const delta = baseline
    ? Math.round((baseline.total - c.total) * 100) / 100
    : 0;
  const groups: { key: CostGroup; name: string; value: number }[] = [
    { key: "material", name: "Materijal", value: c.material },
    { key: "hardware", name: "Okovi", value: c.hardware },
    { key: "labor", name: "Rad", value: c.labor },
    { key: "assembly", name: "Montaža", value: c.assembly },
    { key: "transport", name: "Transport", value: c.transport },
    {
      key: "profit",
      name:
        offer.settings.profitMode === "margin"
          ? `Marža · ${offer.settings.margin}%`
          : `Doplata · ${offer.settings.markup}%`,
      value: c.profit,
    },
  ];
  const priceHeader = (
    <div className="price-focus">
      <span>
        {c.errors.length
          ? "Nepotpun obračun"
          : screen === "customer"
            ? "Ponuda za mušteriju"
            : "Ukupna cena kuhinje"}
      </span>
      <div className="price-amount" data-testid="total-price" key={c.total}>
        {new Intl.NumberFormat("sr-Latn-RS", {
          maximumFractionDigits: 2,
        }).format(c.total)}
        <small>RSD</small>
      </div>
      {screen === "optimize" && baseline && Math.abs(delta) > 0.009 && (
        <div
          className={`price-change ${delta < 0 ? "higher" : ""}`}
          role="status"
        >
          <span>{delta > 0 ? "Ušteda od početka" : "Skuplje od početka"}</span>
          <strong data-testid="price-difference">
            {money(Math.abs(delta))}
          </strong>
        </div>
      )}
    </div>
  );
  return (
    <section className={`price-view ${screen}`}>
      <div className="price-page-heading">
        <button
          className="icon-btn"
          aria-label={
            screen === "summary" ? "Nazad na kuhinju" : "Nazad na cenu"
          }
          onClick={() =>
            screen === "summary" ? onBack() : setScreen("summary")
          }
        >
          <ArrowLeft size={23} />
        </button>
        <h1>
          {screen === "optimize"
            ? "Materijali i okovi"
            : screen === "customer"
              ? "Ponuda"
              : "Cena"}
        </h1>
        {screen !== "optimize" && (
          <button
            className="icon-btn save-project"
            aria-label="Sačuvaj ponudu"
            onClick={() => void onSave()}
          >
            <Save size={22} />
          </button>
        )}
      </div>
      <div className={screen === "optimize" ? "optimization-total" : ""}>
        {priceHeader}
      </div>
      {c.errors.length > 0 && (
        <div className="error-note" role="alert">
          {c.errors.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </div>
      )}
      {screen === "summary" && (
        <>
          <div className="cost-categories">
            {groups.map((g) => (
              <button key={g.key} onClick={() => setCostGroup(g.key)}>
                <span>{g.name}</span>
                <strong>{money(g.value)}</strong>
                <ChevronRight size={20} />
              </button>
            ))}
          </div>
          <button
            className="btn primary full"
            onClick={() => {
              setBaseline({ total: c.total, cost: c.cost });
              setScreen("optimize");
            }}
          >
            <SlidersHorizontal size={22} /> Promeni materijale i okove
          </button>
          <div className="quote-primary-actions">
            <button
              className="btn secondary full"
              onClick={() => setScreen("customer")}
            >
              <FileText size={21} /> Ponuda za mušteriju{" "}
              <ArrowRight size={18} />
            </button>
            <button
              className="btn secondary full"
              disabled={!c.count || !!c.errors.length}
              onClick={() =>
                void exportPDF(offer).catch((e) => notify(e.message))
              }
            >
              <Download size={21} /> Napravi PDF
            </button>
          </div>
          <details className="disclosure">
            <summary>Opcije obračuna i ponude</summary>
            <button
              className="action-row"
              onClick={() => setQuoteSettings(true)}
            >
              <SlidersHorizontal size={20} /> Marža, rad i parametri obračuna
            </button>
            <button className="action-row" onClick={() => setReprice(true)}>
              <RefreshCw size={20} /> Preračunaj po novom cenovniku
            </button>
            <Field label="Napomena za mušteriju">
              <textarea
                rows={3}
                value={offer.note}
                onChange={(e) => onChange({ ...offer, note: e.target.value })}
              />
            </Field>
          </details>
          <details className="disclosure">
            <summary>Elementi i krojna lista</summary>
            {offer.elements.map((e) => (
              <button
                key={e.id}
                className="action-row"
                onClick={() => setDetail(e.id)}
              >
                <Cabinet kind={e.kind} size={34} />
                <span>{templates.find((t) => t.kind === e.kind)?.name}</span>
                <ChevronRight size={18} />
              </button>
            ))}
          </details>
          <p className="production-note">
            Obračun nije proizvodno proveren. Proveriti konstrukciju pre
            proizvodnje.
          </p>
        </>
      )}
      {screen === "optimize" && (
        <>
          <div className="compact-options">
            <fieldset>
              <legend>Klizači</legend>
              <div className="choice-buttons">
                {(["economy", "standard", "premium"] as Tier[]).map(
                  (tier, i) => (
                    <button
                      key={tier}
                      aria-pressed={
                        product(offer.selection.slide)?.tier === tier
                      }
                      onClick={() => selectModel("slide", "slide", tier)}
                    >
                      {["Ekonomični", "Standard", "Premium"][i]}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend>Frontovi</legend>
              <div className="choice-buttons">
                {["univer", "mdf", "lacquer"].map((kind, i) => (
                  <button
                    key={kind}
                    aria-pressed={product(offer.selection.front)?.kind === kind}
                    onClick={() =>
                      selectModel("front", "front", undefined, kind)
                    }
                  >
                    {["Univer", "MDF", "Lakirani MDF"][i]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Šarke</legend>
              <div className="choice-buttons">
                {(["economy", "standard", "premium"] as Tier[]).map(
                  (tier, i) => (
                    <button
                      key={tier}
                      aria-pressed={
                        product(offer.selection.hinge)?.tier === tier
                      }
                      onClick={() => selectModel("hinge", "hinge", tier)}
                    >
                      {["Osnovne", "Usporivači", "Premium"][i]}
                    </button>
                  ),
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend>Otvaranje</legend>
              <div className="choice-buttons">
                {(["handles", "gola", "push"] as const).map((opening, i) => (
                  <button
                    key={opening}
                    aria-pressed={offer.selection.opening === opening}
                    onClick={() =>
                      change({ selection: { ...offer.selection, opening } })
                    }
                  >
                    {["Ručke", "GOLA", "Push"][i]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {offer.elements.some((e) => e.locked) && (
            <p className="individual-note">
              <LockKeyhole size={17} />
              {offer.elements.filter((e) => e.locked).length} elemenata zadržava
              svoj izbor.
            </p>
          )}
          {previous && (
            <button
              className="btn secondary full"
              onClick={() => {
                onChange(previous);
                setPrevious(null);
              }}
            >
              <RotateCcw size={19} /> Vrati prethodnu varijantu
            </button>
          )}
          <details className="disclosure">
            <summary>Modeli i dobavljači</summary>
            {models("front", "front")}
            {models("slide", "slide")}
            {models("hinge", "hinge")}
            {models("body", "body")}
            {models("worktop", "worktop")}
            {models("lift", "lift")}
            {models("handle", "handle")}
            {models("gola", "gola")}
            {models("golaEnd", "golaEnd")}
            {models("push", "push")}
            {models("leg", "leg")}
          </details>
          <div className="variant-actions">
            <button
              className="btn secondary full"
              onClick={() => setVariantModal(true)}
            >
              <Plus size={20} /> Sačuvaj varijantu
            </button>
            {offer.variants.length >= 2 && (
              <button
                className="btn secondary full"
                onClick={() => {
                  setCompareIds(offer.variants.slice(0, 2).map((v) => v.id));
                  setCompare(true);
                }}
              >
                <GitCompareArrows size={20} /> Uporedi varijante
              </button>
            )}
          </div>
          {offer.variants.length > 0 && (
            <details className="disclosure">
              <summary>Sačuvane varijante ({offer.variants.length})</summary>
              {offer.variants.map((v) => (
                <div className="variant-row" key={v.id}>
                  <span>
                    <strong>{v.name}</strong>
                    <small>
                      {money(
                        calculate(v.elements, v.selection, v.prices, v.settings)
                          .total,
                      )}
                    </small>
                  </span>
                  <button
                    className="text-btn"
                    onClick={() => {
                      const normalized = ensureLayout({
                        ...offer,
                        ...structuredClone(v),
                        id: offer.id,
                        variants: offer.variants,
                      });
                      change({
                        selection: normalized.selection,
                        elements: normalized.elements,
                        prices: normalized.prices,
                        settings: normalized.settings,
                        layout: normalized.layout,
                        elevation: normalized.elevation,
                      });
                    }}
                  >
                    Primeni <ArrowRight size={18} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Obriši varijantu ${v.name}`}
                    onClick={() =>
                      onChange({
                        ...offer,
                        variants: offer.variants.filter((x) => x.id !== v.id),
                      })
                    }
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              ))}
            </details>
          )}
        </>
      )}
      {screen === "customer" && (
        <div className="customer-offer">
          <h2>{displayProject(offer.client.project)}</h2>
          {offer.client.name && (
            <p>
              {offer.client.name}
              {offer.client.location ? ` · ${offer.client.location}` : ""}
            </p>
          )}
          {offer.elements.map((e) => (
            <div className="customer-element" key={e.id}>
              <Cabinet kind={e.kind} size={39} />
              <span>
                {e.quantity} × {templates.find((t) => t.kind === e.kind)?.name}
                <small>
                  {e.width} × {e.height} × {e.depth} mm
                </small>
                <small>
                  {e.kind === "worktop"
                    ? product(
                        (e.locked ? e.selection : offer.selection).worktop,
                      )?.name
                    : product((e.locked ? e.selection : offer.selection).front)
                        ?.name}
                </small>
              </span>
            </div>
          ))}
          <p>{offer.note}</p>
          <p className="production-note">
            Obračun nije proizvodno proveren. Početne cene su izmišljeni
            primeri. Bez posebnog obračuna PDV-a.
          </p>
          <button
            className="btn primary full"
            disabled={!c.count || !!c.errors.length}
            onClick={() =>
              void exportPDF(offer).catch((e) => notify(e.message))
            }
          >
            <Download size={21} /> Napravi PDF
          </button>
        </div>
      )}
      {c.warnings.length > 0 && screen !== "customer" && (
        <details className="disclosure calculation-limits">
          <summary>Ograničenja obračuna</summary>
          {c.warnings.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </details>
      )}
      {quoteSettings && (
        <QuoteSettings
          settings={offer.settings}
          prices={offer.prices}
          onClose={() => setQuoteSettings(false)}
          onSave={(settings, prices) => change({ settings, prices })}
        />
      )}
      {costGroup && (
        <Modal
          title={groups.find((g) => g.key === costGroup)!.name}
          onClose={() => setCostGroup(null)}
          wide
        >
          {costGroup === "material" || costGroup === "hardware" ? (
            <>
              {c.usage
                .filter((u) =>
                  costGroup === "material"
                    ? ["body", "front", "back", "worktop", "edge"].includes(
                        u.product.category,
                      )
                    : !["body", "front", "back", "worktop", "edge"].includes(
                        u.product.category,
                      ),
                )
                .map((u) => (
                  <div className="usage-row" key={u.product.id}>
                    <span>
                      <strong>{u.product.name}</strong>
                      <small>
                        {number(u.area || u.quantity)}{" "}
                        {u.area ? "m²" : u.product.unit}
                        {u.sheets ? ` · minimum ${u.sheets} tabli` : ""}
                      </small>
                    </span>
                    <span>{money(u.cost)}</span>
                  </div>
                ))}
              {costGroup === "material" && (
                <p className="detail-note">
                  Površina sa {offer.settings.waste}% otpada · kant{" "}
                  {number(c.edge)} m. Broj celih tabli je površinski minimum bez
                  optimizacije krojenja.
                </p>
              )}
            </>
          ) : costGroup === "labor" ? (
            c.elements.map((r) => (
              <div className="usage-row" key={r.element.id}>
                <span>
                  {templates.find((t) => t.kind === r.element.kind)?.name} ×{" "}
                  {r.element.quantity}
                </span>
                <strong>{money(r.labor)}</strong>
              </div>
            ))
          ) : costGroup === "profit" ? (
            <>
              <p className="detail-note">
                {offer.settings.profitMode === "margin"
                  ? `Cena = trošak / (1 − ${offer.settings.margin}/100). Marža se računa u odnosu na prodajnu cenu.`
                  : `Cena = trošak × (1 + ${offer.settings.markup}/100). Doplata se računa u odnosu na trošak.`}
              </p>
              <button
                className="btn primary full"
                onClick={() => {
                  setCostGroup(null);
                  setQuoteSettings(true);
                }}
              >
                Izmeni
              </button>
            </>
          ) : (
            <div className="usage-row">
              <span>{groups.find((g) => g.key === costGroup)!.name}</span>
              <strong>
                {money(groups.find((g) => g.key === costGroup)!.value)}
              </strong>
            </div>
          )}
        </Modal>
      )}
      {detailResult && (
        <Modal
          title="Krojna lista elementa"
          wide
          onClose={() => setDetail(null)}
        >
          <p className="production-note">
            Obračun nije proizvodno proveren. Proveriti konstrukciju pre
            proizvodnje.
          </p>
          <p className="detail-note">
            {templates.find((t) => t.kind === detailResult.element.kind)?.rule}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Panel</th>
                  <th>mm</th>
                  <th>Debljina</th>
                  <th>Kom.</th>
                  <th>Kant / kom.</th>
                  <th>Materijal</th>
                </tr>
              </thead>
              <tbody>
                {detailResult.panels.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>
                      {number(p.width)} × {number(p.height)}
                    </td>
                    <td>{p.thickness}</td>
                    <td>{p.quantity}</td>
                    <td>{number(p.edge)} m</td>
                    <td>{product(p.material)?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detailResult.hardware.map((h, i) => (
            <div className="usage-row" key={i}>
              <span>{product(h.product)?.name}</span>
              <strong>
                {number(h.quantity)} {product(h.product)?.unit}
              </strong>
            </div>
          ))}
          <p className="detail-note">
            Količine panela i okova su za jedan element. Trošak za{" "}
            {detailResult.element.quantity} kom.: {money(detailResult.cost)}
          </p>
        </Modal>
      )}
      {variantModal && (
        <Modal title="Sačuvaj varijantu" onClose={() => setVariantModal(false)}>
          <Field label="Naziv varijante">
            <input
              list="variant-names"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
            />
            <datalist id="variant-names">
              <option>Ekonomična</option>
              <option>Standardna</option>
              <option>Premium</option>
            </datalist>
          </Field>
          <button
            className="btn primary full"
            disabled={!variantName.trim()}
            onClick={() => {
              onChange({
                ...offer,
                variants: [
                  ...offer.variants.filter(
                    (v) =>
                      v.name.toLowerCase() !== variantName.trim().toLowerCase(),
                  ),
                  {
                    id: uid(),
                    name: variantName.trim(),
                    selection: structuredClone(offer.selection),
                    elements: structuredClone(offer.elements),
                    prices: structuredClone(offer.prices),
                    settings: structuredClone(offer.settings),
                    layout: structuredClone(offer.layout),
                    elevation: structuredClone(offer.elevation),
                    createdAt: new Date().toISOString(),
                  },
                ],
              });
              setVariantModal(false);
            }}
          >
            Sačuvaj varijantu
          </button>
        </Modal>
      )}
      {compare && (
        <Modal title="Uporedi varijante" onClose={() => setCompare(false)}>
          {[0, 1].map((i) => (
            <Field key={i} label={`Varijanta ${i + 1}`}>
              <select
                value={compareIds[i]}
                onChange={(e) =>
                  setCompareIds(
                    compareIds.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
              >
                {offer.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <div className="compare-grid">
            {comparisons.map(({ v, c }, i) => (
              <div key={i}>
                <h3>{v.name}</h3>
                <strong>{money(c.total)}</strong>
                <p>{c.count} elemenata</p>
              </div>
            ))}
          </div>
          {comparisons.length === 2 && (
            <p className="comparison-difference">
              Razlika ukupne cene:{" "}
              <strong>
                {money(
                  Math.abs(comparisons[0].c.total - comparisons[1].c.total),
                )}
              </strong>
            </p>
          )}
        </Modal>
      )}
      {reprice && recalc && (
        <Modal
          title="Preračunaj po novom cenovniku"
          onClose={() => setReprice(false)}
        >
          <div className="usage-row">
            <span>Trenutna cena</span>
            <strong>{money(c.total)}</strong>
          </div>
          <div className="usage-row">
            <span>Nova cena</span>
            <strong>{money(recalc.total)}</strong>
          </div>
          <div className="usage-row">
            <span>Razlika</span>
            <strong>{money(recalc.total - c.total)}</strong>
          </div>
          {recalc.errors.length > 0 && (
            <div className="error-note">{recalc.errors.join(" ")}</div>
          )}
          <button
            className="btn primary full"
            disabled={!!recalc.errors.length}
            onClick={() => {
              change({ prices: structuredClone(products) });
              setReprice(false);
            }}
          >
            Potvrdi novi obračun
          </button>
        </Modal>
      )}
    </section>
  );
}
