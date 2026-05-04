import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  getPuntoAperturaDashboardData,
  normalizePuntoAperturaFilters,
  type PuntoAperturaFilters,
  type PuntoAperturaRecord,
} from "@/lib/calidad-punto-apertura";
import {
  generateCanonicalPdf,
  pdfBufferToResponse,
  PdfCompileError,
} from "@pdf-canon/scripts/generate_pdf_service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfRequestBody = {
  filters?: Partial<PuntoAperturaFilters>;
};

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

function pct(value: number) {
  return `${value.toFixed(2)}\\%`;
}

function buildDominantSummary(records: PuntoAperturaRecord[]) {
  const order = ["Boton", "1 a 3", "4 a 9", "10 a 20", "Mas de 20"] as const;
  const counts = new Map<string, number>();

  for (const record of records) {
    counts.set(record.dominanteClase, (counts.get(record.dominanteClase) ?? 0) + 1);
  }

  return order.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    pct: records.length ? ((counts.get(label) ?? 0) / records.length) * 100 : 0,
  }));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function dominantSortOrder(label: string) {
  return ["Boton", "1 a 3", "4 a 9", "10 a 20", "Mas de 20"].indexOf(label);
}

function buildClassShareSummary(records: PuntoAperturaRecord[]) {
  const grouped = new Map<
    string,
    {
      shares: number[];
      tallos: number[];
    }
  >();

  for (const record of records) {
    const bucket = grouped.get(record.dominanteClase) ?? { shares: [], tallos: [] };
    bucket.shares.push(record.dominantePct);
    if (record.tallosMalla !== null) bucket.tallos.push(record.tallosMalla);
    grouped.set(record.dominanteClase, bucket);
  }

  return Array.from(grouped.entries())
      .map(([label, bucket]) => ({
      label,
      records: bucket.shares.length,
      meanPct: average(bucket.shares),
      sdPct: sampleStdDev(bucket.shares),
      medianPct: quantile(bucket.shares, 0.5),
      p25Pct: quantile(bucket.shares, 0.25),
      p75Pct: quantile(bucket.shares, 0.75),
      meanTallos: average(bucket.tallos),
    }))
    .sort((a, b) => dominantSortOrder(a.label) - dominantSortOrder(b.label));
}

function buildMonthlySummary(records: PuntoAperturaRecord[]) {
  const grouped = new Map<string, number[]>();

  for (const record of records) {
    const monthKey = record.fecha.slice(0, 7);
    const bucket = grouped.get(monthKey) ?? [];
    bucket.push(record.dominantePct);
    grouped.set(monthKey, bucket);
  }

  return Array.from(grouped.entries())
    .map(([month, shares]) => ({
      month,
      meanPct: average(shares),
      sdPct: sampleStdDev(shares),
      records: shares.length,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function buildExecutiveSummary(
  data: Awaited<ReturnType<typeof getPuntoAperturaDashboardData>>,
  classSummary: ReturnType<typeof buildClassShareSummary>,
) {
  const topClass = classSummary[0]?.label ?? data.summary.dominantClass;
  const topClassSummary =
    classSummary.find((item) => item.label === data.summary.dominantClass) ?? classSummary[0];
  const mostMixed = [...classSummary].sort((a, b) => b.sdPct - a.sdPct)[0];
  const ties = data.records.filter((record) => {
    const values = Object.values(record.apertura);
    const max = Math.max(...values);
    return values.filter((value) => value === max).length > 1;
  }).length;

  return [
    "Filtro aplicado: para cada ciclo se considera el tramo desde la primera fecha con señal real de apertura y se conservan los registros posteriores del mismo ciclo.",
    `Base analizada: ${data.summary.totalRecords} registros visibles, ${data.summary.totalCycles} ciclos y clase dominante general ${topClass}.`,
    topClassSummary
      ? `La clase dominante general ${topClassSummary.label} concentra una participación media de ${topClassSummary.meanPct.toFixed(2)}% con desviación estándar de ${topClassSummary.sdPct.toFixed(2)}%.`
      : `La clase dominante general del período fue ${data.summary.dominantClass}.`,
    mostMixed
      ? `La clase con mayor mezcla relativa es ${mostMixed.label}, con mediana de ${mostMixed.medianPct.toFixed(2)}% y rango intercuartílico entre ${mostMixed.p25Pct.toFixed(2)}% y ${mostMixed.p75Pct.toFixed(2)}%.`
      : "No se detectaron suficientes registros para medir dispersión por clase dominante.",
    `Empates entre clases dominantes: ${ties} registros (${data.summary.totalRecords > 0 ? ((ties / data.summary.totalRecords) * 100).toFixed(2) : "0.00"}% del total visible).`,
  ];
}

function buildMethodologyCritique(
  data: Awaited<ReturnType<typeof getPuntoAperturaDashboardData>>,
  classSummary: ReturnType<typeof buildClassShareSummary>,
) {
  const avgDominantShare = average(data.records.map((record) => record.dominantePct));
  const oneToThree = classSummary.find((item) => item.label === "1 a 3");
  const tenToTwenty = classSummary.find((item) => item.label === "10 a 20");

  return [
    "El enfoque de participación dominante es adecuado porque compara mallas con distinto número de tallos en una misma escala porcentual.",
    `A nivel global, el dominante representa en promedio ${avgDominantShare.toFixed(2)}% de cada malla visible.`,
    tenToTwenty && oneToThree
      ? `La diferencia entre clases es tangible: cuando domina 10 a 20 la media alcanza ${tenToTwenty.meanPct.toFixed(2)}%, mientras que en 1 a 3 baja a ${oneToThree.meanPct.toFixed(2)}%.`
      : "La dispersión por clase dominante debe seguirse con bandas específicas por categoría, no con una sola meta general.",
    "Para seguimiento gerencial conviene mantener media, mediana y rango intercuartílico, porque la acumulación de registros en 100% sesga la lectura de distribuciones.",
    "Siguiente paso sugerido: fijar bandas objetivo por clase dominante y luego medir desalineación por arriba y por abajo del rango esperado.",
  ];
}

function buildDataTex(
  data: Awaited<ReturnType<typeof getPuntoAperturaDashboardData>>,
  exportDate: Date,
) {
  const filters = data.filters;
  const summary = data.summary;
  const dominantSummary = buildDominantSummary(data.records);
  const classShareSummary = buildClassShareSummary(data.records);
  const monthlySummary = buildMonthlySummary(data.records);
  const executiveSummary = buildExecutiveSummary(data, classShareSummary);
  const methodologyCritique = buildMethodologyCritique(data, classShareSummary);

  const topCriticalRows = data.records
    .filter((record) => record.estado === "No homogeneo")
    .sort((a, b) => a.dominantePct - b.dominantePct)
    .slice(0, 20);

  const detailRows =
    topCriticalRows.length > 0
      ? topCriticalRows
          .map(
            (record) =>
              `  ${tex(record.fecha)} & ${tex(record.ciclo)} & ${tex(record.bloque)} & ${tex(record.dominanteClase)} & ${pct(record.dominantePct)} & ${tex(record.estado)} \\\\`,
          )
          .join("\n")
      : "  \\multicolumn{6}{c}{\\textit{Sin registros no homogéneos para el filtro actual.}} \\\\";

  const dominantRows =
    dominantSummary.length > 0
      ? dominantSummary
          .map(
            (row) =>
              `  ${tex(row.label)} & ${row.count} & ${pct(row.pct)} \\\\`,
          )
          .join("\n")
      : "  \\multicolumn{3}{c}{\\textit{Sin datos.}} \\\\";

  const classSummaryRows =
    classShareSummary.length > 0
      ? classShareSummary
          .map(
            (row) =>
              `  ${tex(row.label)} & ${row.records} & ${row.meanPct.toFixed(2)}\\% & ${row.sdPct.toFixed(2)}\\% & ${row.medianPct.toFixed(2)}\\% & ${row.p25Pct.toFixed(2)}\\% & ${row.p75Pct.toFixed(2)}\\% & ${row.meanTallos.toFixed(2)} \\\\`,
          )
          .join("\n")
      : "  \\multicolumn{8}{c}{\\textit{Sin datos.}} \\\\";

  const monthlyRows =
    monthlySummary.length > 0
      ? monthlySummary
          .map(
            (row) =>
              `  ${tex(row.month)} & ${row.meanPct.toFixed(2)}\\% & ${row.sdPct.toFixed(2)}\\% & ${row.records} \\\\`,
          )
          .join("\n")
      : "  \\multicolumn{4}{c}{\\textit{Sin datos.}} \\\\";

  const isoWeekLabel =
    filters.isoWeek !== "all" ? `Semana ${tex(filters.isoWeek)}` : "Todas las semanas";
  const filterTokens = [
    filters.area !== "all" ? `Area: ${filters.area}` : null,
    filters.spType !== "all" ? `Tipo SP: ${filters.spType}` : null,
    filters.year !== "all" ? `Año: ${filters.year}` : null,
    filters.month !== "all" ? `Mes: ${filters.month}` : null,
    filters.date ? `Día: ${filters.date}` : null,
    filters.dominantClass !== "all" ? `Dominante: ${filters.dominantClass}` : null,
    filters.bloque !== "all" ? `Bloque: ${filters.bloque}` : null,
  ].filter(Boolean);

  const dateStr = exportDate.toISOString().slice(0, 10);
  const filtersNote =
    filterTokens.length > 0
      ? `\\NoteInline{Filtros:} ${tex(filterTokens.join(" · "))}`
      : `\\NoteInline{Filtros:} Sin filtros adicionales`;

  return `\\SetDocCode{CAL-PA-${tex(filters.isoWeek !== "all" ? filters.isoWeek : "ALL")}}
\\SetDocDate{${dateStr}}
\\SetDocTitle{Reporte gerencial de punto de apertura}

\\newcommand{\\PuntoAperturaBody}{%
  \\section*{Reporte gerencial de punto de apertura}
  \\NoteInline{Cobertura:} ${isoWeekLabel}

  ${filtersNote}

  \\section*{Resumen ejecutivo}
  \\begin{ParrafoEjecutivo}
  El indicador consolida ${summary.totalRecords} registros visibles correspondientes a ${summary.totalCycles} ciclos, con media observada de ${pct(summary.visibleMeanPct)} y criterio operativo de homogeneidad fijado en ${pct(summary.lowerLimitPct)}.
  \\end{ParrafoEjecutivo}

  \\begin{itemize}
${executiveSummary.map((item) => `    \\item ${tex(item)}`).join("\n")}
  \\end{itemize}

  \\section*{Metodología}
  \\begin{ParrafoMetodologico}
  La exportación replica el criterio analítico histórico del módulo: para cada ciclo se identifica la primera fecha con apertura efectiva y desde ese punto se analiza la mezcla dominante por registro. Los filtros visibles en pantalla restringen el conjunto final antes de consolidar porcentajes, ciclos y tablas de resumen.
  \\end{ParrafoMetodologico}

  \\section*{Indicadores clave}
  \\begin{center}
  \\begin{tabular}{ccc}
    \\FichaKPI{Registros visibles}{${summary.totalRecords}}{${summary.totalCycles} ciclos} &
    \\FichaKPI{Homogéneos}{${pct(summary.homogeneousPct)}}{${summary.homogeneousRecords} registros} &
    \\FichaKPI{No homogéneos}{${pct(100 - summary.homogeneousPct)}}{${summary.nonHomogeneousRecords} registros} \\\\
  \\end{tabular}
  \\end{center}

  \\vspace{4mm}
  \\begin{center}
  \\begin{tabular}{ccc}
    \\FichaKPI{Clase dominante}{${tex(summary.dominantClass)}}{clase general visible} &
    \\FichaKPI{Media visible}{${pct(summary.visibleMeanPct)}}{desv. ${pct(summary.visibleSdPct)}} &
    \\FichaKPI{Umbral inferior}{${pct(summary.lowerLimitPct)}}{criterio de control} \\\\
  \\end{tabular}
  \\end{center}

  \\section*{Distribución por clase dominante}
  \\begin{table}[H]
    \\centering
    \\caption{Participación de la clase dominante sobre registros visibles}
    \\begin{tabular}{l r r}
      \\toprule
      \\textbf{Clase} & \\textbf{Registros} & \\textbf{Participación} \\\\
      \\midrule
${dominantRows}
      \\bottomrule
    \\end{tabular}
  \\end{table}

  \\section*{Resumen estadístico por clase dominante}
  \\begin{center}
  \\begin{longtable}{@{} l r r r r r r r @{}}
    \\caption{Participación dominante y tallos promedio por clase} \\\\
    \\toprule
    \\textbf{Clase} & \\textbf{Mallas} & \\textbf{Media} & \\textbf{SD} & \\textbf{Mediana} & \\textbf{P25} & \\textbf{P75} & \\textbf{Media tallos} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Clase} & \\textbf{Mallas} & \\textbf{Media} & \\textbf{SD} & \\textbf{Mediana} & \\textbf{P25} & \\textbf{P75} & \\textbf{Media tallos} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{8}{r}{\\small\\itshape Continúa\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${classSummaryRows}
  \\end{longtable}
  \\end{center}

  \\section*{Evolución temporal}
  \\begin{center}
  \\begin{longtable}{@{} l r r r @{}}
    \\caption{Media y dispersión mensual del porcentaje dominante} \\\\
    \\toprule
    \\textbf{Mes} & \\textbf{Media dominante} & \\textbf{SD dominante} & \\textbf{Registros} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Mes} & \\textbf{Media dominante} & \\textbf{SD dominante} & \\textbf{Registros} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{4}{r}{\\small\\itshape Continúa\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${monthlyRows}
  \\end{longtable}
  \\end{center}

  \\section*{Registros críticos}
  \\begin{center}
  \\begin{longtable}{@{} l p{4.3cm} p{1.7cm} p{2.2cm} r l @{}}
    \\caption{Registros no homogéneos con menor participación dominante} \\\\
    \\toprule
    \\textbf{Fecha} & \\textbf{Ciclo} & \\textbf{Bloque} & \\textbf{Clase} & \\textbf{Dominante} & \\textbf{Estado} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Fecha} & \\textbf{Ciclo} & \\textbf{Bloque} & \\textbf{Clase} & \\textbf{Dominante} & \\textbf{Estado} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{6}{r}{\\small\\itshape Continúa\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${detailRows}
  \\end{longtable}
  \\end{center}

  \\section*{Crítica metodológica}
  \\begin{itemize}
${methodologyCritique.map((item) => `    \\item ${tex(item)}`).join("\n")}
  \\end{itemize}

  \\begin{ObservationBox}[Nota metodológica]
    La exportación se construye con los filtros visibles del módulo. La lógica estadística sigue el mismo criterio de control mostrado en pantalla y prioriza una lectura gerencial del comportamiento dominante por registro.
  \\end{ObservationBox}
}
`;
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PdfRequestBody;
    const filters = normalizePuntoAperturaFilters(body.filters ?? {});
    const data = await getPuntoAperturaDashboardData(filters);
    const exportDate = new Date();
    const dataTexContent = buildDataTex(data, exportDate);

    const { pdf } = await generateCanonicalPdf({
      templateName: "calidad_punto_apertura",
      dataTexContent,
      jobId: crypto.randomUUID(),
      passes: 2,
    });

    const filename =
      filters.isoWeek !== "all"
        ? `reporte_gerencial_punto_apertura_semana_${filters.isoWeek}.pdf`
        : "reporte_gerencial_punto_apertura.pdf";

    return pdfBufferToResponse(pdf, filename);
  } catch (error) {
    if (error instanceof PdfCompileError) {
      console.error("[pdf/punto-apertura] LaTeX error:", error.buildLog.slice(-1500));
      return Response.json(
        { message: "Error al compilar el PDF de punto de apertura." },
        { status: 500 },
      );
    }
    console.error("[pdf/punto-apertura] Unexpected error:", error);
    return handleApiError(error, "No se pudo generar el PDF de punto de apertura.");
  }
}
