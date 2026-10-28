import ExcelJS from "exceljs";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { calculateOffer } from "./engine";
import { categories, demoPrices, isSimulationOnly, templates } from "./catalog";
import { columns } from "./importer";
import type { Offer } from "./types";
import { effectiveSelection } from "./opening";
import { pdfPictures, type PdfPicture } from "./pdf-images";
import { cutList, cutListCsv, materialTotals } from "./cutlist";
import { drillingDxf, wtInput } from "./cnc";
export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function exampleExcel() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Demo cenovnik");
  sheet.addRow([...columns]);
  for (const p of demoPrices)
    sheet.addRow([
      p.code,
      p.name,
      p.manufacturer,
      categories[p.category],
      p.supplier,
      p.unit,
      p.price,
      p.currency,
      p.vatRate ?? "",
      p.discountRate ?? "",
      p.note,
      p.width ?? "",
      p.height ?? "",
      p.depth ?? "",
      p.sheetWidth || "",
      p.sheetHeight || "",
    ]);
  sheet.getRow(1).font = { bold: true, color: { argb: "FF164A75" } };
  sheet.columns.forEach((col) => {
    col.width = 24;
  });
  download(
    (await book.xlsx.writeBuffer()) as ArrayBuffer,
    "Primer-cenovnika.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
export async function readExcel(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Demo podržava fajlove do 10 MB.");
  let matrix: unknown[][] = [];
  if (file.name.toLowerCase().endsWith(".csv")) {
    const parsed = Papa.parse<string[]>(await file.text(), {
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length)
      throw new Error("CSV format nije ispravan: " + parsed.errors[0].message);
    matrix = parsed.data;
  } else {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets[0];
    if (!sheet) throw new Error("Excel nema radni list.");
    sheet.eachRow((row) => {
      matrix.push(
        (row.values as unknown[])
          .slice(1)
          .map((value) =>
            typeof value === "object" && value !== null
              ? "text" in value
                ? value.text
                : ""
              : value,
          ),
      );
    });
  }
  const headers = (matrix[0] || []).map((v) => String(v ?? "").trim());
  if (!headers.length || matrix.length < 2)
    throw new Error("Fajl nema zaglavlje ili podatke.");
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    throw new Error("Zaglavlja kolona moraju biti jedinstvena i popunjena.");
  const rows = matrix
    .slice(1)
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
  if (rows.length > 10000) throw new Error("Demo podržava do 10.000 redova.");
  return { headers, rows };
}
async function newPdf(orientation: "p" | "l" = "p") {
  const doc = new jsPDF({ orientation });
  const response = await fetch("/fonts/Arial.ttf");
  if (!response.ok)
    throw new Error("Font nije dostupan. Ponovo učitajte aplikaciju.");
  const buffer = await response.arrayBuffer();
  let binary = "";
  for (const byte of new Uint8Array(buffer))
    binary += String.fromCharCode(byte);
  doc.addFileToVFS("Arial.ttf", btoa(binary));
  doc.addFont("Arial.ttf", "Arial", "normal");
  doc.setFont("Arial");
  return doc;
}
const fileName = (o: Offer, label: string, ext: string) =>
  `${label}-${o.client.project.replace(/[^p{L}p{N}-]/gu, "-")}.${ext}`;
export function exportCutListCSV(o: Offer) {
  if (calculateOffer(o).errors.length)
    throw new Error("Ispravite greške u kalkulaciji pre izvoza krojne liste.");
  download(cutListCsv(o), fileName(o, "Krojna-lista", "csv"), "text/csv;charset=utf-8");
}
export function exportDrillingDXF(o: Offer) {
  if (calculateOffer(o).errors.length)
    throw new Error("Ispravite greške u kalkulaciji pre izvoza.");
  download(drillingDxf(o), fileName(o, "CNC-busenje", "dxf"), "application/dxf");
}
export function exportWtInput(o: Offer) {
  if (calculateOffer(o).errors.length)
    throw new Error("Ispravite greške u kalkulaciji pre izvoza.");
  download(wtInput(o), fileName(o, "Secenje", "WTINPUT"), "text/plain;charset=utf-8");
}
export async function exportCutListPDF(o: Offer) {
  if (calculateOffer(o).errors.length)
    throw new Error("Ispravite greške u kalkulaciji pre izvoza krojne liste.");
  const rows = cutList(o),
    doc = await newPdf("l");
  const cols: [string, number, "left" | "right"][] = [
      ["Elem.", 14, "left"],
      ["Deo", 66, "left"],
      ["Materijal", 84, "left"],
      ["Širina", 18, "right"],
      ["Visina", 18, "right"],
      ["Deb.", 12, "right"],
      ["Kom.", 12, "right"],
      ["Kant (m)", 22, "right"],
    ],
    left = 12,
    total = cols.reduce((a, c) => a + c[1], 0);
  let y = 18;
  const header = () => {
    doc.setFontSize(9);
    doc.setTextColor("#164A75");
    let x = left;
    for (const [label, w, align] of cols) {
      doc.text(label, align === "right" ? x + w - 1 : x + 1, y, { align });
      x += w;
    }
    doc.setDrawColor("#164A75");
    doc.line(left, y + 1.5, left + total, y + 1.5);
    y += 6;
    doc.setTextColor("#334155");
  };
  doc.setFontSize(15);
  doc.text(`Krojna lista — ${o.client.project}`, left, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(
    `${o.client.name || ""} · ${new Date(o.updatedAt).toLocaleDateString("sr-Latn-RS")} · Mere su u mm; širina × visina onako kako je deo definisan u elementu.`,
    left,
    y,
  );
  y += 7;
  header();
  doc.setFontSize(8.5);
  for (const r of rows) {
    const material = doc.splitTextToSize(r.material, cols[2][1] - 2),
      part = doc.splitTextToSize(r.part, cols[1][1] - 2),
      lines = Math.max(material.length, part.length),
      height = lines * 4 + 1.5;
    if (y + height > 195) {
      doc.addPage();
      y = 18;
      header();
      doc.setFontSize(8.5);
    }
    const cells: (string | string[])[] = [
      r.code,
      part,
      material,
      String(r.width),
      String(r.height),
      String(r.thickness),
      String(r.quantity),
      r.edge.toFixed(2).replace(".", ","),
    ];
    let x = left;
    cols.forEach(([, w, align], i) => {
      doc.text(cells[i], align === "right" ? x + w - 1 : x + 1, y, { align });
      x += w;
    });
    doc.setDrawColor("#e2e8f0");
    doc.line(left, y + height - 3, left + total, y + height - 3);
    y += height;
  }
  const totals = materialTotals(rows);
  if (y + 12 + totals.length * 5 > 195) {
    doc.addPage();
    y = 18;
  }
  y += 6;
  doc.setFontSize(11);
  doc.setTextColor("#164A75");
  doc.text("Ukupno po materijalu", left, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor("#334155");
  for (const t of totals) {
    doc.text(
      `${t.material} (${t.thickness} mm): ${t.pieces} kom, ${t.area.toFixed(2).replace(".", ",")} m²`,
      left,
      y,
    );
    y += 5;
  }
  doc.save(fileName(o, "Krojna-lista", "pdf"));
}
export async function exportPDF(o: Offer) {
  const c = calculateOffer(o);
  if (c.errors.length)
    throw new Error("Ispravite greške u kalkulaciji pre PDF izvoza.");
  const doc = await newPdf();
  const fmt = (v: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2 }).format(
      v,
    ) + " RSD";
  let y = 22,
    textX = 20,
    textWidth = 170;
  const line = (text: string, size = 11) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, textWidth);
    const lineHeight = size * 0.3528 * 1.35;
    if (y + lines.length * lineHeight > 275) {
      doc.addPage();
      y = 22;
    }
    doc.text(lines, textX, y);
    y += lines.length * lineHeight + 2;
  };
  // Pictures are optional: a failure only leaves them out of the offer.
  const pictures = await pdfPictures(o).catch(() => null);
  const picture = (p: PdfPicture, maxWidth = 170, maxHeight = 120) => {
    const scale = Math.min(maxWidth / p.width, maxHeight / p.height),
      w = p.width * scale,
      h = p.height * scale;
    if (y + h > 275) {
      doc.addPage();
      y = 22;
    }
    doc.addImage(p.data, "PNG", 20 + (maxWidth - w) / 2, y, w, h);
    y += h + 4;
  };
  doc.setTextColor("#164A75");
  line("KUHINJA KALKULATOR", 12);
  line("Ponuda za kuhinju po meri", 23);
  doc.setTextColor("#334155");
  line(o.client.project, 15);
  line(
    `Mušterija: ${o.client.name || "Nije uneto"}${o.client.phone ? " · " + o.client.phone : ""}`,
  );
  if (o.client.location) line("Lokacija: " + o.client.location);
  line(
    `Datum: ${new Date(o.updatedAt).toLocaleDateString("sr-Latn-RS")} · Ponuda ${o.id.slice(0, 8)}`,
  );
  const modelName = (id: string) =>
    o.prices.find((p) => p.id === id)?.name || "";
  line(
    `Klizači: ${modelName(o.selection.slide)}. Šarke: ${modelName(o.selection.hinge)}.`,
    8,
  );
  y += 4;
  // Order: 3D view, front view of the whole kitchen, then every element.
  if (pictures?.kitchen3d) picture(pictures.kitchen3d, 170, 115);
  for (const front of pictures?.fronts ?? []) {
    if (pictures!.fronts.length > 1) line(front.name, 10);
    picture(front.picture, 170, 130);
  }
  // Free-standing appliances and the decorative hood are only for the simulation.
  for (const e of o.elements.filter((x) => !isSimulationOnly(x.kind))) {
    const sel = effectiveSelection(e, o.selection),
      front = o.prices.find((p) => p.id === sel.front)?.name || "",
      body = o.prices.find((p) => p.id === sel.body)?.name || "";
    const elementPicture = pictures?.elements.get(e.id),
      startY = (() => {
        if (!elementPicture) return y;
        if (y + 30 > 275) {
          doc.addPage();
          y = 22;
        }
        doc.addImage(elementPicture.data, "PNG", 20, y, 26, 26);
        textX = 50;
        textWidth = 140;
        return y;
      })();
    line(
      `${e.quantity} × ${templates.find((t) => t.kind === e.kind)?.name} — ${e.width} × ${e.height} × ${e.depth} mm`,
    );
    if (e.kind === "worktop")
      line(
        `Materijal: ${o.prices.find((p) => p.id === sel.worktop)?.name || ""}.`,
        9,
      );
    else if (["panel", "side", "plinth"].includes(e.kind))
      line(`Materijal: ${e.kind === "plinth" ? body : front}.`, 9);
    else {
      const hasFront = c.elements
        .find((r) => r.element.id === e.id)
        ?.panels.some(
          (panel) =>
            o.prices.find((p) => p.id === panel.material)?.category === "front",
        );
      line(`Korpus: ${body}.${hasFront ? ` Front: ${front}.` : ""}`, 9);
      if (e.locked)
        line(
          `Individualni izbor: ${e.drawers ? modelName(sel.slide) : modelName(sel.hinge)}; ${sel.opening === "handles" ? "ručke" : sel.opening === "push" ? "push-to-open" : sel.opening === "overhang" ? `prepušteni front ${sel.frontOverhang ?? 20} mm` : "GOLA"}.`,
          8,
        );
    }
    if (e.note) line(e.note, 9);
    if (elementPicture) {
      y = Math.max(y, startY + 28);
      textX = 20;
      textWidth = 170;
    }
  }
  y += 4;
  doc.setTextColor("#164A75");
  line("UKUPNA CENA: " + fmt(c.total), 20);
  doc.setTextColor("#334155");
  line(
    "Konačna demo cena, bez posebnog obračuna PDV-a. Poreski status dogovoriti pre stvarne ponude.",
    9,
  );
  line(o.note || "Rok izrade i uslovi plaćanja po dogovoru.");
  line("Demo obračun — proveriti konstrukciju pre proizvodnje.", 9);
  line("Sve početne cene su izmišljeni primeri.", 9);
  doc.save(`Ponuda-${o.client.project.replace(/[^\p{L}\p{N}-]/gu, "-")}.pdf`);
}
