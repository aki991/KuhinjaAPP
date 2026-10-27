import { useState, type ReactNode } from "react";
import type { KitchenLayout, LayoutSpacer, Offer } from "../core/types";
import { Field, Modal } from "./UI";
import LibraryThumbnail from "./elevation/LibraryThumbnail";
export default function SpacerEditor({
  spacer,
  offer,
  layout,
  onClose,
  onSave,
  actions,
}: {
  spacer: LayoutSpacer;
  offer: Offer;
  layout: KitchenLayout;
  onClose: () => void;
  onSave: (s: LayoutSpacer) => void;
  actions?: ReactNode;
}) {
  const [value, setValue] = useState(structuredClone(spacer));
  return (
    <Modal title="Razmak" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
          onClose();
        }}
      >
        <div className="compact-element-editor">
          <div className="editor-drawing"><LibraryThumbnail element={value} offer={offer} /></div>
          <div className="compact-element-controls">
            {actions}
        <Field label="Širina razmaka (mm)">
          <input
            className="large-number"
            type="number"
            inputMode="numeric"
            min="1"
            max="30000"
            required
            value={value.width || ""}
            onChange={(e) =>
              setValue({ ...value, width: Number(e.target.value) })
            }
          />
        </Field>
          </div>
        </div>
        <fieldset hidden disabled className="element-advanced-hidden">
        <Field label="Red">
          <select
            value={value.placement.row || "base"}
            onChange={(e) =>
              setValue({
                ...value,
                placement: {
                  ...value.placement,
                  row: e.target.value as "base" | "wall",
                  order: Number.MAX_SAFE_INTEGER,
                },
              })
            }
          >
            <option value="base">Donji</option>
            <option value="wall">Viseći</option>
          </select>
        </Field>
        <details className="editor-details">
          <summary>Dodatna podešavanja</summary>
          <Field label="Zid / grupa">
            <select
              value={value.placement.wall}
              onChange={(e) =>
                setValue({
                  ...value,
                  placement: {
                    ...value.placement,
                    wall: e.target.value,
                    order: Number.MAX_SAFE_INTEGER,
                  },
                })
              }
            >
              {layout.walls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </details>
        </fieldset>
        <button className="btn primary full">Sačuvaj</button>
      </form>
    </Modal>
  );
}
