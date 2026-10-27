import { createElement, type ReactNode } from "react";
import catalog from "../../core/reference-catalog";

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
}: {
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
    const handle =
      node.tag === "rect" &&
      !!node.attrs.rx &&
      node.attrs.fill === "#526269" &&
      w > 0 &&
      h > 0 &&
      Math.max(w / h, h / w) >= 3;
    if (handle && !handles) return null;
    if (handle) attrs.className = "reference-handle";
    else if (node.attrs.fill === "#f3e5c8") attrs.className = "reference-front";
    else if (node.attrs.fill === "#e8dfcc") attrs.className = "reference-body";
    return createElement(
      node.tag,
      { ...attrs, key },
      node.text,
      ...(node.children || []).map((child, i) => draw(child, `${key}-${i}`)),
    );
  };
  const viewBox = root.attrs.viewBox.split(/\s+/).map(Number);
  const transform = mirror ? `translate(${2 * viewBox[0] + viewBox[2]} 0) scale(-1 1)` : undefined;
  return (
    <svg
      data-reference-art={kind}
      x={0}
      y={0}
      width={width}
      height={height}
      viewBox={root.attrs.viewBox}
      preserveAspectRatio="none"
      overflow="hidden"
    >
      <g transform={transform}>{(root.children || []).map((node, i) => draw(node, String(i)))}</g>
    </svg>
  );
}
