import type { Tile } from "../../core/tiles";

/** One seamless repeating cell of a tile pattern, drawn on a canvas (browser only). */
export interface TileImage {
  canvas: HTMLCanvasElement;
  url: string;
  /** Real size of the cell in mm, so patterns can be scaled to the room. */
  cellWidth: number;
  cellHeight: number;
}

const GROUT = 3;
const cache = new Map<string, TileImage | null>();

function random(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes two #rrggbb colours; amount 0 gives a, 1 gives b. */
function mix(a: string, b: string, amount: number) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(
      ((pa >> shift) & 255) * (1 - amount) + ((pb >> shift) & 255) * amount,
    );
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

export function tileImage(tile: Tile): TileImage | null {
  if (typeof document === "undefined") return null;
  const cached = cache.get(tile.id);
  if (cached !== undefined) return cached;
  const long = Math.max(tile.width, tile.height),
    short = Math.min(tile.width, tile.height),
    radius = tile.width / Math.sqrt(3);
  let cellWidth = tile.width,
    cellHeight = tile.height;
  if (tile.pattern === "subway") [cellWidth, cellHeight] = [long, 2 * short];
  if (tile.pattern === "planks") [cellWidth, cellHeight] = [long, 6 * short];
  if (tile.pattern === "hex") [cellWidth, cellHeight] = [tile.width, 3 * radius];
  if (tile.pattern === "mosaic") [cellWidth, cellHeight] = [tile.width * 8, tile.height * 8];
  const k = Math.max(0.2, 512 / Math.max(cellWidth, cellHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(32, Math.round(cellWidth * k));
  canvas.height = Math.max(32, Math.round(cellHeight * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cache.set(tile.id, null);
    return null;
  }
  const rnd = random(tile.id),
    g = Math.max(1, GROUT * k);
  ctx.fillStyle = tile.grout;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x + g / 2, y + g / 2, w - g, h - g);
  };
  const shade = () => mix(tile.color, tile.accent, rnd() * 0.35);
  const W = canvas.width,
    H = canvas.height;
  switch (tile.pattern) {
    case "grid":
    case "zellige":
    case "marble":
    case "terrazzo":
    case "concrete": {
      const w = tile.width * k,
        h = tile.height * k;
      for (let y = 0; y < H - 1; y += h)
        for (let x = 0; x < W - 1; x += w) {
          const fill =
            tile.pattern === "zellige" ? shade() : tile.pattern === "grid" ? mix(tile.color, tile.accent, rnd() * 0.2) : tile.color;
          rect(x, y, w, h, fill);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + g / 2, y + g / 2, w - g, h - g);
          ctx.clip();
          if (tile.pattern === "zellige") {
            ctx.strokeStyle = "rgba(255,255,255,0.28)";
            ctx.lineWidth = Math.max(1, k * 3);
            ctx.strokeRect(x + g + 2, y + g + 2, w - 2 * g - 4, h - 2 * g - 4);
          }
          if (tile.pattern === "marble") {
            for (let v = 0; v < 5; v++) {
              ctx.strokeStyle = mix(tile.color, tile.accent, 0.35 + rnd() * 0.5);
              ctx.globalAlpha = 0.25 + rnd() * 0.35;
              ctx.lineWidth = Math.max(1, rnd() * k * 5);
              ctx.beginPath();
              const sx = x + rnd() * w,
                sy = y + (v % 2 ? 0 : h);
              ctx.moveTo(sx, sy);
              ctx.bezierCurveTo(
                x + rnd() * w, y + rnd() * h,
                x + rnd() * w, y + rnd() * h,
                x + rnd() * w, y + (v % 2 ? h : 0),
              );
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          if (tile.pattern === "terrazzo") {
            const colours = [tile.accent, "#5b5a57", "#c8b8a2", "#f2eee6", "#a88b74"];
            for (let c = 0; c < 70; c++) {
              ctx.fillStyle = colours[Math.floor(rnd() * colours.length)];
              const cx = x + rnd() * w,
                cy = y + rnd() * h,
                size = (4 + rnd() * 16) * k * 1.4;
              ctx.beginPath();
              ctx.ellipse(cx, cy, size, size * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          if (tile.pattern === "concrete") {
            for (let n = 0; n < 700; n++) {
              ctx.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
              const size = 2 + rnd() * 26 * k;
              ctx.fillRect(x + rnd() * w, y + rnd() * h, size, size * (0.4 + rnd()));
            }
          }
          ctx.restore();
        }
      break;
    }
    case "subway": {
      const w = long * k,
        h = short * k;
      for (let row = 0; row < 2; row++)
        for (let i = -1; i < 2; i++)
          rect(i * w + (row % 2 ? w / 2 : 0), row * h, w, h, mix(tile.color, tile.accent, rnd() * 0.45));
      break;
    }
    case "planks": {
      const w = long * k,
        h = short * k,
        offsets = [0, 0.37, 0.71, 0.18, 0.55, 0.86];
      for (let row = 0; row < 6; row++)
        for (let i = -1; i < 2; i++) {
          const x = (i + offsets[row]) * w,
            fill = mix(tile.color, tile.accent, rnd() * 0.55);
          rect(x, row * h, w, h, fill);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + g / 2, row * h + g / 2, w - g, h - g);
          ctx.clip();
          for (let line = 0; line < 7; line++) {
            ctx.strokeStyle = mix(tile.accent, "#000000", 0.25);
            ctx.globalAlpha = 0.1 + rnd() * 0.18;
            ctx.lineWidth = 1 + rnd() * 1.5;
            const y0 = row * h + rnd() * h;
            ctx.beginPath();
            ctx.moveTo(x, y0);
            ctx.bezierCurveTo(x + w * 0.3, y0 + (rnd() - 0.5) * h * 0.4, x + w * 0.6, y0 + (rnd() - 0.5) * h * 0.4, x + w, y0 + (rnd() - 0.5) * h * 0.2);
            ctx.stroke();
          }
          ctx.restore();
        }
      break;
    }
    case "hex": {
      const R = radius * k,
        hexW = tile.width * k;
      for (let row = -1; row < 4; row++)
        for (let col = -1; col < Math.ceil(W / hexW) + 1; col++) {
          const cx = col * hexW + (row % 2 ? hexW / 2 : 0) + hexW / 2,
            cy = row * 1.5 * R + R;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6,
              r = R - g * 0.55;
            const px = cx + r * Math.cos(angle),
              py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = rnd() < 0.35 ? tile.accent : mix(tile.color, tile.accent, rnd() * 0.15);
          ctx.fill();
        }
      break;
    }
    case "mosaic": {
      const w = tile.width * k,
        h = tile.height * k;
      for (let y = 0; y < H - 1; y += h)
        for (let x = 0; x < W - 1; x += w) rect(x, y, w, h, mix(tile.color, tile.accent, rnd()));
      break;
    }
  }
  const image: TileImage = {
    canvas,
    url: canvas.toDataURL("image/png"),
    cellWidth,
    cellHeight,
  };
  cache.set(tile.id, image);
  return image;
}
