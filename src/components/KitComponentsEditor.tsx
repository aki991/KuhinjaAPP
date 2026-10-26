import type { KitComponent, Product } from "../core/types";
import { Field } from "./UI";
export default function KitComponentsEditor({
  value,
  products,
  onChange,
  profiles = false,
}: {
  value: KitComponent[];
  products: Product[];
  onChange: (v: KitComponent[]) => void;
  profiles?: boolean;
}) {
  const choices = products.filter(
    (p) =>
      ["other", "labor", "golaEnd"].includes(p.category) &&
      ["kom", "komplet"].includes(p.unit),
  );
  return (
    <fieldset>
      <legend>Nosači, dodaci i rad</legend>
      {value.map((c, i) => (
        <div key={i} className="kit-component">
          <Field label="Artikal komponente">
            <select
              value={c.product}
              onChange={(e) =>
                onChange(
                  value.map((v, j) =>
                    i === j ? { ...v, product: e.target.value } : v,
                  ),
                )
              }
            >
              <option value="">Izaberite artikal</option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.supplier}
                </option>
              ))}
            </select>
          </Field>
          <div className="field-grid">
            <Field label="Količina">
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={c.quantity}
                onChange={(e) =>
                  onChange(
                    value.map((v, j) =>
                      i === j ? { ...v, quantity: Number(e.target.value) } : v,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Obračun po">
              <select
                value={c.basis}
                onChange={(e) =>
                  onChange(
                    value.map((v, j) =>
                      i === j
                        ? {
                            ...v,
                            basis: e.target.value as KitComponent["basis"],
                          }
                        : v,
                    ),
                  )
                }
              >
                <option value="door">Vratima</option>
                <option value="hinge">Šarki</option>
                <option value="cabinet">Elementu</option>
                {profiles && <option value="profile">Profilu</option>}
              </select>
            </Field>
          </div>
          <button
            type="button"
            className="text-btn"
            onClick={() => onChange(value.filter((_, j) => i !== j))}
          >
            Ukloni komponentu
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn secondary small"
        onClick={() =>
          onChange([...value, { product: "", quantity: 1, basis: "door" }])
        }
      >
        Dodaj komponentu
      </button>
    </fieldset>
  );
}
