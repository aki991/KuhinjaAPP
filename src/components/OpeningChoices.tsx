import type { Opening } from "../core/types";
import { Field } from "./UI";
const labels: Record<Opening, string> = {
  handles: "Ručke",
  gola: "GOLA",
  push: "Push",
  overhang: "Prepušteni front",
};
export default function OpeningChoices({
  label,
  value,
  options,
  onChange,
  extension,
  onExtension,
  vertical = false,
}: {
  label: string;
  value: Opening;
  options: Opening[];
  onChange: (v: Opening) => void;
  extension?: number;
  onExtension?: (n: number) => void;
  vertical?: boolean;
}) {
  return (
    <fieldset className="opening-choices">
      <legend>{label}</legend>
      <div className="choice-buttons">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {o === "gola" && vertical ? "Vertikalna GOLA" : labels[o]}
          </button>
        ))}
      </div>
      {value === "overhang" && onExtension && (
        <Field label="Prepust (mm)">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            step="1"
            required
            value={extension ?? 20}
            onChange={(e) => onExtension(Number(e.target.value))}
          />
        </Field>
      )}
    </fieldset>
  );
}
