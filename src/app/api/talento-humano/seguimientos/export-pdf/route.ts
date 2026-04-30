import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
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
  AGR: "Agr\\'icola",
  ADM: "Administrativo",
};

function buildDataTex(rows: Awaited<ReturnType<typeof loadScheduledFollowups>>, exportDate: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const docCode = `TTHH-AGE-${exportDate.getFullYear()}${pad(exportDate.getMonth() + 1)}${pad(exportDate.getDate())}`;
  const docDate = `${exportDate.getFullYear()}-${pad(exportDate.getMonth() + 1)}-${pad(exportDate.getDate())}`;

  const tableRows = rows.map((row) => {
    const nombre = tex(row.personName);
    const area = tex(row.areaName ?? row.areaGeneral ?? "—");
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
  \\begin{longtable}{@{} p{5.2cm} p{3.8cm} l l l @{}}
    \\caption{Agenda de seguimientos programados} \\\\
    \\toprule
    \\textbf{Nombre} & \\textbf{\\'Area} & \\textbf{Fecha} & \\textbf{Clasif.} & \\textbf{Estado} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Nombre} & \\textbf{\\'Area} & \\textbf{Fecha} & \\textbf{Clasif.} & \\textbf{Estado} \\\\
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
      return Response.json({ message: "Filtros inválidos." }, { status: 400 });
    }

    const rows = await loadScheduledFollowups(parsed.data as EmployeeFollowupFilters);
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
      console.error("[export-pdf/tthh] LaTeX error:", error.buildLog.slice(-1200));
      return Response.json({ message: "Error al compilar el PDF." }, { status: 500 });
    }
    return handleApiError(error, "No se pudo exportar la agenda.");
  }
}
