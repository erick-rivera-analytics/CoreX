import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";
import { loadScheduledFollowups } from "@/lib/talento-humano-seguimientos-schedule";
import { followupFiltersSchema } from "@/lib/talento-humano-seguimientos-schemas";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
} from "@pdf-canon/scripts/generate_pdf_service";
import type { EmployeeFollowupFilters } from "@/modules/talento-humano/seguimientos/server/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FollowupExportSortKey = "areaId" | "personName" | "followUpDate" | "derivedRoute" | "status";
type FollowupExportSortRule = { key: FollowupExportSortKey; direction: "asc" | "desc" };

const SORT_KEYS = new Set<FollowupExportSortKey>(["areaId", "personName", "followUpDate", "derivedRoute", "status"]);
const collator = new Intl.Collator("es-EC", { numeric: true, sensitivity: "base" });

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

function formatFollowupDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  registered: "Realizado",
};

const ROUTE_LABEL: Record<string, string> = {
  AGR: "AGR",
  ADM: "ADM",
};

function titleCaseName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-EC")
    .replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase("es-EC") + word.slice(1));
}

function parseSortRules(searchParams: URLSearchParams): FollowupExportSortRule[] {
  return searchParams
    .getAll("sort")
    .flatMap((raw) => raw.split(","))
    .map((raw) => raw.trim())
    .filter(Boolean)
    .flatMap((raw) => {
      const [key, rawDirection] = raw.split(":").map((part) => part.trim());
      const direction = rawDirection === "desc" ? "desc" : "asc";
      return SORT_KEYS.has(key as FollowupExportSortKey)
        ? [{ key: key as FollowupExportSortKey, direction }]
        : [];
    });
}

function sortRows(
  rows: Awaited<ReturnType<typeof loadScheduledFollowups>>,
  sortRules: FollowupExportSortRule[],
): Awaited<ReturnType<typeof loadScheduledFollowups>> {
  if (sortRules.length === 0) return rows;
  return [...rows].sort((left, right) => {
    for (const rule of sortRules) {
      const direction = rule.direction === "asc" ? 1 : -1;
      const leftValue = rule.key === "personName" ? titleCaseName(left.personName) : String(left[rule.key] ?? "");
      const rightValue = rule.key === "personName" ? titleCaseName(right.personName) : String(right[rule.key] ?? "");
      const result = collator.compare(leftValue, rightValue);
      if (result !== 0) return result * direction;
    }
    return collator.compare(left.personName, right.personName);
  });
}

function buildDataTex(rows: Awaited<ReturnType<typeof loadScheduledFollowups>>, exportDate: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const docCode = `TTHH-AGE-${exportDate.getFullYear()}${pad(exportDate.getMonth() + 1)}${pad(exportDate.getDate())}`;
  const docDate = `${exportDate.getFullYear()}-${pad(exportDate.getMonth() + 1)}-${pad(exportDate.getDate())}`;

  const tableRows = rows.map((row) => {
    const nombre = tex(titleCaseName(row.personName));
    const area = tex(row.areaId ?? "-");
    const fecha = tex(formatFollowupDate(row.followUpDate));
    const clasif = ROUTE_LABEL[row.derivedRoute] ?? tex(row.derivedRoute);
    const estado = tex(STATUS_LABEL[row.status] ?? row.status);
    return `  ${nombre} & ${area} & ${fecha} & ${clasif} & ${estado} \\\\`;
  }).join("\n");

  const emptyRow = rows.length === 0
    ? `  \\multicolumn{5}{c}{\\textit{Sin seguimientos con los filtros aplicados.}} \\\\`
    : "";

  return `\\SetDocCode{${tex(docCode)}}
\\SetDocDate{${tex(docDate)}}

\\newcommand{\\AgendaBody}{%
  \\section*{Agenda de Seguimientos -- Trabajo Social}

  \\begin{center}
  \\begin{longtable}{@{} p{6.1cm} p{2.4cm} l l l @{}}
    \\caption{Agenda de seguimientos programados} \\\\
    \\toprule
    \\textbf{Nombre} & \\textbf{Cod. \\'Area} & \\textbf{Fecha} & \\textbf{Clasif.} & \\textbf{Estado} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Nombre} & \\textbf{Cod. \\'Area} & \\textbf{Fecha} & \\textbf{Clasif.} & \\textbf{Estado} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{5}{r}{\\small\\itshape Contin\\'ua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${tableRows}${emptyRow}
  \\end{longtable}
  \\end{center}

  \\NoteInline{Total:} ${rows.length} seguimiento(s) exportados.
}
`;
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const sp = request.nextUrl.searchParams;
    const asOfDate = sp.get("asOfDate")?.trim() || new Date().toISOString().slice(0, 10);

    const parsed = followupFiltersSchema.safeParse({
      asOfDate,
      personSearch: sp.get("q")?.trim() || undefined,
      associatedWorker: sp.get("associatedWorker")?.trim() || undefined,
      area: sp.get("area")?.trim() || undefined,
      route: sp.get("route")?.trim() || undefined,
      status: sp.get("status")?.trim() || undefined,
      year: sp.get("year")?.trim() || undefined,
      month: sp.get("month")?.trim() || undefined,
      dateFrom: sp.get("dateFrom")?.trim() || undefined,
      dateTo: sp.get("dateTo")?.trim() || undefined,
    });

    if (!parsed.success) {
      return Response.json({ message: "Filtros invalidos." }, { status: 400 });
    }

    const rows = sortRows(
      await loadScheduledFollowups(parsed.data as EmployeeFollowupFilters),
      parseSortRules(sp),
    );
    const exportDate = new Date();
    const dataTexContent = buildDataTex(rows, exportDate);

    const { pdf } = await generateCanonicalPdf({
      templateName: "tthh_agenda_seguimientos",
      dataTexContent,
      jobId: crypto.randomUUID(),
      passes: 2,
    });

    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${exportDate.getFullYear()}${pad(exportDate.getMonth() + 1)}${pad(exportDate.getDate())}`;
    return pdfBufferToResponse(pdf, `agenda_seguimientos_${stamp}.pdf`);
  } catch (error) {
    if (error instanceof PdfCompileError) {
      logEvent("error", "pdf.tthh_seguimientos.latex_compile_error", {
        requestId: getRequestId(request),
        buildLogTail: error.buildLog.slice(-1200),
        jobId: error.jobId,
      });
      return Response.json({ message: "Error al compilar el PDF." }, { status: 500 });
    }
    return handleApiError(error, "No se pudo exportar la agenda.");
  }
}

