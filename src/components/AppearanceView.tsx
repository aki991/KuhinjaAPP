import { useMemo, useState } from "react";
import {
  Check,
  Search,
  ArrowRight,
  LockKeyhole,
  ChevronRight,
} from "lucide-react";
import type {
  Offer,
  Product,
  Selection,
  SelectionProductKey,
} from "../core/types";
import { calculateOffer, rsd, unitPrice } from "../core/engine";
import { tallCabinet, upperCabinet } from "../core/opening";
import {
  productAppearance,
  selectionMaterials,
  productThickness,
} from "../core/appearance";
import { Field, Modal, money } from "./UI";
import OpeningChoices from "./OpeningChoices";
import { applianceStyles, golaPalette } from "../core/appearance";
import { floorTiles, tileById, wallTiles, type Tile } from "../core/tiles";
import { tileImage } from "./elevation/tileTexture";
import VerticalGolaSelect from "./VerticalGolaSelect";
/** Small preview of a tile pattern; an empty square for "no tile". */
function TileSwatch({ tile, large = false }: { tile?: Tile; large?: boolean }) {
  const image = useMemo(() => (tile ? tileImage(tile) : null), [tile]);
  return (
    <span
      className={`tile-swatch ${large ? "large" : ""}`}
      style={{
        backgroundColor: tile?.color ?? "transparent",
        backgroundImage: image ? `url(${image.url})` : undefined,
        // Show about three tiles across so the pattern is recognisable.
        backgroundSize: image
          ? `${Math.max(24, ((large ? 120 : 52) * 1.0))}px auto`
          : undefined,
      }}
      aria-hidden="true"
    />
  );
}
const tabs = [
  ["body", "Dekor korpusa"],
  ["front", "Frontovi"],
  ["worktop", "Radna ploča"],
  ["handle", "Ručice"],
] as const;
export default function AppearanceView({
  offer,
  products,
  onChange,
}: {
  offer: Offer;
  products: Product[];
  onChange: (o: Offer) => void;
}) {
  const [openTab, setOpenTab] = useState<(typeof tabs)[number][0] | null>(null),
    [query, setQuery] = useState(""),
    [color, setColor] = useState("all"),
    [scope, setScope] = useState<"base" | "wall">("base"),
    [thickness, setThickness] = useState<number | null>(null),
    [tileModal, setTileModal] = useState<"wall" | "floor" | null>(null);
  const tab = openTab ?? "body";
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
  /** A change made here applies to every element of that row again, dropping their own opening. */
  const followGlobal = (rows: ("base" | "wall" | "tall")[]) =>
    offer.elements.map((e) =>
      (e.ownOpening || e.locked) &&
      rows.includes(upperCabinet(e) ? "wall" : tallCabinet(e) ? "tall" : "base")
        ? { ...e, ownOpening: false, locked: false }
        : e,
    );
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
    if (tab === "handle")
      elements = followGlobal(scope === "wall" ? ["wall"] : ["base", "tall"]);
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
      } else {
        // A chosen handle replaces GOLA on the lower and tall cabinets right away.
        selection.opening = "handles";
        if (selection.tallOpening === "gola") selection.tallOpening = "handles";
      }
    }
    const t = productThickness(p);
    if (tab === "worktop" && t) {
      selection.worktopThickness = t;
      elements = elements.map((e) =>
        e.kind === "worktop" && !e.locked ? { ...e, height: t } : e,
      );
    }
    update(selection, elements, prices);
    setOpenTab(null);
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
  const swatch = (p: Product | undefined) => {
    const a = productAppearance(p);
    const image =
      a.image ?? (a.texture === "wood" ? "/brand/wood-light.png" : undefined);
    return (
      <span className="combo-swatch" style={{ backgroundColor: a.color }}>
        {image && (
          <img src={image} alt="" style={{ opacity: a.image ? 1 : 0.65 }} />
        )}
      </span>
    );
  };
  const named = (id: string | undefined) => catalog.find((p) => p.id === id);
  const sel = selectionMaterials(offer.selection);
  const openingLabel = {
    handles: "Ručke",
    push: "Push-to-open",
    overhang: "Prepušteni front",
    gola: "GOLA",
  };
  // Quantities used by the whole kitchen, with the waste allowance the price is based on.
  const waste = 1 + offer.settings.waste / 100,
    used = { body: 0, front: 0, worktop: 0, worktopLength: 0 };
  for (const r of calculation.elements)
    for (const p of r.panels) {
      const count = p.quantity * r.element.quantity,
        area = ((p.width * p.height) / 1e6) * count * waste,
        category = offer.prices.find((x) => x.id === p.material)?.category;
      if (category === "worktop") {
        used.worktop += area;
        used.worktopLength += (p.width / 1000) * count;
      } else if (p.name.startsWith("Front") || category === "front")
        used.front += area;
      else if (category === "body") used.body += area;
    }
  const quantity = (n: number, unit: string) =>
      `${new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2 }).format(n)} ${unit}`,
    amount = (n: number, unit: string) => `Iskorišćeno: ${quantity(n, unit)}`;
  const golaLength = calculation.usage
    .filter((u) => u.product.category === "gola")
    .reduce((a, u) => a + u.quantity, 0);
  const rows: {
    key: (typeof tabs)[number][0];
    label: string;
    product: Product | undefined;
    sub?: string;
    used?: string;
    wall?: boolean;
  }[] = [
    {
      key: "body",
      label: "Dekor korpusa",
      product: named(sel.body),
      used: amount(used.body, "m²"),
    },
    {
      key: "front",
      label: "Frontovi",
      product: named(sel.front),
      used: amount(used.front, "m²"),
      sub:
        offer.selection.frontMode === "body"
          ? "Isto kao korpus"
          : offer.selection.frontMode === "ral"
            ? "Lakirani MDF" +
              (offer.selection.ralCode
                ? " · RAL " + offer.selection.ralCode
                : "")
            : undefined,
    },
    {
      key: "worktop",
      label: "Radna ploča",
      product: named(sel.worktop),
      sub: (() => {
        const p = named(sel.worktop);
        const t = p ? productThickness(p) : undefined;
        return t ? t + " mm" : undefined;
      })(),
      used:
        named(sel.worktop)?.unit === "m"
          ? amount(used.worktopLength, "m dužnih")
          : amount(used.worktop, "m²"),
    },
    {
      key: "handle",
      label: "Ručice i otvaranje",
      product: named(sel.handle),
      sub: `Viseći: ${named(offer.selection.wallHandle)?.name ?? "iste ručice"} · Otvaranje: donji ${openingLabel[offer.selection.opening].toLowerCase()}, viseći ${openingLabel[offer.selection.wallOpening ?? "handles"].toLowerCase()}, visoki ${openingLabel[offer.selection.tallOpening ?? offer.selection.opening].toLowerCase()}`,
      used:
        calculation.handleCount > 0 || golaLength > 0
          ? "Iskorišćeno: " +
            [
              calculation.handleCount > 0 &&
                quantity(calculation.handleCount, "kom ručki"),
              golaLength > 0 && quantity(golaLength, "m GOLA profila"),
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined,
    },
  ];
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
      <div className="combo-card">
        <h2>Vaša kombinacija</h2>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            className="combo-row"
            aria-label={r.label}
            onClick={() => {
              setOpenTab(r.key);
              setQuery("");
              setColor("all");
              setThickness(null);
              if (r.key === "handle") setScope("base");
            }}
          >
            {swatch(r.product)}
            <span className="combo-text">
              <small>{r.label}</small>
              <strong>{r.product?.name ?? "—"}</strong>
              {r.sub && <small>{r.sub}</small>}
              {r.used && <small className="combo-used">{r.used}</small>}
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="combo-card room-card">
        <h2>Prostorija i bela tehnika</h2>
        <p className="combo-hint">
          Samo za vizuelni prikaz kuhinje: ne ulazi u cenu ni u ponudu.
        </p>
        <span className="field-label appliance-colors-label">
          Boja bele tehnike (frižider, rerna, aspirator)
        </span>
        <div
          className="choice-buttons gola-colors appliance-colors"
          role="group"
          aria-label="Boja bele tehnike"
        >
          {(["black", "white", "gray"] as const).map((c) => (
            <button
              key={c}
              aria-pressed={(offer.selection.applianceColor ?? "white") === c}
              onClick={() => update({ ...offer.selection, applianceColor: c })}
            >
              <span
                className="gola-swatch"
                style={{ background: applianceStyles[c].body }}
                aria-hidden="true"
              />
              {golaPalette[c].label}
            </button>
          ))}
        </div>
        {(["wall", "floor"] as const).map((area) => {
          const tile = tileById(
            area === "wall" ? offer.selection.wallTile : offer.selection.floorTile,
          );
          return (
            <button
              key={area}
              type="button"
              className="combo-row"
              aria-label={area === "wall" ? "Zidne pločice" : "Podne pločice"}
              onClick={() => setTileModal(area)}
            >
              <TileSwatch tile={tile} />
              <span className="combo-text">
                <small>{area === "wall" ? "Zidne pločice" : "Podne pločice"}</small>
                <strong>{tile?.name ?? "Bez pločica"}</strong>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {tileModal && (
        <Modal
          title={tileModal === "wall" ? "Zidne pločice" : "Podne pločice"}
          wide
          onClose={() => setTileModal(null)}
        >
          <div className="tile-grid" role="listbox">
            {[undefined, ...(tileModal === "wall" ? wallTiles : floorTiles)].map(
              (tile) => {
                const current =
                  tileModal === "wall"
                    ? offer.selection.wallTile
                    : offer.selection.floorTile;
                return (
                  <button
                    key={tile?.id ?? "none"}
                    type="button"
                    role="option"
                    aria-selected={current === tile?.id}
                    aria-pressed={current === tile?.id}
                    className="tile-choice"
                    onClick={() => {
                      update({
                        ...offer.selection,
                        [tileModal === "wall" ? "wallTile" : "floorTile"]: tile?.id,
                      });
                      setTileModal(null);
                    }}
                  >
                    <TileSwatch tile={tile} large />
                    <span>{tile?.name ?? "Bez pločica"}</span>
                  </button>
                );
              },
            )}
          </div>
        </Modal>
      )}
      {openTab && (
        <Modal
          title={
            openTab === "handle"
              ? "Ručice i otvaranje"
              : tabs.find(([v]) => v === openTab)![1]
          }
          wide
          onClose={() => setOpenTab(null)}
        >
          <div
            role="tabpanel"
            aria-label={tabs.find(([v]) => v === openTab)![1]}
          >
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
                            p.id === offer.selection.front &&
                            p.kind === "lacquer",
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
                          update({
                            ...offer.selection,
                            ralCode: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Boja prikaza">
                      <input
                        type="color"
                        value={offer.selection.ralColor ?? "#ddcfb5"}
                        onChange={(e) =>
                          update({
                            ...offer.selection,
                            ralColor: e.target.value,
                          })
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
                <h3 className="appearance-subtitle">Otvaranje</h3>
                <OpeningChoices
                  label="Otvaranje donjih"
                  value={offer.selection.opening}
                  options={["handles", "gola", "push"]}
                  onChange={(opening) =>
                    update(
                      {
                        ...offer.selection,
                        opening,
                        wallOpening: offer.selection.wallOpening ?? "handles",
                        tallOpening:
                          offer.selection.tallOpening ??
                          (offer.selection.opening === "overhang"
                            ? "handles"
                            : offer.selection.opening),
                      },
                      followGlobal(["base"]),
                    )
                  }
                />
                <OpeningChoices
                  label="Otvaranje visećih"
                  value={offer.selection.wallOpening ?? "handles"}
                  options={["handles", "push", "overhang"]}
                  onChange={(wallOpening) =>
                    update(
                      {
                        ...offer.selection,
                        wallOpening: wallOpening as
                          "handles" | "push" | "overhang",
                      },
                      followGlobal(["wall"]),
                    )
                  }
                  extension={offer.selection.frontOverhang ?? 20}
                  onExtension={(frontOverhang) =>
                    update(
                      { ...offer.selection, frontOverhang },
                      followGlobal(["wall"]),
                    )
                  }
                />
                <OpeningChoices
                  label="Otvaranje visokih"
                  value={offer.selection.tallOpening ?? offer.selection.opening}
                  vertical
                  options={["handles", "gola", "push"]}
                  onChange={(tallOpening) =>
                    update(
                      {
                        ...offer.selection,
                        tallOpening: tallOpening as "handles" | "push" | "gola",
                      },
                      followGlobal(["tall"]),
                    )
                  }
                />
                {offer.selection.tallOpening === "gola" && (
                  <VerticalGolaSelect
                    value={offer.selection.verticalGola}
                    products={offer.prices}
                    onChange={(verticalGola, prices) =>
                      update(
                        { ...offer.selection, verticalGola },
                        followGlobal(["tall"]),
                        prices,
                      )
                    }
                  />
                )}
                {[
                  offer.selection.opening,
                  offer.selection.wallOpening,
                  offer.selection.tallOpening,
                ].includes("push") && productSelect("push", "Push mehanizam")}
                {[offer.selection.opening, offer.selection.tallOpening].includes(
                  "gola",
                ) && (
                  <div
                    className="choice-buttons gola-colors"
                    role="group"
                    aria-label="Boja GOLA profila"
                  >
                    <span className="field-label">Boja GOLA profila</span>
                    {(["black", "white", "gray"] as const).map((c) => (
                      <button
                        key={c}
                        aria-pressed={(offer.selection.golaColor ?? "black") === c}
                        onClick={() => update({ ...offer.selection, golaColor: c })}
                      >
                        <span
                          className="gola-swatch"
                          style={{ background: golaPalette[c].hex }}
                          aria-hidden="true"
                        />
                        {golaPalette[c].label}
                      </button>
                    ))}
                  </div>
                )}
                <h3 className="appearance-subtitle">Ručice</h3>
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
              </>
            )}
            {!(tab === "front" && offer.selection.frontMode === "body") && (
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
                Frontovi prate izabrani korpus. Materijal i cena se
                preračunavaju automatski.
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
          </div>
        </Modal>
      )}
      <section className="combo-card combo-details" aria-label="Detalji izrade">
        <h2>Detalji izrade</h2>
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
      </section>
      {!!calculation.errors.length && (
        <div className="opening-problem" role="alert">
          <span>{calculation.errors[0]}</span>
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
