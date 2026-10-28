import { applianceStyle } from "../../core/appearance";
import type { GolaColor } from "../../core/types";
export function ApplianceSVG({
  kind,
  width: w,
  height: h,
  handles = true,
  color,
}: {
  kind: "oven" | "fridge" | "dishwasher";
  width: number;
  height: number;
  handles?: boolean;
  color?: GolaColor;
}) {
  const st = applianceStyle(color),
    ink = { stroke: st.line, color: st.detail };
  if (kind === "oven")
    return (
      <g data-appliance="oven" className="appliance-lines" style={ink}>
        <rect width={w} height={h} rx={1.5} fill={st.body} />
        <rect
          x={w * 0.09}
          y={h * 0.24}
          width={w * 0.82}
          height={h * 0.63}
          rx={1.5}
          fill="#2c332d"
        />
        <path d={`M${w * 0.12} ${h * 0.19}H${w * 0.88}`} strokeWidth="2" />
        {[0.18, 0.82].map((x) => (
          <circle
            key={x}
            cx={w * x}
            cy={h * 0.105}
            r={Math.max(1, w * 0.035)}
            fill={st.detail}
          />
        ))}
        <rect
          x={w * 0.39}
          y={h * 0.07}
          width={w * 0.22}
          height={h * 0.065}
          rx={1}
          fill={color === "black" ? "#4a4f52" : "#3b3f35"}
          stroke="none"
        />
        <path
          d={`M${w * 0.17} ${h * 0.73}H${w * 0.83}M${w * 0.17} ${h * 0.79}H${w * 0.83}`}
          opacity=".4"
        />
      </g>
    );
  if (kind === "fridge")
    return (
      <g data-appliance="fridge" className="appliance-lines" style={ink}>
        <rect width={w} height={h} fill={st.body} />
        {[
          { y: 0, height: h * 0.6, label: "FRIŽIDER" },
          { y: h * 0.6, height: h * 0.4, label: "ZAMRZIVAČ" },
        ].map((part, i) => (
          <g key={i}>
            <rect
              data-front-panel="fridge"
              x={3}
              y={part.y + 3}
              width={Math.max(1, w - 6)}
              height={Math.max(1, part.height - 6)}
              style={{ fill: st.panel }}
            />
            <path
              d={`M${w - 4} ${part.y + 4}L4 ${part.y + part.height / 2}L${w - 4} ${part.y + part.height - 4}`}
              className="door-opening"
              fill="none"
            />
            {w >= 95 && h >= 140 && (
              <text
                className="appliance-label"
                style={{ fill: st.detail }}
                x={w / 2}
                y={part.y + part.height * 0.53}
                textAnchor="middle"
              >
                {part.label}
              </text>
            )}
          </g>
        ))}
        <path d={`M0 ${h * 0.6}H${w}`} />
        {handles && (
          <path
            d={`M${w * 0.88} ${h * 0.44}v${h * 0.1}M${w * 0.88} ${h * 0.66}v${h * 0.1}`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  return (
    <g data-appliance="dishwasher" className="appliance-lines" style={ink}>
      <rect width={w} height={h} fill={st.body} />
      <rect
        x={1}
        y={1}
        width={Math.max(1, w - 2)}
        height={h * 0.12}
        fill={st.panel}
      />
      {[0.16, 0.24, 0.32].map((x) => (
        <circle
          key={x}
          cx={w * x}
          cy={h * 0.065}
          r={Math.max(0.7, w * 0.014)}
          fill={st.detail}
          stroke="none"
        />
      ))}
      {handles && (
        <path
          d={`M${w * 0.25} ${h * 0.2}H${w * 0.75}`}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      <path
        d={`M${w * 0.08} ${h * 0.9}H${w * 0.92}M${w * 0.08} ${h * 0.94}H${w * 0.92}`}
        opacity=".45"
      />
    </g>
  );
}
export function HobSVG({
  x,
  y,
  width,
}: {
  x: number;
  y: number;
  width: number;
}) {
  const w = width * 0.82,
    h = Math.max(5, width * 0.11);
  return (
    <g data-appliance="hob" className="appliance-lines">
      <rect
        x={x + (width - w) / 2}
        y={y - h * 0.75}
        width={w}
        height={h}
        rx={1.5}
        fill="#1f2427"
        stroke="#0f1315"
      />
      {[0.2, 0.4, 0.6, 0.8].map((at, i) => (
        <ellipse
          key={at}
          stroke="#8d989d"
          cx={x + (width - w) / 2 + w * at}
          cy={y - h * 0.25}
          rx={w * (i % 2 ? 0.07 : 0.085)}
          ry={h * 0.24}
          fill="none"
        />
      ))}
    </g>
  );
}
export function SinkSVG({
  x,
  y,
  width,
}: {
  x: number;
  y: number;
  width: number;
}) {
  // Seen from the front only the tap shows, in the middle of the sink.
  const stem = x + width * 0.56,
    spout = width * 0.24;
  return (
    <g data-appliance="sink" className="appliance-lines">
      <path
        d={`M${stem} ${y}v${-width * 0.18}q0 ${-width * 0.13} ${-width * 0.12} ${-width * 0.13}q${-width * 0.12} 0 ${-width * 0.12} ${width * 0.13}`}
        fill="none"
        strokeWidth="1.5"
      />
      <path d={`M${stem - spout / 2 - width * 0.05} ${y - 2}h${width * 0.1}`} strokeWidth="2" />
    </g>
  );
}
