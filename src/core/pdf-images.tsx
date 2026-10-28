import { createElement } from "react";
import { elevationScene, type ElevationEntry } from "./elevation";
import { isSimulationOnly } from "./catalog";
import type { Offer } from "./types";

/** Browser-only helpers that turn the app's drawings into PNG pictures for the PDF offer. */
export interface PdfPicture {
  data: string;
  width: number;
  height: number;
}

const cssRegex =
  /wall-elevation|technical|front-|material-|cabinet-outline|reference-|door-opening|appliance|elevation|finish|dimension/;
let cachedCss = "";
/** Standalone SVG images cannot see the page's CSS, so the drawing rules are embedded. */
function drawingCss() {
  if (cachedCss) return cachedCss;
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules))
        if (cssRegex.test(rule.cssText)) rules.push(rule.cssText);
    } catch {
      // Cross-origin stylesheets (fonts) are not readable and not needed.
    }
  }
  cachedCss =
    rules.join("\n") +
    "\ntext{font-family:Arial,Helvetica,sans-serif}svg{background:transparent}";
  return cachedCss;
}

async function svgToPicture(
  markup: string,
  width: number,
  height: number,
  scale = 2,
): Promise<PdfPicture> {
  const svg = markup.replace(
    /^<svg /,
    `<svg xmlns="http://www.w3.org/2000/svg" `,
  ).replace(/^(<svg[^>]*>)/, `$1<style>${drawingCss()}</style>`);
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pdfPictures(offer: Offer) {
  const [{ renderToStaticMarkup }, { default: ElementSVG }, { default: WallElevation }] =
    await Promise.all([
      import("react-dom/server"),
      import("../components/elevation/ElementSVG"),
      import("../components/elevation/WallElevation"),
    ]);
  const scenes = (offer.layout?.walls ?? [])
    .filter((w) => w.id !== "island" || offer.elements.some((e) => e.placement?.wall === "island"))
    .map((wall) => ({ wall, scene: elevationScene(offer, wall.id) }));
  const result = {
    kitchen3d: null as PdfPicture | null,
    fronts: [] as { name: string; picture: PdfPicture }[],
    elements: new Map<string, PdfPicture>(),
  };
  try {
    const { renderKitchenImage } = await import(
      "../components/elevation/Kitchen3DViewport"
    );
    result.kitchen3d = await renderKitchenImage(offer);
  } catch {
    // No WebGL: the PDF is still produced, without the 3D picture.
  }
  for (const { wall, scene } of scenes) {
    if (!scene.entries.length) continue;
    try {
      const scale = Math.min(0.32, 900 / Math.max(1, scene.extent)),
        width = scene.extent * scale + 100,
        height = scene.height * scale + 116;
      const markup = renderToStaticMarkup(
        createElement(WallElevation, {
          scene,
          scale,
          selected: null,
          rulers: true,
          showDimensions: true,
        }),
      );
      result.fronts.push({
        name: wall.name,
        picture: await svgToPicture(markup, width, height),
      });
    } catch {
      // A failed picture never blocks the offer.
    }
  }
  const entries = new Map<string, ElevationEntry>();
  for (const { scene } of scenes)
    for (const e of scene.entries)
      if (e.instance === 0 && !entries.has(e.id)) entries.set(e.id, e);
  const box = 240;
  for (const element of offer.elements) {
    if (isSimulationOnly(element.kind)) continue;
    const entry = entries.get(element.id);
    if (!entry) continue;
    try {
      const { width, height } = entry.rect,
        s = Math.min(box / width, box / height),
        w = width * s,
        h = height * s;
      const markup = renderToStaticMarkup(
        createElement(
          "svg",
          {
            className: "wall-elevation",
            width: box,
            height: box,
            viewBox: `0 0 ${box} ${box}`,
          },
          createElement(
            "g",
            { transform: `translate(${(box - w) / 2} ${(box - h) / 2})` },
            createElement(ElementSVG, {
              entry,
              rect: { x: 0, y: 0, width: w, height: h },
              selected: false,
              dragging: false,
              thumbnail: true,
              bare: true,
            }),
          ),
        ),
      );
      result.elements.set(element.id, await svgToPicture(markup, box, box));
    } catch {
      // Skip this element's picture.
    }
  }
  return result;
}
