import { useMemo, useState } from "react";
import { Check, Search, ArrowRight, LockKeyhole } from "lucide-react";
import type {
  Offer,
  Product,
  Selection,
  SelectionProductKey,
} from "../core/types";
import { calculateOffer, rsd, unitPrice } from "../core/engine";
import {
  productAppearance,
  selectionMaterials,
  productThickness,
} from "../core/appearance";
import { Field, money } from "./UI";
const tabs = [
  ["body", "Korpus"],
  ["front", "Frontovi"],
  ["worktop", "Radna ploča"],
  ["handle", "Ručice"],
  ["details", "Detalji izrade"],
] as const;
export default function AppearanceView({
  offer,
  products,
  onChange,
  onOpening,
}: {
  offer: Offer;
  products: Product[];
  onChange: (o: Offer) => void;
  onOpening: () => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("body"),
    [query, setQuery] = useState(""),
    [color, setColor] = useState("all"),
    [scope, setScope] = useState<"base" | "wall">("base"),
    [thickness, setThickness] = useState<number | null>(null);
  const calculation = useMemo(() => calculateOffer(offer), [offer]);
  const catalog = useMemo(
    () => [
      ...offer.prices.map((p) => {
        const current = products.find((c) => c.id === p.id);
        return {
          ...p,
          appearance: current?.appearance ?? p.appearance,
          thickness: current?.thickness ?? p.thickness,
        };
      }),
      ...products.filter((p) => !offer.prices.some((s) => s.id === p.id)),
    ],
    [offer.prices, products],
  );
  const update = (
    selection: Selection,
    elements = offer.elements,
    prices = offer.prices,
    settings = offer.settings,
  ) =>
    onChange({
      ...offer,
      selection,
      elements,
      prices,
      settings,
      updatedAt: new Date().toISOString(),
    });
  const pick = (p: Product) => {
    const key = tab as SelectionProductKey,
      selection = { ...offer.selection, [key]: p.id },
      prices = offer.prices.some((s) => s.id === p.id)
        ? offer.prices.map((s) =>
            s.id === p.id
              ? { ...s, appearance: p.appearance, thickness: p.thickness }
              : s,
          )
        : [...offer.prices, p];
    let elements = offer.elements;
    if (tab === "front")
      selection.frontMode =
        p.kind === "lacquer" && offer.selection.frontMode === "ral"
          ? "ral"
          : "separate";
    if (tab === "handle") {
      if (scope === "wall") {
        selection.handle = offer.selection.handle;
        selection.wallHandle = p.id;
        selection.wallOpening = "handles";
      } else selection.opening = "handles";
    }
    const t = productThickness(p);
    if (tab === "worktop" && t) {
      selection.worktopThickness = t;
      elements = elements.map((e) =>
        e.kind === "worktop" && !e.locked ? { ...e, height: t } : e,
      );
    }
    update(selection, elements, prices);
  };
  const selected =
    tab === "front"
      ? selectionMaterials(offer.selection).front
      : tab === "handle" && scope === "wall"
        ? (offer.selection.wallHandle ?? offer.selection.handle)
        : offer.selection[tab as SelectionProductKey];
  const articlePrice = (p: Product) => {
    if (p.unit === "m²" || p.unit === "tabla") {
      try {
        return (
          unitPrice(p, offer.settings, "area") *
          (p.unit === "tabla"
            ? ((p.sheetWidth ?? 0) * (p.sheetHeight ?? 0)) / 1e6
            : 1)
        );
      } catch {
        return rsd(p, offer.settings);
      }
    }
    return rsd(p, offer.settings);
  };
  const choices = catalog
    .filter((p) => p.active && p.category === tab)
    .filter(
      (p) =>
        !(tab === "front" && offer.selection.frontMode === "ral") ||
        p.kind === "lacquer",
    )
    .filter(
      (p) =>
        !thickness || tab !== "worktop" || productThickness(p) === thickness,
    )
    .filter((p) =>
      `${p.name} ${p.code} ${p.manufacturer} ${p.supplier}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .filter((p) => {
      const a = productAppearance(p),
        light =
          parseInt(a.color.slice(1, 3), 16) * 0.3 +
          parseInt(a.color.slice(3, 5), 16) * 0.59 +
          parseInt(a.color.slice(5, 7), 16) * 0.11;
      return (
        color === "all" ||
        (color === "wood"
          ? a.texture === "wood"
          : color === "light"
            ? light >= 155
            : light < 155)
      );
    });
  const productSelect = (key: SelectionProductKey, label: string) => (
    <Field label={label}>
      <select
        value={offer.selection[key]}
        onChange={(e) => update({ ...offer.selection, [key]: e.target.value })}
      >
        {catalog
          .filter((p) => p.active && p.category === key)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {money(rsd(p, offer.settings))}/{p.unit}
            </option>
          ))}
      </select>
    </Field>
  );
  return (
    <section className="appearance-view">
      <h1>Izgled</h1>
      <div className="appearance-total">
        <span>
          {calculation.errors.length
            ? "Nepotpun obračun"
            : "Ukupna cena kuhinje"}
        </span>
        <strong data-testid="appearance-total">
          {money(calculation.total)}
        </strong>
      </div>
      <div
        className="appearance-tabs"
        role="tablist"
        aria-label="Materijali i detalji"
      >
        {tabs.map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => {
              setTab(v);
              setQuery("");
              setColor("all");
              setThickness(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tabs.find(([v]) => v === tab)![1]}>
        {tab === "front" && (
          <>
            <div
              className="choice-buttons appearance-front-mode"
              role="group"
              aria-label="Vrsta frontova"
            >
              <button
                aria-pressed={offer.selection.frontMode === "body"}
                onClick={() =>
                  update({ ...offer.selection, frontMode: "body" })
                }
              >
                Isto kao korpus
              </button>
              <button
                aria-pressed={
                  !offer.selection.frontMode ||
                  offer.selection.frontMode === "separate"
                }
                onClick={() =>
                  update({ ...offer.selection, frontMode: "separate" })
                }
              >
                Drugi dekor
              </button>
              <button
                aria-pressed={offer.selection.frontMode === "ral"}
                disabled={
                  !catalog.some(
                    (p) =>
                      p.active &&
                      p.category === "front" &&
                      p.kind === "lacquer",
                  )
                }
                onClick={() => {
                  const p =
                    catalog.find(
                      (p) =>
                        p.id === offer.selection.front && p.kind === "lacquer",
                    ) ??
                    catalog.find(
                      (p) =>
                        p.active &&
                        p.category === "front" &&
                        p.kind === "lacquer",
                    );
                  if (p)
                    update(
                      { ...offer.selection, front: p.id, frontMode: "ral" },
                      offer.elements,
                      offer.prices.some((s) => s.id === p.id)
                        ? offer.prices
                        : [...offer.prices, p],
                    );
                }}
              >
                Lakirani MDF (RAL)
              </button>
            </div>
            {offer.selection.frontMode === "ral" && (
              <div className="field-grid">
                <Field label="RAL oznaka">
                  <input
                    value={offer.selection.ralCode ?? ""}
                    placeholder="Unesite oznaku"
                    onChange={(e) =>
                      update({ ...offer.selection, ralCode: e.target.value })
                    }
                  />
                </Field>
                <Field label="Boja prikaza">
                  <input
                    type="color"
                    value={offer.selection.ralColor ?? "#ddcfb5"}
                    onChange={(e) =>
                      update({ ...offer.selection, ralColor: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}
          </>
        )}
        {tab === "worktop" && (
          <div
            className="choice-buttons appearance-thickness"
            role="group"
            aria-label="Debljina radne ploče"
          >
            <button
              aria-pressed={thickness === null}
              onClick={() => setThickness(null)}
            >
              Sve debljine
            </button>
            {[
              ...new Set(
                catalog
                  .filter((p) => p.category === "worktop" && p.active)
                  .map(productThickness)
                  .filter((n): n is number => n !== undefined),
              ),
            ].map((t) => (
              <button
                key={t}
                aria-pressed={thickness === t}
                onClick={() => setThickness(t)}
              >
                {t} mm
              </button>
            ))}
          </div>
        )}
        {tab === "handle" && (
          <>
            <div
              className="choice-buttons"
              role="group"
              aria-label="Ručice za red"
            >
              <button
                aria-pressed={scope === "base"}
                onClick={() => setScope("base")}
              >
                Donji elementi
              </button>
              <button
                aria-pressed={scope === "wall"}
                onClick={() => setScope("wall")}
              >
                Viseći elementi
              </button>
            </div>
            {scope === "wall" && (
              <button
                className="btn secondary full"
                aria-pressed={!offer.selection.wallHandle}
                onClick={() =>
                  update({ ...offer.selection, wallHandle: undefined })
                }
              >
                Iste kao dole
              </button>
            )}
            <button className="text-btn" onClick={onOpening}>
              Bez ručica — izaberi sistem otvaranja <ArrowRight size={16} />
            </button>
          </>
        )}
        {tab !== "details" &&
          !(tab === "front" && offer.selection.frontMode === "body") && (
            <>
              <div className="appearance-search">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Pronađi dekor ili artikal"
                    placeholder={
                      tab === "handle" ? "Pronađi ručicu" : "Pronađi dekor"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Boje dekora"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                >
                  <option value="all">Sve boje</option>
                  <option value="light">Svetle</option>
                  <option value="dark">Tamne</option>
                  <option value="wood">Drveni dekori</option>
                </select>
              </div>
              <div className="appearance-grid">
                {choices.map((p) => {
                  const active = p.id === selected,
                    a =
                      tab === "front" &&
                      active &&
                      offer.selection.frontMode === "ral" &&
                      offer.selection.ralColor
                        ? {
                            ...productAppearance(p),
                            color: offer.selection.ralColor,
                            texture: "solid" as const,
                            image: undefined,
                          }
                        : productAppearance(p);
                  const image =
                    a.image ??
                    (a.texture === "wood"
                      ? "/brand/wood-light.png"
                      : undefined);
                  return (
                    <button
                      className={`decor-card ${active ? "selected" : ""}`}
                      key={p.id}
                      aria-pressed={active}
                      aria-label={`Izaberi ${p.name}`}
                      onClick={() => pick(p)}
                    >
                      <span
                        className={`decor-sample ${tab === "handle" ? "handle-sample" : ""}`}
                        style={{
                          backgroundColor:
                            tab === "handle" ? "#fffaf1" : a.color,
                        }}
                      >
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            style={{ opacity: a.image ? 1 : 0.65 }}
                          />
                        ) : tab === "handle" ? (
                          <svg viewBox="0 0 140 70" aria-hidden="true">
                            <path
                              d="M27 51v-13L110 17v14M23 36L108 13l9 7L31 44Z"
                              fill={a.color}
                              stroke="#62645e"
                              strokeWidth="2"
                            />
                          </svg>
                        ) : a.texture === "stone" ? (
                          <svg viewBox="0 0 140 70" aria-hidden="true">
                            <path
                              d="M-20 30Q50 90 160 5M-10 3Q80 35 140 80"
                              stroke="#ffffff75"
                              strokeWidth="2"
                              fill="none"
                            />
                          </svg>
                        ) : null}
                        {active && (
                          <span className="decor-check">
                            <Check size={16} />
                          </span>
                        )}
                      </span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.manufacturer || p.supplier} ·{" "}
                        {money(articlePrice(p))}/{p.unit}
                        {p.processing ? " · sa obradom" : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
              {!choices.length && (
                <p className="empty">
                  Nema artikala za ovaj izbor. Dodajte ih u Podešavanja →
                  Cenovnik.
                </p>
              )}
            </>
          )}
        {tab === "front" && offer.selection.frontMode === "body" && (
          <p className="info-note">
            Frontovi prate izabrani korpus. Materijal i cena se preračunavaju
            automatski.
          </p>
        )}
        {tab === "handle" && (
          <fieldset className="handle-position">
            <legend>Položaj ručica na vratima</legend>
            <div className="choice-buttons">
              {(
                [
                  ["vertical", "Uspravno"],
                  ["horizontal", "Vodoravno"],
                  ["center", "Na sredini"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  aria-pressed={
                    (offer.selection.handlePosition ?? "vertical") === v
                  }
                  onClick={() =>
                    update({ ...offer.selection, handlePosition: v })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {tab === "details" && (
          <div className="appearance-details">
            {productSelect("edge", "Kant traka")}
            <Field label="Kantovane ivice korpusa">
              <select
                value={offer.settings.edgeMode}
                onChange={(e) =>
                  update(offer.selection, offer.elements, offer.prices, {
                    ...offer.settings,
                    edgeMode: e.target.value as "front" | "all",
                  })
                }
              >
                <option value="front">Samo prednja ivica</option>
                <option value="all">Sve ivice stranica, dna i krova</option>
              </select>
            </Field>
            {productSelect("back", "Leđa")}
            {productSelect("slide", "Sistem fioka")}
            {productSelect("hinge", "Šarke")}
            {productSelect("leg", "Nogice")}
            <Field label="Visina sokle / nogica (mm)">
              <input
                type="number"
                min="0"
                max="300"
                value={offer.elevation?.toeKick ?? 100}
                onChange={(e) =>
                  onChange({
                    ...offer,
                    elevation: {
                      ...offer.elevation!,
                      toeKick: Math.max(
                        0,
                        Math.min(300, Number(e.target.value) || 0),
                      ),
                    },
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            </Field>
          </div>
        )}
      </div>
      {!!calculation.errors.length && (
        <div className="opening-problem" role="alert">
          <span>{calculation.errors[0]}</span>
          <button className="btn secondary small" onClick={onOpening}>
            Reši
          </button>
        </div>
      )}
      {offer.elements.some((e) => e.locked) && (
        <p className="individual-note">
          <LockKeyhole size={16} />
          Individualno zaključani izbori ostaju sačuvani.
        </p>
      )}
    </section>
  );
}
