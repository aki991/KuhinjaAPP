import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { uid } from "../../core/catalog";
import type { ElevationConfig, WallObject } from "../../core/types";
import { Field, Modal } from "../UI";
const names = {
  window: "Prozor",
  door: "Vrata",
  column: "Stub",
  niche: "Niša",
};
export default function WallSettingsEditor({
  config,
  wall,
  onSave,
  onClose,
}: {
  config: ElevationConfig;
  wall: string;
  onSave: (v: ElevationConfig) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => structuredClone(config));
  const update = (id: string, patch: Partial<WallObject>) =>
    setValue((v) => ({
      ...v,
      objects: v.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  return (
    <Modal title="Otvori i mere" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
          onClose();
        }}
      >
        <p className="muted">
          Položaji se mere od početka izabranog zida i od poda.
        </p>
        <div className="form-grid">
          {(
            [
              ["toeKick", "Visina nogica (mm)", 0, 500],
              ["upperGap", "Razmak iznad ploče (mm)", 0, 3000],
              ["wallHeight", "Visina zida (mm)", 500, 10000],
            ] as const
          ).map(([key, label, min, max]) => (
            <Field key={key} label={label}>
              <input
                type="number"
                inputMode="numeric"
                required
                min={min}
                max={max}
                value={value[key]}
                onChange={(e) =>
                  setValue({ ...value, [key]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
        </div>
        <h3>Otvori i prepreke na zidu</h3>
        {value.objects
          .filter((o) => o.wall === wall)
          .map((o) => (
            <fieldset className="wall-object-editor" key={o.id}>
              <legend>{names[o.kind]}</legend>
              <div className="form-grid">
                {(
                  [
                    ["x", "Od početka zida (mm)", 0],
                    ["width", "Širina otvora (mm)", 1],
                    ["height", "Visina otvora (mm)", 1],
                    ["bottom", "Donja ivica od poda (mm)", 0],
                  ] as const
                ).map(([key, label, min]) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      inputMode="numeric"
                      required
                      min={min}
                      max={100000}
                      value={o[key]}
                      onChange={(e) =>
                        update(o.id, { [key]: Number(e.target.value) })
                      }
                    />
                  </Field>
                ))}
              </div>
              <button
                className="text-btn"
                type="button"
                aria-label={`Obriši ${names[o.kind].toLowerCase()}`}
                onClick={() =>
                  setValue({
                    ...value,
                    objects: value.objects.filter((x) => x.id !== o.id),
                  })
                }
              >
                <Trash2 size={18} /> Obriši
              </button>
            </fieldset>
          ))}
        <div className="wall-object-add">
          {(Object.keys(names) as WallObject["kind"][]).map((kind) => (
            <button
              type="button"
              className="btn"
              key={kind}
              onClick={() =>
                setValue({
                  ...value,
                  objects: [
                    ...value.objects,
                    {
                      id: uid(),
                      wall,
                      kind,
                      x: 0,
                      width:
                        kind === "column" ? 300 : kind === "door" ? 800 : 1000,
                      height:
                        kind === "column"
                          ? value.wallHeight
                          : kind === "door"
                            ? 2100
                            : 900,
                      bottom: kind === "window" || kind === "niche" ? 1000 : 0,
                    },
                  ],
                })
              }
            >
              <Plus size={18} />
              {names[kind]}
            </button>
          ))}
        </div>
        <div className="editor-save">
          <button type="submit" className="btn primary full">
            Sačuvaj prikaz
          </button>
        </div>
      </form>
    </Modal>
  );
}
