import { useMemo, useState } from "react";
import { Modal, Field } from "./UI";
import WallElevation from "./elevation/WallElevation";
import { elevationScene } from "../core/elevation";
import { connectedWalls } from "../core/layout";
import { productAppearance } from "../core/appearance";
import { applyPreset, presets, type Preset } from "../core/presets";
import type { Offer, Product } from "../core/types";

const SCALE = 0.11;

/** Suggested kitchens: pick a name and the cabinets, materials, tiles and white goods fit the room. */
export default function PresetPicker({
  offer,
  products,
  onApply,
  onClose,
}: {
  offer: Offer;
  products: Product[];
  onApply: (next: Offer, preset: Preset) => void;
  onClose: () => void;
}) {
  const [id, setId] = useState(presets[0].id),
    [wallId, setWallId] = useState("A"),
    [confirm, setConfirm] = useState(false);
  const preset = presets.find((p) => p.id === id)!;
  const walls = connectedWalls(offer.layout!);
  const known = useMemo(
    () => [...products, ...offer.prices],
    [products, offer.prices],
  );
  const candidate = useMemo(
    () => applyPreset(offer, preset, products),
    [offer, preset, products],
  );
  const wall = walls.find((w) => w.id === wallId) ?? walls[0];
  const scene = useMemo(
    () => elevationScene(candidate, wall.id),
    [candidate, wall.id],
  );
  const colorOf = (productId: string | undefined) =>
    productAppearance(known.find((p) => p.id === productId)).color;
  const frontColor =
    preset.frontMode === "ral" ? preset.ralColor : colorOf(preset.front);
  const upperColor = preset.upperLook
    ? preset.upperLook.frontMode === "ral"
      ? preset.upperLook.ralColor
      : colorOf(preset.upperLook.front)
    : undefined;
  const swatches: [string, string | undefined][] = [
    ["Korpus", colorOf(preset.frontMode === "body" ? preset.body : preset.body)],
    [preset.upperLook ? "Donji frontovi" : "Frontovi", preset.frontMode === "body" ? colorOf(preset.body) : frontColor],
    ...(upperColor ? ([["Viseći frontovi", upperColor]] as [string, string][]) : []),
    ["Radna ploča", colorOf(preset.worktop)],
  ];
  const opening =
    preset.opening === "gola"
      ? "GOLA profili bez ručki"
      : preset.opening === "push"
        ? "Push-to-open"
        : "Ručke";
  const hasElements = offer.elements.length > 0;
  return (
    <Modal title="Predlozi kuhinja" onClose={onClose} wide>
      <div className="preset-picker">
        <Field label="Kuhinja">
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setConfirm(false);
            }}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.style}
              </option>
            ))}
          </select>
        </Field>
        <p className="preset-description">{preset.description}</p>
        <ul className="preset-swatches" aria-label="Boje i materijali">
          {swatches.map(([label, color]) => (
            <li key={label}>
              <span
                className="preset-swatch"
                style={{ background: color ?? "#ddd" }}
              />
              {label}
            </li>
          ))}
          <li>
            <span className="preset-swatch-text">{opening}</span>
          </li>
          <li>
            <span className="preset-swatch-text">
              Bela tehnika:{" "}
              {{ white: "bela", black: "crna", gray: "siva" }[preset.applianceColor]}
            </span>
          </li>
        </ul>
        {walls.length > 1 && (
          <div className="wall-tabs" aria-label="Zid u pregledu">
            {walls.map((w) => (
              <button
                key={w.id}
                className={w.id === wall.id ? "active" : ""}
                aria-pressed={w.id === wall.id}
                onClick={() => setWallId(w.id)}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}
        <div className="preset-preview" role="group" aria-label="Pregled predloga">
          <WallElevation
            scene={scene}
            scale={SCALE}
            selected={null}
            margin={{ left: 8, top: 8 }}
            canvasSize={{
              width: Math.round(scene.extent * SCALE) + 16,
              height: Math.round(scene.height * SCALE) + 16,
            }}
            rulers={false}
            showDimensions={false}
          />
        </div>
        <p className="preset-note">
          Elementi se prave prema dužinama zidova ({walls.map((w) => `${w.name} ${w.length} mm`).join(", ")}).
          Prozori, vrata i ostale prepreke ostaju gde su. Posle primene sve
          možete menjati.
        </p>
        {confirm && hasElements && (
          <p className="layout-warning" role="alert">
            Trenutni elementi ove kuhinje biće zamenjeni predlogom.
          </p>
        )}
        <div className="editor-save">
          <button className="btn secondary full" onClick={onClose}>
            Odustani
          </button>
          <button
            className="btn primary full"
            onClick={() => {
              if (hasElements && !confirm) setConfirm(true);
              else onApply(candidate, preset);
            }}
          >
            {confirm ? "Potvrdi zamenu" : `Primeni „${preset.name}“`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
