import { useState } from "react";
import type { Product, Settings } from "../core/types";
import { Field, Modal } from "./UI";
export default function QuoteSettings({
  settings,
  prices,
  onClose,
  onSave,
}: {
  settings: Settings;
  prices: Product[];
  onClose: () => void;
  onSave: (s: Settings, p: Product[]) => void;
}) {
  const [s, setS] = useState({ ...settings }),
    [p, setP] = useState(structuredClone(prices));
  const work = [
    { id: "labor-cut", key: "cutPrice", label: "Sečenje po panelu (RSD)" },
    { id: "labor-edge", key: "edgeLabor", label: "Kantovanje po metru (RSD)" },
    {
      id: "labor-build",
      key: "laborPerElement",
      label: "Rad po elementu (RSD)",
    },
    { id: "labor-assembly", key: "assembly", label: "Montaža kuhinje (RSD)" },
    { id: "labor-transport", key: "transport", label: "Transport (RSD)" },
  ] as const;
  return (
    <Modal title="Podešavanje ovog obračuna" wide onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(s, p);
          onClose();
        }}
      >
        <div className="settings-grid">
          {(
            [
              { key: "margin", label: "Marža (%)", max: 99 },
              { key: "markup", label: "Doplata (%)", max: 500 },
              { key: "waste", label: "Tehnološki otpad (%)", max: 100 },
              { key: "thickness", label: "Debljina ploče (mm)", max: 40 },
              { key: "backThickness", label: "Debljina leđa (mm)", max: 18 },
              { key: "gap", label: "Zazor frontova (mm)", max: 10 },
              {
                key: "clearance",
                label: "Razmak klizača po strani (mm)",
                max: 40,
              },
              { key: "eurRate", label: "Ručni kurs EUR / RSD", max: 1000 },
            ] as const
          ).map((x) => (
            <Field label={x.label} key={x.key}>
              <input
                type="number"
                required
                min={
                  ["thickness", "backThickness", "eurRate"].includes(x.key)
                    ? 1
                    : 0
                }
                step="0.1"
                max={x.max}
                value={s[x.key]}
                onChange={(e) =>
                  setS({ ...s, [x.key]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
        </div>
        <Field label="Formiranje prodajne cene">
          <select
            value={s.profitMode}
            onChange={(e) =>
              setS({
                ...s,
                profitMode: e.target.value as Settings["profitMode"],
              })
            }
          >
            <option value="margin">Marža: trošak / (1 − marža)</option>
            <option value="markup">Doplata: trošak × (1 + doplata)</option>
          </select>
        </Field>
        <Field label="Nabavka artikala po tabli">
          <select
            value={s.purchaseMode}
            onChange={(e) =>
              setS({
                ...s,
                purchaseMode: e.target.value as Settings["purchaseMode"],
              })
            }
          >
            <option value="area">Teorijska površina sa otpadom</option>
            <option value="sheets">
              Cele table · površinski minimum, bez optimizacije
            </option>
          </select>
        </Field>
        <Field label="Kantovanje korpusa">
          <select
            value={s.edgeMode}
            onChange={(e) =>
              setS({ ...s, edgeMode: e.target.value as Settings["edgeMode"] })
            }
          >
            <option value="front">Vidljive prednje ivice</option>
            <option value="all">Sve ivice stranica, dna i krova</option>
          </select>
        </Field>
        <h3 className="quote-work-heading">Cene radova u ovoj ponudi</h3>
        <div className="settings-grid">
          {work.map((w) => {
            const product = p.find((x) => x.id === w.id),
              value = product
                ? product.price * (product.currency === "EUR" ? s.eurRate : 1)
                : s[w.key];
            return (
              <Field key={w.id} label={w.label}>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => {
                    setS({ ...s, [w.key]: Number(e.target.value) });
                    if (product)
                      setP(
                        p.map((x) =>
                          x.id === w.id
                            ? {
                                ...x,
                                price: Number(e.target.value),
                                currency: "RSD",
                              }
                            : x,
                        ),
                      );
                  }}
                />
              </Field>
            );
          })}
        </div>
        <button className="btn primary full">Primeni i preračunaj</button>
      </form>
    </Modal>
  );
}
