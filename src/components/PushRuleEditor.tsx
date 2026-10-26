import type { Product, PushRule } from "../core/types";
import { Field } from "./UI";
import KitComponentsEditor from "./KitComponentsEditor";
export default function PushRuleEditor({
  product,
  products,
  onChange,
}: {
  product: Product;
  products: Product[];
  onChange: (rule: PushRule | undefined) => void;
}) {
  const r = product.pushRule;
  return (
    <details className="editor-details">
      <summary>Kompatibilnost push sistema</summary>
      {!r ? (
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            onChange({
              perDoor: 1,
              hinges: [],
              kinds: ["wall1", "wall2"],
              maxHeight: 0,
              maxWidth: 0,
              minGap: 2,
            })
          }
        >
          Definiši pravilo modela
        </button>
      ) : (
        <>
          <Field label="Vrsta Push sistema">
            <select
              value={r.system ?? "classic"}
              onChange={(e) =>
                onChange({
                  ...r,
                  system: e.target.value as "classic" | "silent",
                })
              }
            >
              <option value="classic">Klasični Push</option>
              <option value="silent">Push sa mekim zatvaranjem</option>
            </select>
          </Field>
          <Field label="Izvor pravila / model">
            <input
              required={r.system === "silent"}
              value={r.source ?? ""}
              onChange={(e) => onChange({ ...r, source: e.target.value })}
            />
          </Field>
          <Field label="Šarki po vratima (prazno: postojeće pravilo visine)">
            <input
              type="number"
              min="1"
              max="10"
              required={r.system === "silent"}
              value={r.hingesPerDoor ?? ""}
              onChange={(e) =>
                onChange({
                  ...r,
                  hingesPerDoor: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </Field>
          <div className="field-grid">
            {(
              [
                ["perDoor", "Mehanizama po vratima", 1, 4],
                ["maxHeight", "Najveća visina fronta (mm)", 1, 5000],
                ["maxWidth", "Najveća širina fronta (mm)", 1, 3000],
                ["minGap", "Najmanji zazor (mm)", 0, 50],
              ] as const
            ).map(([key, label, min, max]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  required
                  min={min}
                  max={max}
                  step={key === "perDoor" ? 1 : 0.1}
                  value={r[key]}
                  onChange={(e) =>
                    onChange({ ...r, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
          </div>
          <div className="field-grid">
            {(["minHeight", "minWidth"] as const).map((key) => (
              <Field
                key={key}
                label={
                  key === "minHeight"
                    ? "Najmanja visina fronta (mm)"
                    : "Najmanja širina fronta (mm)"
                }
              >
                <input
                  type="number"
                  min="0"
                  value={r[key] ?? 0}
                  onChange={(e) =>
                    onChange({ ...r, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
          </div>
          <fieldset>
            <legend>Podržane konstrukcije</legend>
            {(["wall1", "wall2", "lift", "tall"] as const).map((kind) => (
              <label className="check-field" key={kind}>
                <input
                  type="checkbox"
                  checked={r.kinds.includes(kind)}
                  onChange={(e) =>
                    onChange({
                      ...r,
                      kinds: e.target.checked
                        ? [...r.kinds, kind]
                        : r.kinds.filter((k) => k !== kind),
                    })
                  }
                />
                {
                  {
                    wall1: "Viseći — jedna vrata",
                    wall2: "Viseći — dvoja vrata",
                    lift: "Podizni front",
                    tall: "Običan visoki ormar",
                  }[kind]
                }
              </label>
            ))}
          </fieldset>
          {r.kinds.includes("lift") && (
            <fieldset>
              <legend>Potvrđeni podizni mehanizmi</legend>
              {products
                .filter((p) => p.category === "lift")
                .map((p) => (
                  <label className="check-field" key={p.id}>
                    <input
                      type="checkbox"
                      checked={r.lifts?.includes(p.id) ?? false}
                      onChange={(e) =>
                        onChange({
                          ...r,
                          lifts: e.target.checked
                            ? [...(r.lifts ?? []), p.id]
                            : (r.lifts ?? []).filter((id) => id !== p.id),
                        })
                      }
                    />
                    {p.name} · {p.supplier}
                  </label>
                ))}
            </fieldset>
          )}
          <KitComponentsEditor
            value={r.components ?? []}
            products={products}
            onChange={(components) => onChange({ ...r, components })}
          />
          <fieldset>
            <legend>Potvrđene kompatibilne šarke</legend>
            {products
              .filter((p) => p.category === "hinge")
              .map((p) => (
                <label className="check-field" key={p.id}>
                  <input
                    type="checkbox"
                    checked={r.hinges.includes(p.id)}
                    onChange={(e) =>
                      onChange({
                        ...r,
                        hinges: e.target.checked
                          ? [...r.hinges, p.id]
                          : r.hinges.filter((h) => h !== p.id),
                      })
                    }
                  />
                  {p.name} · {p.supplier}
                </label>
              ))}
          </fieldset>
          <button
            type="button"
            className="text-btn"
            onClick={() => onChange(undefined)}
          >
            Ukloni pravilo
          </button>
        </>
      )}
    </details>
  );
}
