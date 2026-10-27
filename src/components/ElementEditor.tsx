import { useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { categories, templates } from "../core/catalog";
import { referenceDescriptions } from "../core/reference-descriptions";
import { appendPlacement, isBridge } from "../core/layout";
import type {
  Category,
  KitchenElement,
  KitchenWall,
  Product,
  Selection,
  Settings,
  KitchenLayout,
  SelectionProductKey,
  Offer,
} from "../core/types";
import { construct } from "../core/construction";
import {
  effectiveSelection,
  standardWall,
  upperCabinet,
  wallFrontHeight,
  tallCabinet,
} from "../core/opening";
import { pushSelection } from "../core/opening-kits";
import PushSystemDialog from "./PushSystemDialog";
import VerticalGolaSelect from "./VerticalGolaSelect";
import { Field, Modal } from "./UI";
import LibraryThumbnail from "./elevation/LibraryThumbnail";
export default function ElementEditor({
  element,
  offer,
  products: initialProducts,
  global,
  settings,
  walls = [],
  elements = [],
  layout,
  islandPlan,
  isNew = false,
  onSave,
  onClose,
  actions,
}: {
  element: KitchenElement;
  offer: Offer;
  products: Product[];
  global: Selection;
  settings: Settings;
  walls?: KitchenWall[];
  elements?: KitchenElement[];
  layout?: KitchenLayout;
  isNew?: boolean;
  islandPlan?: (
    draft: KitchenElement,
    pos?: { x: number; y: number } | null,
  ) => {
    x: number;
    y: number;
    width: number;
    depth: number;
    warnings: string[];
  } | null;
  onSave: (
    e: KitchenElement,
    prices?: Product[],
    extra?: { islandPosition: { x: number; y: number } | null },
  ) => void;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const [value, setValue] = useState({
      ...element,
      selection: effectiveSelection(element, global),
    }),
    [errors, setErrors] = useState<string[]>([]);
  const [products, setProducts] = useState(initialProducts),
    [pushDialog, setPushDialog] = useState(false);
  const [island0] = useState(() => islandPlan?.(element) ?? null),
    [pos, setPos] = useState({ x: island0?.x ?? 0, y: island0?.y ?? 0 }),
    [auto, setAuto] = useState(!layout?.islandPosition);
  const island = islandPlan
    ? islandPlan(value, auto ? null : pos)
    : null;
  const lengthA = walls.find((w) => w.id === "A")?.length || 0,
    lengthB = walls.find((w) => w.id === "B")?.length,
    hasC = walls.some((w) => w.id === "C");
  const shown = auto && island ? { x: island.x, y: island.y } : pos;
  const setPosition = (next: Partial<typeof pos>) => {
    setPos({ ...shown, ...next });
    setAuto(false);
  };
  const distance = (
    label: string,
    amount: number,
    onChange: (v: number) => void,
    min?: number,
  ) => (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max="100000"
        required
        value={Number.isFinite(amount) ? amount : ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
  const t = templates.find((t) => t.kind === element.kind)!;
  const description = referenceDescriptions[element.kind] ?? t.rule;
  const canChangeHinge = value.doors === 1 && !["lift", "liftDouble", "liftFolding"].includes(value.kind) && !["fridge", "dishwasher", "oven"].includes(value.visual?.appliance || "");
  const numeric = (
    key:
      | "width"
      | "height"
      | "depth"
      | "quantity"
      | "doors"
      | "drawers"
      | "shelves"
      | "extra",
    label: string,
    min: number,
    max: number,
  ) => (
    <Field label={label}>
      <input
        type="number"
        inputMode={key === "extra" ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={key === "extra" ? 0.01 : 1}
        required
        value={value[key] === 0 && min > 0 ? "" : value[key]}
        onChange={(e) => setValue({ ...value, [key]: Number(e.target.value) })}
      />
    </Field>
  );
  const select = (
    key: SelectionProductKey,
    category: Category,
    label = categories[category],
  ) => (
    <Field label={label}>
      <select
        value={value.selection[key]}
        onChange={(e) =>
          setValue({
            ...value,
            selection: {
              ...value.selection,
              [key]: e.target.value,
              ...(key === "front" ? { frontMode: "separate" as const } : {}),
            },
            ...(key === "push" ? { ownOpening: true } : { locked: true }),
          })
        }
      >
        {products
          .filter(
            (p) =>
              (p.active && p.category === category) ||
              p.id === value.selection[key],
          )
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.supplier}
            </option>
          ))}
      </select>
    </Field>
  );
  return (
    <>
      <Modal title={t.name} onClose={onClose}>
        <form
          className="element-editor"
          onSubmit={(e) => {
            e.preventDefault();
            const check = construct(
              value,
              effectiveSelection(value, global),
              settings,
              products,
            );
            if (check.errors.length) {
              setErrors(check.errors);
              return;
            }
            if (
              island &&
              !auto &&
              ![pos.x, pos.y].every(
                (v) => Number.isFinite(v) && v >= 0 && v <= 100000,
              )
            ) {
              setErrors([
                "Položaj od početka zidova mora biti između 0 i 100.000 mm.",
              ]);
              return;
            }
            onSave(
              value,
              products,
              island ? { islandPosition: auto ? null : pos } : undefined,
            );
            onClose();
          }}
        >
          <div className="compact-element-editor">
            <div className="editor-drawing">
              <LibraryThumbnail element={value} offer={{ ...offer, prices: products }} />
            </div>
            <div className="compact-element-controls">
              {actions}
              <div className="field-grid">
                {numeric("width", "Širina", value.kind.startsWith("reference") && t.width < 80 ? 10 : 80, 6000)}
                {numeric("height", "Visina", 40, 3000)}
              </div>
              {island && (
                <>
                  {numeric("depth", "Dubina ostrva", 100, 3000)}
                  {distance("Udaljenost od zida A (mm)", shown.y, (v) =>
                    setPosition({ y: v }), 0)}
                  {lengthB !== undefined ? (
                    distance(
                      "Udaljenost od zida B (mm)",
                      Math.round(lengthA - shown.x - island.width),
                      (v) => setPosition({ x: lengthA - island.width - v }),
                    )
                  ) : (
                    distance(
                      "Od početka zida A (mm)",
                      shown.x,
                      (v) => setPosition({ x: v }),
                      0,
                    )
                  )}
                  {hasC &&
                    lengthB !== undefined &&
                    distance(
                      "Udaljenost od zida C (mm)",
                      Math.round(lengthB - shown.y - island.depth),
                      (v) => setPosition({ y: lengthB - island.depth - v }),
                    )}
                  <p className="field-hint">
                    Udaljenosti su merene od zida do najbliže ivice ostrva.
                    Negativna vrednost znači da ostrvo prelazi liniju zida.
                  </p>
                  {island.warnings.map((warning) => (
                    <p className="layout-warning" key={warning}>
                      {warning}
                    </p>
                  ))}
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={auto}
                    onClick={() => setAuto(true)}
                  >
                    Automatski položaj
                  </button>
                </>
              )}
              <Field label="Smer otvaranja vrata">
                <select disabled={!canChangeHinge} value={canChangeHinge ? value.visual?.hinge || (value.drawers > 0 ? "right" : "left") : "none"}
                  onChange={(e) => setValue({ ...value, visual: { ...value.visual, hinge: e.target.value as "left" | "right" } })}>
                  {!canChangeHinge && <option value="none">Nije primenljivo</option>}
                  <option value="left">Levo</option>
                  <option value="right">Desno</option>
                </select>
              </Field>
            <Field label="Otvaranje">
              <select
                value={value.selection.opening}
                onChange={(e) => {
                  if (
                    e.target.value === "push" &&
                    (standardWall(value) ||
                      tallCabinet(value) ||
                      value.kind === "lift") &&
                    construct(
                      value,
                      { ...value.selection, opening: "push" },
                      settings,
                      products,
                    ).errors.length
                  ) {
                    setPushDialog(true);
                    return;
                  }
                  setValue({
                    ...value,
                    ownOpening: true,
                    selection: {
                      ...value.selection,
                      opening: e.target.value as Selection["opening"],
                    },
                  });
                }}
              >
                <option value="handles">Klasične ručke</option>
                {!upperCabinet(value) && (
                  <option value="gola">
                    {tallCabinet(value) ? "Vertikalna GOLA" : "GOLA profili"}
                  </option>
                )}
                <option value="push">Push-to-open</option>
                {upperCabinet(value) && (
                  <option value="overhang">Prepušteni frontovi</option>
                )}
              </select>
            </Field>
            {tallCabinet(value) && value.selection.opening === "gola" && (
              <VerticalGolaSelect
                value={value.selection.verticalGola}
                products={products}
                onChange={(verticalGola, prices) => {
                  setProducts(prices);
                  setValue({
                    ...value,
                    ownOpening: true,
                    selection: { ...value.selection, verticalGola },
                  });
                }}
              />
            )}
            {value.selection.opening === "push" &&
              (standardWall(value) ||
                tallCabinet(value) ||
                value.kind === "lift") && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setPushDialog(true)}
                >
                  Izaberi Push komplet
                </button>
              )}
            {upperCabinet(value) && value.selection.opening === "overhang" && (
              <Field
                label="Prepust fronta (mm)"
                hint={`Visina fronta: ${wallFrontHeight(value, value.selection, settings.gap)} mm`}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="100"
                  required
                  value={value.selection.frontOverhang ?? 20}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      ownOpening: true,
                      selection: {
                        ...value.selection,
                        frontOverhang: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            )}
            {value.selection.opening === "push" &&
              select("push", "push", "Push mehanizam")}
            </div>
          </div>
          {description && <p className="element-description">{description}</p>}
          <fieldset hidden disabled className="element-advanced-hidden">
          <div className="dimension-fields">
            {numeric("depth", "Dubina", 10, 1500)}
          </div>
          <div className="field-grid">
            {value.kind.startsWith("reference") && t.unsupported ? null : t.drawers > 0
              ? numeric("drawers", "Broj fioka", 1, 6)
              : t.doors > 0
                ? numeric("doors", "Broj vrata", 1, 4)
                : null}
            {numeric("quantity", "Količina", 1, 100)}
          </div>
          {value.kind === "worktop"
            ? select("worktop", "worktop", "Materijal")
            : !["oven", "open", "plinth"].includes(value.kind)
              ? select("front", "front", "Materijal fronta")
              : select("body", "body", "Materijal korpusa")}
          {value.drawers > 0
            ? select("slide", "slide", "Klizači")
            : value.kind === "lift"
              ? select("lift", "lift", "Podizni mehanizam")
              : value.doors > 0 && select("hinge", "hinge", "Šarke")}
          <label className="check-field">
            <input
              type="checkbox"
              checked={value.locked}
              onChange={(e) => setValue({ ...value, locked: e.target.checked })}
            />
            <LockKeyhole size={18} />
            <span>Zadrži moj izbor</span>
          </label>
          <details className="editor-details">
            <summary>Dodatna podešavanja</summary>
            {walls.length > 0 && (
              <>
                <Field label="Zid / grupa">
                  <select
                    value={value.placement?.wall || walls[0].id}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        placement: appendPlacement(
                          elements.filter((x) => x.id !== value.id),
                          value,
                          e.target.value,
                          layout,
                        ),
                      })
                    }
                  >
                    {walls.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mesto u redu">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10000"
                    value={(value.placement?.order ?? 0) + 1}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        placement: {
                          wall: value.placement?.wall || walls[0].id,
                          offset: 0,
                          row: value.placement?.row,
                          order: Math.max(0, Number(e.target.value) - 1),
                        },
                      })
                    }
                  />
                </Field>
              </>
            )}
            {select("body", "body", "Korpus")}
            {select("back", "back", "Leđa")}
            {select("edge", "edge", "Kant traka")}
            {!["worktop", "side", "panel", "plinth"].includes(value.kind) &&
              numeric("shelves", "Broj polica", 0, 12)}
            {select("handle", "handle", "Ručke")}
            {numeric("extra", "Dodatni rad (RSD)", 0, 1000000)}
            <Field label="Napomena">
              <textarea
                rows={2}
                value={value.note}
                onChange={(e) => setValue({ ...value, note: e.target.value })}
              />
            </Field>
            <details className="construction-rule">
              <summary>Konstrukciono pravilo</summary>
              <p>{t.rule}</p>
            </details>
          </details>
          <details className="disclosure visual-element-settings">
            <summary>Izgled u 2D prikazu</summary>
            <label className="check-field">
              <input
                type="checkbox"
                checked={!!value.visual?.glass}
                onChange={(e) =>
                  setValue({
                    ...value,
                    visual: { ...value.visual, glass: e.target.checked },
                  })
                }
              />
              Stakleni frontovi
            </label>
            <Field label="Vizuelni uređaj">
              <select
                value={value.visual?.appliance || "auto"}
                onChange={(e) =>
                  setValue({
                    ...value,
                    visual: {
                      ...value.visual,
                      appliance: e.target.value as NonNullable<
                        KitchenElement["visual"]
                      >["appliance"],
                    },
                  })
                }
              >
                <option value="auto">Prema tipu elementa</option>
                <option value="none">Bez uređaja</option>
                <option value="oven">Rerna</option>
                <option value="sink">Sudopera i slavina</option>
                <option value="hob">Ploča za kuvanje</option>
                <option value="fridge">Frižider</option>
                <option value="dishwasher">Mašina za sudove</option>
              </select>
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={!!value.visual?.hob}
                onChange={(e) =>
                  setValue({
                    ...value,
                    visual: { ...value.visual, hob: e.target.checked },
                  })
                }
              />
              Ploča za kuvanje iznad elementa
            </label>
            {(["worktop", "plinth", "side", "panel"].includes(value.kind) ||
              isBridge(value)) && (
              <Field
                label="Položaj od početka zida (mm)"
                hint="Prazno: automatski položaj dodatka."
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100000"
                  placeholder="Automatski"
                  value={value.visual?.offset ?? ""}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      visual: {
                        ...value.visual,
                        offset:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            )}
            <Field
              label="Donja ivica od poda (mm)"
              hint="Prazno: prema nogicama, ploči i razmaku visećih elemenata."
            >
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="100000"
                placeholder="Automatski"
                value={value.visual?.bottom ?? ""}
                onChange={(e) =>
                  setValue({
                    ...value,
                    visual: {
                      ...value.visual,
                      bottom:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          </details>
          </fieldset>
          {errors.length > 0 && (
            <div className="error-note" role="alert">
              {errors.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </div>
          )}
          <div className="editor-save">
            <button className="btn primary full" type="submit">
              {isNew ? "Dodaj" : "Sačuvaj"}
            </button>
          </div>
        </form>
      </Modal>
      {pushDialog && (
        <PushSystemDialog
          elements={[value]}
          selection={value.selection}
          products={products}
          settings={settings}
          onClose={() => setPushDialog(false)}
          onConfirm={(kit, prices) => {
            setProducts(prices);
            setValue({
              ...value,
              ownOpening: true,
              selection: pushSelection(value.selection, kit),
            });
            setErrors([]);
            setPushDialog(false);
          }}
        />
      )}
    </>
  );
}
