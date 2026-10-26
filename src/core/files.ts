import ExcelJS from "exceljs";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { calculateOffer } from "./engine";
import { categories, demoPrices, templates } from "./catalog";
import { columns } from "./importer";
import type { Offer } from "./types";
import { effectiveSelection } from "./opening";
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
      categories[p.category],
      p.supplier,
      p.unit,
      p.price,
      p.currency,
      p.note,
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
export async function exportPDF(o: Offer) {
  const c = calculateOffer(o);
  if (c.errors.length)
    throw new Error("Ispravite greške u kalkulaciji pre PDF izvoza.");
  const doc = new jsPDF();
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
  const fmt = (v: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2 }).format(
      v,
    ) + " RSD";
  let y = 22;
  const line = (text: string, size = 11) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 170);
    const lineHeight = size * 0.3528 * 1.35;
    if (y + lines.length * lineHeight > 275) {
      doc.addPage();
      y = 22;
    }
    doc.text(lines, 20, y);
    y += lines.length * lineHeight + 2;
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
  for (const e of o.elements) {
    const sel = effectiveSelection(e, o.selection),
      front = o.prices.find((p) => p.id === sel.front)?.name || "",
      body = o.prices.find((p) => p.id === sel.body)?.name || "";
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
