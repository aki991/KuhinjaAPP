import { createElement, type ReactNode } from "react";
import catalog from "../../core/reference-catalog";
import { applianceStyle } from "../../core/appearance";
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
}: {
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
  const draw = (node: Node, key: string): ReactNode => {
    if (!tags.has(node.tag)) return null;
    const attrs = Object.fromEntries(
      Object.entries(node.attrs).map(([name, value]) => [
        attrName(name),
        value,
      ]),
    );
    const w = Number(node.attrs.width),
      h = Number(node.attrs.height);
    if (applianceColor) {
      // White goods: recolour the steel body, its lines and its handles.
      const st = applianceStyle(applianceColor);
      if (attrs.fill?.toLowerCase() === "#e4e6e3") attrs.fill = st.body;
      if (attrs.stroke === "#686d65") attrs.stroke = st.line;
      if (attrs.fill === "#526269") attrs.fill = st.detail;
      if (attrs.stroke === "#526269") attrs.stroke = st.detail;
    }
    const handle =
      node.tag === "rect" &&
      !!node.attrs.rx &&
      node.attrs.fill === "#526269" &&
      w > 0 &&
      h > 0 &&
      Math.max(w / h, h / w) >= 3;
    if (handle && !handles) return null;
    if (handle) {
      attrs.className = "reference-handle";
      if (applianceColor)
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
