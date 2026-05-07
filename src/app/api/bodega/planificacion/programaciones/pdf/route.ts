import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import {
  buildDrenchProductBlockRows,
  listDrenchWeekCalendar,
  listDrenchWeekCalendarOptions,
  type DrenchWeekCalendarFilters,
} from "@/lib/drench-week-calendar";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
} from "@pdf-canon/scripts/generate_pdf_service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfViewMode = "by-block" | "by-product-block";

type PdfRequestBody = {
  filters?: Partial<DrenchWeekCalendarFilters>;
  selectedGroupKey?: string;
  viewMode?: PdfViewMode;
};

function normalizeFilters(
  filters: Partial<DrenchWeekCalendarFilters> | undefined,
  defaultIsoWeekId: string,
): DrenchWeekCalendarFilters {
  return {
    isoWeekId: String(filters?.isoWeekId ?? defaultIsoWeekId).trim(),
    cycleType: String(filters?.cycleType ?? "").trim().toUpperCase(),
    variety: String(filters?.variety ?? "").trim().toUpperCase(),
    areaId: String(filters?.areaId ?? "").trim().toUpperCase(),
  };
}

function buildBlockRowsPayload(rows: Awaited<ReturnType<typeof listDrenchWeekCalendar>>) {
  return rows.map((row) => ({
    cycleKey: row.cycleKey,
    blockId: row.blockId,
    isoWeekId: row.isoWeekId,
    phenologicalWeek: `${row.phenologicalWeek} · ${row.recipeRuleCode}`,
    bedCount: row.bedCount === null ? "-" : row.bedCount.toFixed(2),
    recipeLines: row.recipeLines.length
      ? row.recipeLines
          .map((line) => {
            const qty =
              line.productQuantityTotal === null
                ? "-"
                : line.productQuantityTotal.toFixed(2);
            const unit = line.unitCode ?? "";
            return `${line.productCode ?? "-"} ${line.productName ?? "Sin producto"} · ${qty} ${unit}`.trim();
          })
      : ["Sin receta homologada"],
  }));
}

/** Escapa caracteres especiales de LaTeX */
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

function buildDataTex(
  rows: Awaited<ReturnType<typeof listDrenchWeekCalendar>>,
  viewMode: PdfViewMode,
  filters: DrenchWeekCalendarFilters,
  selectedGroupKey: string | undefined,
  exportDate: Date,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${exportDate.getFullYear()}-${pad(exportDate.getMonth() + 1)}-${pad(exportDate.getDate())}`;
  const docCode = `BOD-DRENCH-${filters.isoWeekId}`;
  const weekLabel = `Semana ${tex(filters.isoWeekId)}`;
  const subtitleSnippet =
    selectedGroupKey && rows.length > 0
      ? `\\NoteInline{Filtro:} ${tex(rows[0]?.drenchGroupLabel ?? selectedGroupKey)}\n\n`
      : "";

  if (viewMode === "by-product-block") {
    const summaryMap = buildDrenchProductBlockRows(rows).reduce<
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
    const summary = Object.values(summaryMap);
    const detail = buildDrenchProductBlockRows(rows);

    const summaryRows =
      summary.length > 0
        ? summary
            .map(
              (r) =>
                `  ${tex(r.productCode)} & ${tex(r.productName)} & ${r.blocks} & ${tex(`${r.quantity.toFixed(2)} ${r.unitCode ?? ""}`.trim())} \\\\`,
            )
            .join("\n")
        : "  \\multicolumn{4}{c}{\\textit{Sin datos.}} \\\\";

    const detailRows =
      detail.length > 0
        ? detail
            .map(
              (r) =>
                `  ${tex(r.productCode)} & ${tex(r.productName)} & ${tex(r.blockId)} & ${tex(`${r.quantityTotal.toFixed(2)} ${r.unitCode ?? ""}`.trim())} \\\\`,
            )
            .join("\n")
        : "  \\multicolumn{4}{c}{\\textit{Sin datos.}} \\\\";

    return `\\SetDocCode{${tex(docCode)}}
\\SetDocDate{${dateStr}}
\\SetDocTitle{Resumen Drench Bodega -- ${weekLabel}}

\\newcommand{\\DrenchBody}{%
  \\section*{Resumen Drench Bodega -- ${weekLabel}}
  ${subtitleSnippet}
  \\subsection*{Resumen general por producto}
  \\begin{adjustbox}{max width=\\linewidth}
  \\begin{tabular}{@{} l p{8cm} r r @{}}
    \\toprule
    \\textbf{C\\'odigo} & \\textbf{Producto} & \\textbf{Bloques} & \\textbf{Cantidad} \\\\
    \\midrule
${summaryRows}
    \\bottomrule
  \\end{tabular}
  \\end{adjustbox}

  \\vspace{5mm}
  \\subsection*{Detalle por producto y bloque}
  \\begin{adjustbox}{max width=\\linewidth}
  \\begin{tabular}{@{} l p{8cm} l r @{}}
    \\toprule
    \\textbf{C\\'odigo} & \\textbf{Producto} & \\textbf{Bloque} & \\textbf{Cantidad} \\\\
    \\midrule
${detailRows}
    \\bottomrule
  \\end{tabular}
  \\end{adjustbox}
}
`;
  }

  // by-block (default)
  const blockRows = buildBlockRowsPayload(rows);
  const tableRows =
    blockRows.length > 0
      ? blockRows
          .map((r) => {
            const recipe = r.recipeLines.map((line) => tex(line)).join("\\newline ");
            return `  ${tex(r.cycleKey)} & ${tex(r.blockId)} & ${tex(r.isoWeekId)} & ${tex(r.phenologicalWeek)} & ${tex(r.bedCount)} & ${recipe} \\\\`;
          })
          .join("\n")
      : "  \\multicolumn{6}{c}{\\textit{Sin datos para los filtros seleccionados.}} \\\\";

  return `\\SetDocCode{${tex(docCode)}}
\\SetDocDate{${dateStr}}
\\SetDocTitle{Programaci\\'on Drench por Bloque -- ${weekLabel}}

\\newcommand{\\DrenchBody}{%
  \\section*{Programaci\\'on Drench por Bloque -- ${weekLabel}}
  ${subtitleSnippet}
  \\small
  \\setlength{\\LTleft}{0pt}
  \\setlength{\\LTright}{0pt}
  \\begin{longtable}{@{} p{2.9cm} p{1.25cm} p{1.1cm} p{2.25cm} p{1.25cm} p{7.2cm} @{}}
    \\caption{Programaci\\'on semanal por bloque} \\\\
    \\toprule
    \\textbf{Cycle ID} & \\textbf{Bloque} & \\textbf{Sem.~ISO} & \\textbf{Cat.~Fenol\\'ogica} & \\textbf{Camas 30m\\textsuperscript{2}} & \\textbf{Receta por bloque} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Cycle ID} & \\textbf{Bloque} & \\textbf{Sem.~ISO} & \\textbf{Cat.~Fenol\\'ogica} & \\textbf{Camas 30m\\textsuperscript{2}} & \\textbf{Receta por bloque} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{6}{r}{\\small\\itshape Contin\\'ua\\ldots} \\\\
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
    const options = await listDrenchWeekCalendarOptions();
    const filters = normalizeFilters(body.filters, options.defaultIsoWeekId);
    const allRows = await listDrenchWeekCalendar(filters);
    const rows = body.selectedGroupKey
      ? allRows.filter((row) => row.drenchGroupKey === body.selectedGroupKey)
      : allRows;
    const viewMode: PdfViewMode =
      body.viewMode === "by-product-block" ? "by-product-block" : "by-block";
    const exportDate = new Date();

    const dataTexContent = buildDataTex(
      rows,
      viewMode,
      filters,
      body.selectedGroupKey,
      exportDate,
    );

    const { pdf } = await generateCanonicalPdf({
      templateName: "bodega_programacion_drench",
      dataTexContent,
      jobId: crypto.randomUUID(),
      passes: 2,
    });

    const filename = `${
      viewMode === "by-product-block"
        ? "resumen_drench_bodega"
        : "programacion_drench_bloque"
    }_${filters.isoWeekId}.pdf`;
    return pdfBufferToResponse(pdf, filename);
  } catch (error) {
    if (error instanceof PdfCompileError) {
      logEvent("error", "pdf.drench.latex_compile_error", {
        requestId: getRequestId(request),
        buildLogTail: error.buildLog.slice(-1500),
        jobId: error.jobId,
      });
      return Response.json(
        { message: "Error al compilar el PDF de drench." },
        { status: 500 },
      );
    }
    return handleApiError(
      error,
      "No se pudo generar el PDF de programación semanal de drench.",
    );
  }
}
