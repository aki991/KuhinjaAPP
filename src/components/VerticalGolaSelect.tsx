import { useState } from "react";
import type { Product } from "../core/types";
import { validVerticalGolaRule, componentErrors } from "../core/opening";
import VerticalGolaRuleEditor from "./VerticalGolaRuleEditor";
import { Field, Modal } from "./UI";
export default function VerticalGolaSelect({
  value,
  products,
  onChange,
}: {
  value?: string;
  products: Product[];
  onChange: (id: string, prices: Product[]) => void;
}) {
  const [editing, setEditing] = useState(false),
    [prices, setPrices] = useState(products),
    [id, setId] = useState(value ?? ""),
    [error, setError] = useState("");
  const current = prices.find((p) => p.id === id);
  const choices = products.filter(
    (p) =>
      p.category === "gola" &&
      p.unit === "m" &&
      validVerticalGolaRule(p.verticalGolaRule),
  );
  return (
    <>
      <Field label="Vertikalni GOLA profil">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value, products)}
        >
          <option value="">Izaberite profil sa pravilom</option>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.supplier}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className="text-btn"
        onClick={() => {
          setPrices(products);
          setId(value ?? "");
          setEditing(true);
        }}
      >
        Podesi profil
      </button>
      {editing && (
        <Modal title="Vertikalna GOLA" onClose={() => setEditing(false)}>
          <Field label="Artikal profila">
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Izaberite konkretan artikal</option>
              {prices
                .filter((p) => p.category === "gola" && p.unit === "m")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.supplier}
                  </option>
                ))}
            </select>
          </Field>
          {current && (
            <VerticalGolaRuleEditor
              product={current}
              products={prices}
              onChange={(verticalGolaRule) =>
                setPrices(
                  prices.map((p) =>
                    p.id === id ? { ...p, verticalGolaRule } : p,
                  ),
                )
              }
            />
          )}
          {error && (
            <p className="error-note" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn primary full"
            onClick={() => {
              const r = current?.verticalGolaRule;
              if (
                !validVerticalGolaRule(r) ||
                !r ||
                !prices.some(
                  (p) =>
                    p.id === r.end &&
                    p.category === "golaEnd" &&
                    p.unit === "kom",
                ) ||
                componentErrors(r.components, prices, [id, r.end]).length
              ) {
                setError(
                  "Unesite pravilo profila, odgovarajući završetak i komponente.",
                );
                return;
              }
              onChange(id, prices);
              setEditing(false);
            }}
          >
            Potvrdi profil
          </button>
        </Modal>
      )}
    </>
  );
}
