import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { uid } from "../../core/catalog";
import type { ElevationConfig, WallObject } from "../../core/types";
import { Field, Modal } from "../UI";
export const objectNames = {
  window: "Prozor",
  door: "Vrata",
  column: "Stub",
  niche: "Niša",
};
export default function WallSettingsEditor({
  config,
  wall,
  wallLength,
  shape: initialShape,
  shapes,
  affectedBy,
  onSave,
  onClose,
}: {
  config: ElevationConfig;
  wall: string;
  wallLength: number;
  shape: string;
  shapes: string[];
  affectedBy: (shape: string) => number;
  onSave: (v: ElevationConfig, length: number, shape: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => structuredClone(config));
  const [length, setLength] = useState(wallLength);
  const [shape, setShape] = useState(initialShape),
    [confirmMove, setConfirmMove] = useState(false);
  const affected = shape !== initialShape ? affectedBy(shape) : 0;
  const update = (id: string, patch: Partial<WallObject>) =>
    setValue((v) => ({
      ...v,
      objects: v.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  return (
    <Modal title="Okviri i mere" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (affected && !confirmMove) return;
          onSave(value, length, shape);
          onClose();
        }}
      >
        <Field label="Prostor (tip kuhinje)">
          <select
            value={shape}
            onChange={(e) => {
              setShape(e.target.value);
              setConfirmMove(false);
            }}
          >
            {shapes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {!!affected && (
          <label className="layout-warning">
            <input
              type="checkbox"
              checked={confirmMove}
              onChange={(e) => setConfirmMove(e.target.checked)}
            />{" "}
            Premeštam {affected} stavki sa uklonjenih zidova na zid A; proveriću
            raspored i prepreke.
          </label>
        )}
        <p className="muted">
          Položaji se mere od početka izabranog zida i od poda.
        </p>
        <div className="form-grid">
          <Field label="Dužina zida (mm)">
            <input
              type="number"
              inputMode="numeric"
              required
              min={100}
              max={30000}
              value={length || ""}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </Field>
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
              <legend>{objectNames[o.kind]}</legend>
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
                aria-label={`Obriši ${objectNames[o.kind].toLowerCase()}`}
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
          {(Object.keys(objectNames) as WallObject["kind"][]).map((kind) => (
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
              {objectNames[kind]}
            </button>
          ))}
        </div>
        <div className="editor-save">
          <button
            type="submit"
            className="btn primary full"
            disabled={!!affected && !confirmMove}
          >
            Sačuvaj prikaz
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function WallObjectEditor({
  object,
  wallLength,
  wallHeight,
  onSave,
  onDelete,
  onClose,
}: {
  object: WallObject;
  wallLength: number;
  wallHeight: number;
  onSave: (o: WallObject) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(object);
  return (
    <Modal title={objectNames[object.kind]} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
          onClose();
        }}
      >
        <div className="form-grid">
          {(
            [
              ["x", "Od početka zida (mm)", 0, wallLength],
              ["width", "Širina (mm)", 1, wallLength],
              ["height", "Visina (mm)", 1, wallHeight],
              ["bottom", "Donja ivica od poda (mm)", 0, wallHeight],
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
        <div className="editor-save">
          <button type="submit" className="btn primary full">
            Sačuvaj
          </button>
        </div>
        <button
          type="button"
          className="btn full"
          aria-label={`Obriši ${objectNames[object.kind].toLowerCase()}`}
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 size={18} /> Obriši
        </button>
      </form>
    </Modal>
  );
}