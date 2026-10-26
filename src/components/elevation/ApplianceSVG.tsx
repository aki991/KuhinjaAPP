export function ApplianceSVG({
  kind,
  width: w,
  height: h,
  handles = true,
}: {
  kind: "oven" | "fridge" | "dishwasher";
  width: number;
  height: number;
  handles?: boolean;
}) {
  if (kind === "oven")
    return (
      <g data-appliance="oven" className="appliance-lines">
        <rect width={w} height={h} rx={1.5} fill="#e6e7e5" />
        <rect
          x={w * 0.09}
          y={h * 0.24}
          width={w * 0.82}
          height={h * 0.63}
          rx={1.5}
          fill="#d5dde0"
        />
        <path d={`M${w * 0.12} ${h * 0.19}H${w * 0.88}`} strokeWidth="2" />
        {[0.18, 0.82].map((x) => (
          <circle
            key={x}
            cx={w * x}
            cy={h * 0.105}
            r={Math.max(1, w * 0.035)}
            fill="#d3d7d7"
          />
        ))}
        <rect
          x={w * 0.39}
          y={h * 0.07}
          width={w * 0.22}
          height={h * 0.065}
          rx={1}
          fill="#819095"
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
      <g data-appliance="fridge" className="appliance-lines">
        <rect width={w} height={h} fill="#efeee8" />
        <path d={`M0 ${h * 0.6}H${w}`} />
        {handles && (
          <path
            d={`M${w * 0.16} ${h * 0.44}v${h * 0.1}M${w * 0.16} ${h * 0.66}v${h * 0.1}`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  return (
    <g data-appliance="dishwasher" className="appliance-lines">
      <rect width={w} height={h} fill="#eee9dc" />
      <rect
        x={1}
        y={1}
        width={Math.max(1, w - 2)}
        height={h * 0.12}
        fill="#e0e4e4"
      />
      {[0.16, 0.24, 0.32].map((x) => (
        <circle
          key={x}
          cx={w * x}
          cy={h * 0.065}
          r={Math.max(0.7, w * 0.014)}
          fill="#839094"
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
        fill="#d8dfe0"
      />
      {[0.2, 0.4, 0.6, 0.8].map((at, i) => (
        <ellipse
          key={at}
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
  const basin = width * 0.53;
  return (
    <g data-appliance="sink" className="appliance-lines">
      <path
        d={`M${x + width * 0.12} ${y}H${x + width * 0.88}M${x + (width - basin) / 2} ${y}q0 ${width * 0.17} ${basin / 2} ${width * 0.17}q${basin / 2} 0 ${basin / 2} ${-width * 0.17}`}
        fill="#edf2f2"
      />
      <path
        d={`M${x + width * 0.61} ${y}v${-width * 0.18}q0 ${-width * 0.13} ${-width * 0.12} ${-width * 0.13}q${-width * 0.12} 0 ${-width * 0.12} ${width * 0.13}`}
        fill="none"
        strokeWidth="1.5"
      />
      <path
        d={`M${x + width * 0.56} ${y - 2}h${width * 0.1}`}
        strokeWidth="2"
      />
    </g>
  );
}
