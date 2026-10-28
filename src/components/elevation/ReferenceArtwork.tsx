import { createElement, type ReactNode } from "react";
import catalog from "../../core/reference-catalog";
import { applianceStyle } from "../../core/appearance";
import Door from "./Door";
import type { GolaColor } from "../../core/types";

type Node = {
  tag: string;
  attrs: Record<string, string>;
  text?: string;
  children?: Node[];
};
const artwork = new Map(
  catalog.map((item) => [item.kind, item.art as unknown as Node]),
);
const tags = new Set([
  "g",
  "rect",
  "line",
  "polyline",
  "polygon",
  "circle",
  "text",
  "path",
]);
const attrName = (name: string) =>
  name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

export default function ReferenceArtwork({
  kind,
  width,
  height,
  handles,
  mirror,
  hood = false,
  freestanding = false,
  applianceColor,
  upper = false,
  position,
}: {
  upper?: boolean;
  position?: "vertical" | "horizontal" | "center";
  applianceColor?: GolaColor;
  hood?: boolean;
  freestanding?: boolean;
  kind: string;
  width: number;
  height: number;
  handles: boolean;
  mirror: boolean;
}) {
  const root = artwork.get(kind);
  if (!root) return null;
  const view = root.attrs.viewBox.split(" ").map(Number);
  // Below this line lies the hood body of a telescopic hood cabinet (the cabinet itself ends here).
  const hoodTop = view[3] + 2 * view[1];
  // Doors and drawers of the catalogue are drawn exactly like the other elements (see Door).
  const common = !applianceColor && !freestanding;
  const px = Number(view[2]) / Math.max(1, width);
  const num = (n: Node, name: string) => Number(n.attrs[name]);
  const isFront = (n: Node) =>
    n.tag === "rect" && n.attrs.fill === "#f3e5c8" && num(n, "width") > 60 && num(n, "height") > 60;
  const isOpening = (n: Node) =>
    n.tag === "polyline" && !!n.attrs["stroke-dasharray"] && n.attrs.stroke === "#526269";
  const isDecor = (n: Node) =>
    n.tag === "g" &&
    n.children?.[0]?.tag === "rect" &&
    n.children[0].attrs.fill === "none" &&
    n.children[0].attrs.stroke === "#526269" &&
    !!n.children[0].attrs.opacity;
  const record = catalog.find((c) => c.kind === kind);
  // Blind corner cabinets have a door without a drawn opening line.
  const cornerDoor = /ugaon|slep/i.test(record?.name ?? "");
  const handleX: number[] = [];
  const openings: Node[] = [];
  const scan = (n: Node) => {
    if (isOpening(n)) openings.push(n);
    if (n.tag === "rect" && n.attrs.rx && n.attrs.fill === "#526269") handleX.push(num(n, "x"));
    n.children?.forEach(scan);
  };
  scan(root);
  const draw = (node: Node, key: string): ReactNode => {
    if (!tags.has(node.tag)) return null;
    if (common) {
      if (isOpening(node) || isDecor(node)) return null;
      if (isFront(node)) {
        const x = num(node, "x") || 0,
          y = num(node, "y") || 0,
          fw = num(node, "width"),
          fh = num(node, "height");
        const opening = openings.find((o) => {
          const pts = o.attrs.points.trim().split(/\s+/).map((p) => p.split(",").map(Number));
          return pts.every(([px0]) => px0 >= x - 2 && px0 <= x + fw + 2);
        });
        if (opening || cornerDoor) {
          const pts = opening
              ? opening.attrs.points.trim().split(/\s+/).map((p) => p.split(",").map(Number))
              : [],
            apex = pts[1] ?? pts[0],
            // No opening line: the handle sits on the side opposite to the hinge.
            nearHandle = handleX.find((hx) => hx >= x && hx <= x + fw),
            hinge = apex
              ? apex[0] < x + fw / 2
                ? "left"
                : "right"
              : nearHandle !== undefined && nearHandle < x + fw / 2
                ? "right"
                : "left";
          return (
            <Door
              key={key}
              x={x}
              y={y}
              width={fw}
              height={fh}
              hinge={hinge}
              handles={handles}
              upper={upper}
              position={position}
              px={px}
            />
          );
        }
        // A drawer or a plain panel: the same frame and inset as a drawer front.
        const inset = Math.min(3 * px, fh * 0.1);
        return (
          <g key={key} data-front="drawer">
            <rect x={x} y={y} width={fw} height={fh} fill="#f3e5c8" className="front-frame" />
            <rect
              data-front-panel="drawer"
              x={x + inset}
              y={y + inset}
              width={Math.max(0.1, fw - 2 * inset)}
              height={Math.max(0.1, fh - 2 * inset)}
              fill="#f8edd7"
              className="front-inset"
            />
            {handles && (
              <path
                className="technical-handle"
                d={`M${x + fw * 0.37} ${y + Math.min(7 * px, fh * 0.3)}h${fw * 0.26}`}
              />
            )}
          </g>
        );
      }
    }
    const attrs = Object.fromEntries(
      Object.entries(node.attrs).map(([name, value]) => [
        attrName(name),
        value,
      ]),
    );
    const w = Number(node.attrs.width),
      h = Number(node.attrs.height);
    const onHood = Number(node.attrs.y ?? node.attrs.y1 ?? 0) >= hoodTop - 0.5;
    if (applianceColor && (!hood || onHood)) {
      // White goods: recolour the steel body, its lines and its handles.
      const st = applianceStyle(applianceColor);
      if (attrs.fill?.toLowerCase() === "#e4e6e3") attrs.fill = st.body;
      if (attrs.stroke === "#686d65") attrs.stroke = st.line;
      if (attrs.fill === "#526269") attrs.fill = st.detail;
      if (attrs.stroke === "#526269") attrs.stroke = st.detail;
    }
    if (!applianceColor && !freestanding && attrs.stroke) {
      // Cabinet fronts look the same as the drawn ones: beige frame, inset line, dashed opening
      // lines, all with thin lines of constant width on screen.
      const dash = attrs.strokeDasharray;
      if (attrs.stroke === "#686d65") {
        attrs.stroke = "#a69472";
        attrs.strokeWidth = "0.85";
        attrs.vectorEffect = "non-scaling-stroke";
        if (dash) attrs.strokeDasharray = "4 3";
      } else if (
        attrs.stroke === "#526269" &&
        (dash || (attrs.fill === "none" && attrs.opacity))
      ) {
        attrs.stroke = dash ? "#a99c80" : "#c8b58c";
        attrs.strokeWidth = dash ? "0.75" : "0.85";
        attrs.vectorEffect = "non-scaling-stroke";
        attrs.opacity = "1";
        if (dash) attrs.strokeDasharray = "4 4";
      }
    }
    const handle =
      node.tag === "rect" &&
      !!node.attrs.rx &&
      node.attrs.fill === "#526269" &&
      w > 0 &&
      h > 0 &&
      Math.max(w / h, h / w) >= 3;
    if (handle && (!handles || (common && root.children?.some((n) => isFront(n) || n.children?.some(isFront)))))
      return null;
    if (handle) {
      attrs.className = "reference-handle";
      if (applianceColor && (!hood || onHood))
        attrs.style = { fill: applianceStyle(applianceColor).detail } as never;
    }
    else if (node.attrs.fill === "#f3e5c8") attrs.className = "reference-front";
    else if (node.attrs.fill === "#e8dfcc") {
      // An appliance has no decor-coloured carcass: keep a neutral steel edge.
      if (freestanding) attrs.fill = "#c3c8c6";
      else attrs.className = "reference-body";
    }
    return createElement(
      node.tag,
      { ...attrs, key },
      node.text,
      ...(node.children || []).map((child, i) => draw(child, `${key}-${i}`)),
    );
  };
  const box = root.attrs.viewBox.split(/\s+/).map(Number);
  // The hood body (y 680–720) lies below the cabinet; include it in the visible area.
  const viewBox = hood ? [box[0], box[1], box[2], box[3] + 40] : box;
  const transform = mirror ? `translate(${2 * viewBox[0] + viewBox[2]} 0) scale(-1 1)` : undefined;
  return (
    <svg
      data-reference-art={kind}
      x={0}
      y={0}
      width={width}
      height={height}
      viewBox={viewBox.join(" ")}
      preserveAspectRatio="none"
      overflow="hidden"
    >
      <g transform={transform}>{(root.children || []).map((node, i) => draw(node, String(i)))}</g>
    </svg>
  );
}
