import { useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { categories, templates } from "../core/catalog";
import { appendPlacement } from "../core/layout";
import type {
  Category,
  KitchenElement,
  KitchenWall,
  Product,
  Selection,
  Settings,
  KitchenLayout,
  SelectionProductKey,
} from "../core/types";
import { construct } from "../core/construction";
import {
  effectiveSelection,
  standardWall,
  wallFrontHeight,
  tallCabinet,
} from "../core/opening";
import { pushSelection } from "../core/opening-kits";
import PushSystemDialog from "./PushSystemDialog";
import VerticalGolaSelect from "./VerticalGolaSelect";
import { Cabinet, Field, Modal } from "./UI";
export default function ElementEditor({
  element,
  products: initialProducts,
  global,
  settings,
  walls = [],
  elements = [],
  layout,
  onSave,
  onClose,
  actions,
}: {
  element: KitchenElement;
  products: Product[];
  global: Selection;
  settings: Settings;
  walls?: KitchenWall[];
  elements?: KitchenElement[];
  layout?: KitchenLayout;
  onSave: (e: KitchenElement, prices?: Product[]) => void;
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
  const t = templates.find((t) => t.kind === element.kind)!;
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
            selection: { ...value.selection, [key]: e.target.value },
            locked: true,
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
            onSave(value, products);
            onClose();
          }}
        >
          <div className="editor-drawing">
            <Cabinet kind={value.kind} size={88} />
            <span>Sve dimenzije u mm</span>
          </div>
          {actions}
          <div className="dimension-fields">
            {numeric("width", "Širina", 80, 6000)}
            {numeric("height", "Visina", 40, 3000)}
            {numeric("depth", "Dubina", 10, 1500)}
          </div>
          <div className="field-grid">
            {t.drawers > 0
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
                    locked: true,
                    selection: {
                      ...value.selection,
                      opening: e.target.value as Selection["opening"],
                    },
                  });
                }}
              >
                <option value="handles">Klasične ručke</option>
                {!standardWall(value) && value.kind !== "lift" && (
                  <option value="gola">
                    {tallCabinet(value) ? "Vertikalna GOLA" : "GOLA profili"}
                  </option>
                )}
                <option value="push">Push-to-open</option>
                {standardWall(value) && (
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
                    locked: true,
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
            {standardWall(value) && value.selection.opening === "overhang" && (
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
                      locked: true,
                      selection: {
                        ...value.selection,
                        frontOverhang: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            )}
            {standardWall(value) &&
              value.selection.opening === "push" &&
              select("push", "push", "Push mehanizam")}
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
            <Field label="Smer otvaranja vrata">
              <select
                value={value.visual?.hinge || "left"}
                onChange={(e) =>
                  setValue({
                    ...value,
                    visual: {
                      ...value.visual,
                      hinge: e.target.value as "left" | "right",
                    },
                  })
                }
              >
                <option value="left">Levo</option>
                <option value="right">Desno</option>
              </select>
            </Field>
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
            {["worktop", "plinth", "side", "panel"].includes(value.kind) && (
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
          {errors.length > 0 && (
            <div className="error-note" role="alert">
              {errors.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </div>
          )}
          <div className="editor-save">
            <button className="btn primary full" type="submit">
              Sačuvaj
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
              locked: true,
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
