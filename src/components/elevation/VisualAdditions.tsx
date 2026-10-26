import type { Rect } from "../../core/elevation";
import type { WallObject } from "../../core/types";
export default function VisualAddition({
  object: o,
  rect: r,
}: {
  object: WallObject;
  rect: Rect;
}) {
  const { x, y, width: w, height: h } = r;
  return (
    <g
      data-wall-object={o.id}
      data-object-kind={o.kind}
      className="wall-object"
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={
          o.kind === "window"
            ? "#e9f0f2"
            : o.kind === "column"
              ? "#e7e9e8"
              : "#f6f8f8"
        }
        strokeDasharray={o.kind === "niche" ? "5 4" : undefined}
      />
      {o.kind === "window" && (
        <>
          <rect
            x={x + 3}
            y={y + 3}
            width={Math.max(1, w - 6)}
            height={Math.max(1, h - 6)}
            fill="none"
          />
          <path
            d={`M${x + w / 2} ${y + 3}v${h - 6}M${x + 3} ${y + h * 0.55}h${w - 6}`}
          />
          <path
            d={`M${x + w / 2 - 5} ${y + h * 0.55 + 6}v${Math.min(10, h * 0.12)}`}
          />
        </>
      )}
      {o.kind === "door" && (
        <>
          <rect
            x={x + 3}
            y={y + 3}
            width={Math.max(1, w - 6)}
            height={Math.max(1, h - 3)}
            fill="none"
          />
          <path
            d={`M${x + w * 0.8} ${y + h * 0.55}h${Math.min(9, w * 0.15)}`}
          />
        </>
      )}
      {o.kind === "column" &&
        Array.from({ length: Math.min(20, Math.ceil(h / 12)) }, (_, i) => (
          <path
            key={i}
            d={`M${x} ${y + i * 12}l${Math.min(w, 12)} ${-Math.min(w, 12)}`}
            opacity=".28"
          />
        ))}
    </g>
  );
}
