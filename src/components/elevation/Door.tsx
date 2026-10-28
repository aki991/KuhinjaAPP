/**
 * The one door design of the drawings: beige frame, inset panel, dashed opening lines and a handle.
 * `px` is the size of one screen pixel in the units of the drawing, so artwork drawn in millimetres
 * gets the same proportions as the drawings made in pixels.
 */
export default function Door({
  x,
  y,
  width: w,
  height: h,
  hinge = "left",
  handles,
  glass = false,
  lift = false,
  upper = false,
  position = "vertical",
  px = 1,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  hinge?: "left" | "right";
  handles: boolean;
  glass?: boolean;
  lift?: boolean;
  upper?: boolean;
  position?: "vertical" | "horizontal" | "center";
  px?: number;
}) {
  const inset = Math.min(4 * px, w * 0.08, h * 0.08);
  return (
    <g data-front={glass ? "glass" : "door"}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#f3e5c8"
        className="front-frame"
      />
      <rect
        data-front-panel="door"
        x={x + inset}
        y={y + inset}
        width={Math.max(0.1, w - 2 * inset)}
        height={Math.max(0.1, h - 2 * inset)}
        fill="#f8edd7"
        className="front-inset"
      />
      {glass && (
        <>
          <rect
            x={x + inset}
            y={y + inset}
            width={Math.max(0.1, w - 2 * inset)}
            height={Math.max(0.1, h - 2 * inset)}
            fill="#e1edf0"
          />
          <path
            d={`M${x + inset * 2} ${y + h * 0.65}L${x + w * 0.5} ${y + inset * 2}`}
            opacity=".3"
          />
        </>
      )}
      <path
        className="door-opening"
        data-opening-side={lift ? "up" : hinge}
        d={
          lift
            ? `M${x} ${y + h}L${x + w / 2} ${y}L${x + w} ${y + h}`
            : hinge === "left"
              ? `M${x + w} ${y}L${x} ${y + h / 2}L${x + w} ${y + h}`
              : `M${x} ${y}L${x + w} ${y + h / 2}L${x} ${y + h}`
        }
        fill="none"
      />
      {handles &&
        (lift ? (
          <path
            className="technical-handle"
            d={`M${x + w * 0.35} ${y + h - 5 * px}h${w * 0.3}`}
          />
        ) : position !== "vertical" ? (
          <path
            className="technical-handle"
            d={`M${position === "center" ? x + w * 0.35 : hinge === "left" ? x + w - Math.min(22 * px, w * 0.3) - 4 * px : x + 4 * px} ${upper ? y + h - inset - 4 * px : y + inset + 4 * px}h${Math.min(22 * px, w * 0.3)}`}
          />
        ) : (
          <path
            className="technical-handle"
            d={`M${hinge === "left" ? x + w - Math.max(3 * px, inset + px) : x + Math.max(3 * px, inset + px)} ${upper ? y + h - Math.min(20 * px, h * 0.23) - inset - 3 * px : y + inset + 3 * px}v${Math.min(20 * px, h * 0.23)}`}
          />
        ))}
    </g>
  );
}
