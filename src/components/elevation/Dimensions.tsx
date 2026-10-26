import { number } from "../UI";
export function WidthDimension({
  x,
  y,
  width,
  value,
  selected = false,
}: {
  x: number;
  y: number;
  width: number;
  value: number;
  selected?: boolean;
}) {
  return (
    <g
      className={`technical-dimension ${selected ? "selected" : ""}`}
      aria-hidden="true"
    >
      <path
        d={`M${x} ${y - 5}v10M${x + width} ${y - 5}v10M${x} ${y}h${width}`}
      />
      <path d={`M${x - 3} ${y + 3}l6 -6M${x + width - 3} ${y + 3}l6 -6`} />
      <text x={x + width / 2} y={y - 7} textAnchor="middle">
        {number(value)}
      </text>
    </g>
  );
}
export function HeightDimension({
  x,
  y,
  height,
  value,
  broken = false,
}: {
  x: number;
  y: number;
  height: number;
  value: number;
  broken?: boolean;
}) {
  return (
    <g className="technical-dimension wall-height" aria-hidden="true">
      <path
        d={`M${x - 5} ${y}h10M${x - 5} ${y + height}h10M${x} ${y}v${height}`}
      />
      {broken && (
        <path
          className="dimension-break"
          d={`M${x - 5} ${y + height * 0.3 - 3}l10 6M${x - 5} ${y + height * 0.3 + 3}l10 6`}
        />
      )}
      <text
        x={x - 8}
        y={y + height / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${x - 8} ${y + height / 2})`}
      >
        {number(value)}
      </text>
    </g>
  );
}
