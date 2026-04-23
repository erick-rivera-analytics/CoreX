"use client";

import { FileDown } from "lucide-react";

import { formatDecimal, formatInteger, formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import type { PoscosechaClasificacionModeResult } from "@/lib/postcosecha-clasificacion-en-blanco-types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 42;
const TOP_Y = 742;
const BOTTOM_Y = 54;
const LINE_HEIGHT = 14;
const MAX_LINE_LENGTH = 96;

type PdfTextLine = { kind?: "text"; text: string; size?: number; gapBefore?: number };
type PdfRuleLine = { kind: "rule"; gapBefore?: number };
type PdfLine = PdfTextLine | PdfRuleLine;

function toPdfSafeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value: string) {
  return toPdfSafeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function truncateLine(value: string, maxLength = MAX_LINE_LENGTH) {
  const text = toPdfSafeText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function buildTimestampLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function addRunLines(lines: PdfTextLine[], run: PoscosechaClasificacionModeResult) {
  lines.push({ text: `ORIGEN: ${run.label}`, size: 13, gapBefore: 10 });
  lines.push({ text: run.originScope, size: 9 });
  lines.push({ text: `Prevalidacion: ${run.precheck.message}`, size: 9 });
  lines.push({
    text: `Holgura: ${formatInteger(run.precheck.diferencia)} | Pedidos: ${formatInteger(run.precheck.tallosPedidos)} | Disponibles: ${formatInteger(run.precheck.tallosDisponibles)}`,
    size: 9,
  });

  if (!run.result) {
    lines.push({ text: "Sin resultado resuelto para este origen.", size: 10, gapBefore: 6 });
    return;
  }

  const result = run.result;
  lines.push({
    text: `Resumen: pedido ${formatInteger(result.stage1Summary.pedido_bunches_total ?? 0)} | resuelto ${formatInteger(result.stage1Summary.pedido_bunches_resuelto ?? 0)} | no realizado ${formatInteger(result.stage1Summary.ajuste_bunches_total ?? 0)}`,
    size: 9,
    gapBefore: 6,
  });
  lines.push({
    text: `Peso real total ${formatDecimal(result.stage2Summary.peso_real_total ?? 0)} | Sobrepeso macro ${formatPercent(result.stage2Summary.sobrepeso_pct_macro ?? 0, { input: "ratio" })} | Status ${String(result.solverMeta.status ?? "n/a")}`,
    size: 9,
  });

  lines.push({ text: "Prioridad de cumplimiento", size: 11, gapBefore: 8 });
  lines.push({ text: "Prioridad | Fecha | Pedido | Resuelto | No realizado | Cumplimiento", size: 8 });
  for (const row of result.priorityRows) {
    lines.push({
      text: `${formatInteger(row.prioridad)} | ${row.fecha} | ${formatInteger(row.pedido)} | ${formatInteger(row.resuelto)} | ${formatInteger(row.noRealizado)} | ${formatPercent(row.cumplimiento, { input: "ratio" })}`,
      size: 8,
    });
  }

  lines.push({ text: "Orden de trabajo por SKU", size: 11, gapBefore: 8 });
  lines.push({ text: "SKU | Estado | Pedido | Resuelto | Cumplimiento | Peso bunch | Sobrepeso", size: 8 });
  for (const row of result.orderRows) {
    lines.push({
      text: `${row.sku} | ${row.estadoPeso} | ${formatInteger(row.pedidoTotal)} | ${formatInteger(row.pedidoResuelto)} | ${formatPercent(row.cumplimientoBunches, { input: "ratio" })} | ${formatDecimal(row.pesoRealBunch)} | ${formatPercent(row.sobrepesoPct, { input: "ratio" })}`,
      size: 8,
    });
  }
}

function buildPdfLines(runs: PoscosechaClasificacionModeResult[]) {
  const generatedAt = new Date();
  const dateStr = generatedAt.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = generatedAt.toLocaleTimeString("es-EC");
  const runLines: PdfTextLine[] = [];

  for (const run of runs) {
    addRunLines(runLines, run);
  }

  const lines: PdfLine[] = [
    { text: "ORDEN DE TRABAJO | CLASIFICACION EN BLANCO", size: 15 },
    { kind: "rule", gapBefore: 6 },
    { text: "Area: CLASIFICACION", size: 9 },
    { text: "Autor: EQUIPO DE PLANIFICACION & PROYECTOS", size: 9 },
    { text: `Fecha de exportacion: ${dateStr} ${timeStr}`, size: 9 },
    { text: `Codigo: OT-CLAS-${buildTimestampLabel(generatedAt).slice(0, 8)}`, size: 9 },
    { kind: "rule", gapBefore: 4 },
    { text: "Incluye todas las corridas disponibles del solver por origen.", size: 9, gapBefore: 4 },
    ...runLines,
  ];

  return lines;
}

function paginateLines(lines: PdfLine[]) {
  const pages: PdfLine[][] = [[]];
  let y = TOP_Y;

  for (const line of lines) {
    const gap = line.gapBefore ?? 0;
    const lineH = line.kind === "rule" ? LINE_HEIGHT / 2 : LINE_HEIGHT;
    const needed = lineH + gap;

    if (y - needed < BOTTOM_Y) {
      pages.push([]);
      y = TOP_Y;
    }

    pages[pages.length - 1]!.push(line);
    y -= needed;
  }

  return pages;
}

function buildPageContent(page: PdfLine[], pageNumber: number, totalPages: number) {
  let y = TOP_Y;
  const parts: string[] = [];

  for (const line of page) {
    y -= line.gapBefore ?? 0;

    if (line.kind === "rule") {
      parts.push(`q 0.5 w ${MARGIN_X} ${y} m ${PAGE_WIDTH - MARGIN_X} ${y} l S Q`);
      y -= LINE_HEIGHT / 2;
    } else {
      const size = line.size ?? 9;
      parts.push(`BT /F1 ${size} Tf 1 0 0 1 ${MARGIN_X} ${y} Tm (${escapePdfString(truncateLine(line.text))}) Tj ET`);
      y -= LINE_HEIGHT;
    }
  }

  parts.push(`BT /F1 8 Tf 1 0 0 1 ${MARGIN_X} 28 Tm (${escapePdfString(`Pagina ${pageNumber} de ${totalPages}`)}) Tj ET`);

  return parts.join("\n");
}

function buildPdfDocument(lines: PdfLine[]) {
  const pages = paginateLines(lines);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];

  pages.forEach((page, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = buildPageContent(page, index + 1, pages.length);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function downloadPdf(pdf: string) {
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orden_trabajo_clasificacion_en_blanco_${buildTimestampLabel()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SolverExportPdfButton({
  runs,
}: {
  runs: PoscosechaClasificacionModeResult[];
}) {
  function handleExport() {
    const printableRuns = runs.filter((run) => run.result !== null || run.precheck.message);
    const pdf = buildPdfDocument(buildPdfLines(printableRuns));
    downloadPdf(pdf);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport}>
      <FileDown className="size-4" />
      Exportar PDF
    </Button>
  );
}
