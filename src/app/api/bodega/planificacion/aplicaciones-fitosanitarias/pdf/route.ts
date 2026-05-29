import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  listFumigationWeekProgram,
  listFumigationWeekProgramOptions,
  type FumigationWeekProgramFilters,
  type FumigationWeekProgramRow,
} from "@/lib/fumigation-week-program";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
} from "@pdf-canon/scripts/generate_pdf_service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfViewMode = "by-block" | "by-product-block";

type PdfRequestBody = {
  filters?: Partial<FumigationWeekProgramFilters>;
  viewMode?: PdfViewMode;
};

type ProductBlockRow = {
  key: string;
  productCode: string;
  productName: string;
  unitCode: string | null;
  blockId: string;
  quantityTotal: number;
  methodLabel: string;
  applicationNumber: number;
};

function normalizeFilters(
  filters: Partial<FumigationWeekProgramFilters> | undefined,
  defaultIsoWeekId: string,
): FumigationWeekProgramFilters {
  const kind = String(filters?.kind ?? "").trim().toUpperCase();
  return {
    isoWeekId: String(filters?.isoWeekId ?? defaultIsoWeekId).trim(),
    kind: (kind === "REGULAR" || kind === "DRON" || kind === "LANZAS" ? kind : "") as FumigationWeekProgramFilters["kind"],
    variety: String(filters?.variety ?? "").trim().toUpperCase(),
    areaId: String(filters?.areaId ?? "").trim().toUpperCase(),
  };
}

function kindLabel(value: FumigationWeekProgramFilters["kind"] | FumigationWeekProgramRow["fumigationKind"]) {
  if (value === "REGULAR") return "Normal";
  if (value === "DRON") return "Dron";
  if (value === "LANZAS") return "Lanzas eficientes";
  return "Todos";
}

function tex(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function buildRecipeLines(row: FumigationWeekProgramRow) {
  if (!row.recipeResolved || !row.applications.length) {
    return ["Sin receta homologada"];
  }

  return row.applications.flatMap((application) => {
    if (!application.lines.length) {
      return [`Ap ${application.applicationNumber}: Sin receta`];
    }

    return application.lines.map((line) => {
      const qty = line.quantityTotal === null || Number.isNaN(line.quantityTotal)
        ? "-"
        : line.quantityTotal.toFixed(2);
      const unit = line.unitCode ?? "";
      return `Ap ${application.applicationNumber} - ${line.productCode ?? "-"} ${line.productName} - ${qty} ${unit}`.trim();
    });
  });
}

function buildProductBlockRows(rows: FumigationWeekProgramRow[]): ProductBlockRow[] {
  const grouped = new Map<string, ProductBlockRow>();

  for (const row of rows) {
    for (const application of row.applications) {
      for (const line of application.lines) {
        if (!line.productCode || !line.productName) continue;
        if (line.quantityTotal === null || Number.isNaN(line.quantityTotal)) continue;

        const key = [
          line.productCode,
          application.applicationNumber,
          row.blockId,
          line.unitCode ?? "",
          row.fumigationKind,
        ].join("|");

        const current = grouped.get(key) ?? {
          key,
          productCode: line.productCode,
          productName: line.productName,
          unitCode: line.unitCode ?? null,
          blockId: row.blockId,
          quantityTotal: 0,
          methodLabel: kindLabel(row.fumigationKind),
          applicationNumber: application.applicationNumber,
        };

        current.quantityTotal += line.quantityTotal;
        grouped.set(key, current);
      }
    }
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const appCompare = left.applicationNumber - right.applicationNumber;
    if (appCompare !== 0) return appCompare;
    const codeCompare = left.productCode.localeCompare(right.productCode, "es");
    if (codeCompare !== 0) return codeCompare;
    return left.blockId.localeCompare(right.blockId, "es", { numeric: true });
  });
}

function buildDataTex(
  rows: FumigationWeekProgramRow[],
  viewMode: PdfViewMode,
  filters: FumigationWeekProgramFilters,
  exportDate: Date,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${exportDate.getFullYear()}-${pad(exportDate.getMonth() + 1)}-${pad(exportDate.getDate())}`;
  const docCode = `BOD-FUM-${filters.isoWeekId}`;
  const weekLabel = `Semana ${tex(filters.isoWeekId)}`;
  const subtitleSnippet = `\\NoteInline{Metodo:} ${tex(kindLabel(filters.kind))}\n\n`;

  if (viewMode === "by-product-block") {
    const detail = buildProductBlockRows(rows);
    const summaryMap = detail.reduce<
      Record<
        string,
        {
          productCode: string;
          productName: string;
          blocks: number;
          quantity: number;
          unitCode: string | null;
        }
      >
    >((acc, row) => {
      const key = `${row.productCode}|${row.unitCode ?? ""}`;
      const current = acc[key] ?? {
        productCode: row.productCode,
        productName: row.productName,
        blocks: 0,
        quantity: 0,
        unitCode: row.unitCode ?? null,
      };
      current.blocks += 1;
      current.quantity += row.quantityTotal;
      acc[key] = current;
      return acc;
    }, {});

    const summaryRows =
      Object.values(summaryMap).length > 0
        ? Object.values(summaryMap)
            .map(
              (row) =>
                `  ${tex(row.productCode)} & ${tex(row.productName)} & ${row.blocks} & ${tex(`${row.quantity.toFixed(2)} ${row.unitCode ?? ""}`.trim())} \\\\`,
            )
            .join("\n")
        : "  \\multicolumn{4}{c}{\\textit{Sin datos.}} \\\\";

    const detailRows =
      detail.length > 0
        ? (() => {
            let previousApplication = -1;
            return detail.map((row) => {
              const pieces: string[] = [];
              if (row.applicationNumber !== previousApplication) {
                if (previousApplication !== -1) {
                  pieces.push("  \\addlinespace[2mm]");
                }
                pieces.push(
                  `  \\multicolumn{5}{@{}l}{\\textbf{Aplicacion ${row.applicationNumber} - ${tex(row.methodLabel)}}} \\\\`,
                );
                pieces.push("  \\addlinespace[1mm]");
                previousApplication = row.applicationNumber;
              }
              pieces.push(
                `  ${tex(row.productCode)} & ${tex(row.productName)} & ${tex(`Ap ${row.applicationNumber}`)} & ${tex(row.blockId)} & ${tex(`${row.quantityTotal.toFixed(2)} ${row.unitCode ?? ""}`.trim())} \\\\`,
              );
              return pieces.join("\n");
            }).join("\n");
          })()
        : "  \\multicolumn{5}{c}{\\textit{Sin datos.}} \\\\";

    return `\\SetDocCode{${tex(docCode)}}
\\SetDocDate{${dateStr}}
\\SetDocTitle{Resumen fitosanitario Bodega -- ${weekLabel}}

\\newcommand{\\DrenchBody}{%
  \\section*{Resumen fitosanitario Bodega -- ${weekLabel}}
  ${subtitleSnippet}
  \\small
  \\setlength{\\LTleft}{0pt}
  \\setlength{\\LTright}{0pt}

  \\subsection*{Resumen general por producto}
  \\begin{longtable}{@{} p{2.1cm} p{8.8cm} p{1.6cm} p{2.2cm} @{}}
    \\toprule
    \\textbf{Codigo} & \\textbf{Producto} & \\textbf{Bloques} & \\textbf{Cantidad} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Codigo} & \\textbf{Producto} & \\textbf{Bloques} & \\textbf{Cantidad} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{4}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${summaryRows}
  \\end{longtable}

  \\vspace{4mm}
  \\subsection*{Detalle por producto y bloque}
  \\begin{longtable}{@{} p{1.9cm} p{7.2cm} p{3.2cm} p{1.5cm} p{2.3cm} @{}}
    \\toprule
    \\textbf{Codigo} & \\textbf{Producto} & \\textbf{Aplicacion} & \\textbf{Bloque} & \\textbf{Cantidad} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Codigo} & \\textbf{Producto} & \\textbf{Aplicacion} & \\textbf{Bloque} & \\textbf{Cantidad} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{5}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${detailRows}
  \\end{longtable}
}
`;
  }

  const sortedRows = [...rows].sort((left, right) => {
    const methodCompare = kindLabel(left.fumigationKind).localeCompare(kindLabel(right.fumigationKind), "es");
    if (methodCompare !== 0) return methodCompare;
    const phenologicalCompare = left.phenologicalWeek - right.phenologicalWeek;
    if (phenologicalCompare !== 0) return phenologicalCompare;
    return left.blockId.localeCompare(right.blockId, "es", { numeric: true });
  });

  const tableRows =
    sortedRows.length > 0
      ? sortedRows
          .map((row) => {
            const recipe = buildRecipeLines(row).map((line) => tex(line)).join("\\newline ");
            const phenological = `${row.phenologicalWeek}`;
            const beds = row.bedCount === null ? "-" : row.bedCount.toFixed(2);
            const liters = row.litersTotal === null ? "-" : `${row.litersTotal.toFixed(2)} L`;
            const bedAndLiters = `${beds} camas / ${liters}`;
            return `  ${tex(row.blockId)} & ${tex(row.variety)} & ${tex(phenological)} & ${tex(kindLabel(row.fumigationKind))} & ${tex(bedAndLiters)} & ${recipe} \\\\`;
          })
          .join("\n")
      : "  \\multicolumn{6}{c}{\\textit{Sin datos para los filtros seleccionados.}} \\\\";

  return `\\SetDocCode{${tex(docCode)}}
\\SetDocDate{${dateStr}}
\\SetDocTitle{Aplicaciones fitosanitarias por bloque -- ${weekLabel}}

\\newcommand{\\DrenchBody}{%
  \\section*{Aplicaciones fitosanitarias por bloque -- ${weekLabel}}
  ${subtitleSnippet}
  \\small
  \\setlength{\\LTleft}{0pt}
  \\setlength{\\LTright}{0pt}
  \\begin{longtable}{@{} p{1.35cm} p{1.7cm} p{1.2cm} p{2.1cm} p{2.45cm} p{13.3cm} @{}}
    \\caption{Despacho semanal por bloque} \\\\
    \\toprule
    \\textbf{Bloque} & \\textbf{Variedad} & \\textbf{Sem. fenol.} & \\textbf{Metodo} & \\textbf{Camas / litros} & \\textbf{Receta por bloque} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Bloque} & \\textbf{Variedad} & \\textbf{Sem. fenol.} & \\textbf{Metodo} & \\textbf{Camas / litros} & \\textbf{Receta por bloque} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{6}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${tableRows}
  \\end{longtable}
}
`;
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PdfRequestBody;
    const options = await listFumigationWeekProgramOptions();
    const filters = normalizeFilters(body.filters, options.defaultIsoWeekId);
    const rows = await listFumigationWeekProgram(filters);
    const viewMode: PdfViewMode =
      body.viewMode === "by-product-block" ? "by-product-block" : "by-block";
    const exportDate = new Date();

    const dataTexContent = buildDataTex(rows, viewMode, filters, exportDate);

    const { pdf } = await generateCanonicalPdf({
      templateName: "bodega_programacion_drench",
      dataTexContent,
      jobId: crypto.randomUUID(),
      passes: 2,
    });

    const filename = `${
      viewMode === "by-product-block"
        ? "resumen_fitosanitario_bodega"
        : "aplicaciones_fitosanitarias_bloque"
    }_${filters.isoWeekId}.pdf`;
    return pdfBufferToResponse(pdf, filename);
  } catch (error) {
    if (error instanceof PdfCompileError) {
      logEvent("error", "pdf.fumigation.latex_compile_error", {
        requestId: getRequestId(request),
        buildLogTail: error.buildLog.slice(-1500),
        jobId: error.jobId,
      });
      return Response.json(
        { message: "Error al compilar el PDF de aplicaciones fitosanitarias." },
        { status: 500 },
      );
    }
    return handleApiError(
      error,
      "No se pudo generar el PDF de aplicaciones fitosanitarias.",
    );
  }
}
