import type { Product, VerticalGolaRule } from "../core/types";
import { Field } from "./UI";
import KitComponentsEditor from "./KitComponentsEditor";
export default function VerticalGolaRuleEditor({
  product,
  products,
  onChange,
}: {
  product: Product;
  products: Product[];
  onChange: (r: VerticalGolaRule | undefined) => void;
}) {
  const r = product.verticalGolaRule;
  return (
    <details className="editor-details">
      <summary>Pravilo vertikalne GOLA</summary>
      {!r ? (
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            onChange({
              source: "",
              profiles: 1,
              top: 0,
              bottom: 0,
              frontInset: 0,
              maxHeight: 0,
              maxWidth: 0,
              end: "",
              ends: 2,
              components: [],
            })
          }
        >
          Definiši pravilo profila
        </button>
      ) : (
        <>
          <small>
            Običan visoki ormar bez ugrađenih aparata. Unesite mere i komponente
            iz dokumentacije izabranog modela.
          </small>
          <Field label="Izvor pravila / model">
            <input
              required
              value={r.source}
              onChange={(e) => onChange({ ...r, source: e.target.value })}
            />
          </Field>
          <div className="field-grid">
            {(
              [
                ["profiles", "Profila po elementu", 1, 2],
                ["top", "Odstupanje od vrha (mm)", 0, 3000],
                ["bottom", "Odstupanje od dna (mm)", 0, 3000],
                ["frontInset", "Suženje fronta po profilu (mm)", 1, 200],
                ["maxHeight", "Najveća visina korpusa (mm)", 1, 3000],
                ["maxWidth", "Najveća širina korpusa (mm)", 1, 6000],
                ["ends", "Završetaka po profilu", 0, 4],
              ] as const
            ).map(([key, label, min, max]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  required
                  min={min}
                  max={max}
                  value={r[key]}
                  onChange={(e) =>
                    onChange({ ...r, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Artikal završetka">
            <select
              required
              value={r.end}
              onChange={(e) => onChange({ ...r, end: e.target.value })}
            >
              <option value="">Izaberite završetak</option>
              {products
                .filter((p) => p.category === "golaEnd")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.supplier}
                  </option>
                ))}
            </select>
          </Field>
          <KitComponentsEditor
            profiles
            value={r.components}
            products={products}
            onChange={(components) => onChange({ ...r, components })}
          />
          <button
            type="button"
            className="text-btn"
            onClick={() => onChange(undefined)}
          >
            Ukloni pravilo vertikalne GOLA
          </button>
        </>
      )}
    </details>
  );
}
