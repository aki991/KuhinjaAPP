import { number } from "../UI";
import type { ElevationScene } from "../../core/elevation";
/** Reserve separate label lanes when short fronts cannot fit readable dimensions. */
export function dimensionChains(scene: ElevationScene, scale: number) {
  const chain = (row: "base" | "wall") => {
    const ends: number[] = [],
      offsets = new Map<string, number>();
    const entries = scene.entries
      .filter((e) => e.row === row)
      .sort((a, b) => a.rect.x - b.rect.x);
    for (const e of entries) {
      const center = (e.rect.x + e.rect.width / 2) * scale,
        half = number(e.rect.width).length * 4 + 4;
      let lane = ends.findIndex((end) => end + 5 <= center - half);
      if (lane < 0) lane = ends.length;
      ends[lane] = center + half;
      offsets.set(e.key, lane * 22);
    }
    return { offsets, height: ends.length * 22 };
  };
  const base = chain("base"),
    wall = chain("wall"),
    baseY = 48,
    wallY = baseY + base.height + (base.height ? 18 : 0),
    totalY = wall.height ? wallY + wall.height + 18 : baseY + base.height + 18;
  return { base, wall, baseY, wallY, totalY };
}
export function WidthDimension({
  x,
  y,
  width,
  value,
  selected = false,
  textRotation = 0,
}: {
  x: number;
  y: number;
  width: number;
  value: number;
  selected?: boolean;
  textRotation?: number;
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
      <text
        x={x + width / 2}
        y={y - 7}
        textAnchor="middle"
        transform={
          textRotation
            ? `rotate(${textRotation} ${x + width / 2} ${y - 7})`
            : undefined
        }
      >
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
