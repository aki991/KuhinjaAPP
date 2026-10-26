import { useMemo, useState } from "react";
import { pushKits, type PushKit } from "../core/opening-kits";
import { validPushRule } from "../core/opening";
import { rsd } from "../core/engine";
import type {
  KitchenElement,
  Product,
  Selection,
  Settings,
} from "../core/types";
import PushRuleEditor from "./PushRuleEditor";
import { Field, Modal, money } from "./UI";
export default function PushSystemDialog({
  elements,
  selection,
  products,
  settings,
  onClose,
  onConfirm,
}: {
  elements: KitchenElement[];
  selection: Selection;
  products: Product[];
  settings: Settings;
  onClose: () => void;
  onConfirm: (kit: PushKit, prices: Product[]) => void;
}) {
  const [prices, setPrices] = useState(products),
    [chosen, setChosen] = useState<PushKit | null>(null),
    [editing, setEditing] = useState(false),
    [mechanism, setMechanism] = useState(selection.push),
    [error, setError] = useState("");
  const kits = useMemo(
    () => pushKits(elements, selection, prices, settings),
    [elements, selection, prices, settings],
  );
  const current = prices.find(
    (p) => p.id === mechanism && p.category === "push",
  );
  const price = (p: Product) => `${money(rsd(p, settings))}/${p.unit}`;
  return (
    <Modal title="Izaberite Push sistem" onClose={onClose}>
      <div className="push-kit-panel">
        {!editing && (
          <>
            {(["classic", "silent"] as const).map((system) => {
              const options = kits.filter(
                (k) => (k.mechanism.pushRule?.system ?? "classic") === system,
              );
              return options.length ? (
                <fieldset key={system}>
                  <legend>
                    {system === "classic"
                      ? "Klasični Push"
                      : "Push sa mekim zatvaranjem"}
                  </legend>
                  {options.map((k, i) => (
                    <label
                      className="kit-option"
                      key={`${k.mechanism.id}-${k.hinge?.id}-${k.lift?.id}`}
                    >
                      <input
                        type="radio"
                        name="push-kit"
                        checked={chosen === k}
                        onChange={() => setChosen(k)}
                        aria-label={`${system === "classic" ? "Klasični Push" : "Push sa mekim zatvaranjem"} ${i + 1}`}
                      />
                      <span>
                        <strong>{k.mechanism.name}</strong>
                        <small>
                          {k.mechanism.supplier} · {price(k.mechanism)} ·{" "}
                          {k.mechanism.pushRule!.perDoor} po vratima
                        </small>
                        {k.hinge && (
                          <small>
                            {k.hinge.name} · {price(k.hinge)}
                          </small>
                        )}
                        {k.lift && (
                          <small>
                            {k.lift.name} · {price(k.lift)}
                          </small>
                        )}
                        {(k.mechanism.pushRule?.components ?? []).map((c) => {
                          const p = prices.find((p) => p.id === c.product)!;
                          return (
                            <small key={c.product}>
                              {p.name} · {price(p)}
                            </small>
                          );
                        })}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null;
            })}
            {!kits.length && (
              <p>Nema definisanog kompatibilnog kompleta za ove elemente.</p>
            )}
            {chosen && (
              <p className="kit-replacement">
                Zamenjuje:{" "}
                {prices.find((p) => p.id === selection.hinge)?.name ??
                  "postojeće šarke"}
                {chosen.hinge
                  ? ` → ${chosen.hinge.name}`
                  : ` → ${chosen.lift?.name}`}
                . Količine se računaju po vratima.
              </p>
            )}
            <button
              type="button"
              className="btn secondary full"
              onClick={() => {
                setEditing(true);
                setChosen(null);
              }}
            >
              Podesi komplet
            </button>
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={onClose}>
                Odustani
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!chosen}
                onClick={() => chosen && onConfirm(chosen, prices)}
              >
                Potvrdi izbor
              </button>
            </div>
          </>
        )}
        {editing && (
          <>
            <Field label="Push mehanizam kompleta">
              <select
                value={mechanism}
                onChange={(e) => {
                  setMechanism(e.target.value);
                  setError("");
                }}
              >
                {prices
                  .filter((p) => p.category === "push" && p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {price(p)}
                    </option>
                  ))}
              </select>
            </Field>
            {current ? (
              <PushRuleEditor
                product={current}
                products={prices}
                onChange={(pushRule) => {
                  setPrices(
                    prices.map((p) =>
                      p.id === current.id ? { ...p, pushRule } : p,
                    ),
                  );
                  setError("");
                }}
              />
            ) : (
              <p>Dodajte konkretan Push artikal u cenovnik.</p>
            )}
            {error && (
              <p role="alert" className="error-note">
                {error}
              </p>
            )}
            <small>
              Kompatibilnost potvrdite prema dokumentaciji konkretnog modela.
              Cene artikala ostaju iz cenovnika.
            </small>
            <div className="form-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(false)}
              >
                Nazad
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  if (
                    !current ||
                    !validPushRule(current.pushRule) ||
                    !current.pushRule?.source?.trim()
                  ) {
                    setError(
                      "Unesite potvrđeno pravilo modela, izvor i kompatibilne artikle.",
                    );
                    return;
                  }
                  if (!kits.some((k) => k.mechanism.id === mechanism)) {
                    setError(
                      "Komplet ne pokriva konstrukciju, dimenzije ili sve potrebne artikle.",
                    );
                    return;
                  }
                  setEditing(false);
                }}
              >
                Proveri komplet
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
