import type { PuntoAperturaDashboardData } from "@/lib/calidad-punto-apertura";
import {
  buildClassShareSummary,
  buildDominantSummary,
  buildExecutiveSummary,
  buildMethodologyCritique,
  buildMonthlySummary,
  pct,
  tex,
} from "@/lib/calidad-punto-apertura-pdf-stats";

export function buildPuntoAperturaDataTex(
  data: PuntoAperturaDashboardData,
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
      : "  \\multicolumn{6}{c}{\\textit{Sin registros no homogeneos para el filtro actual.}} \\\\";

  const dominantRows =
    dominantSummary.length > 0
      ? dominantSummary
          .map((row) => `  ${tex(row.label)} & ${row.count} & ${pct(row.pct)} \\\\`)
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

  return buildDocumentTex({
    data,
    detailRows,
    dominantRows,
    classSummaryRows,
    monthlyRows,
    executiveSummary,
    methodologyCritique,
    exportDate,
  });
}

function buildDocumentTex(input: {
  data: PuntoAperturaDashboardData;
  detailRows: string;
  dominantRows: string;
  classSummaryRows: string;
  monthlyRows: string;
  executiveSummary: string[];
  methodologyCritique: string[];
  exportDate: Date;
}) {
  const { data, exportDate } = input;
  const { filters, summary } = data;
  const isoWeekLabel =
    filters.isoWeek !== "all" ? `Semana ${tex(filters.isoWeek)}` : "Todas las semanas";
  const filterTokens = [
    filters.area !== "all" ? `Area: ${filters.area}` : null,
    filters.spType !== "all" ? `Tipo SP: ${filters.spType}` : null,
    filters.year !== "all" ? `Ano: ${filters.year}` : null,
    filters.month !== "all" ? `Mes: ${filters.month}` : null,
    filters.date ? `Dia: ${filters.date}` : null,
    filters.dominantClass !== "all" ? `Dominante: ${filters.dominantClass}` : null,
    filters.bloque !== "all" ? `Bloque: ${filters.bloque}` : null,
  ].filter(Boolean);

  const filtersNote =
    filterTokens.length > 0
      ? `\\NoteInline{Filtros:} ${tex(filterTokens.join(" · "))}`
      : "\\NoteInline{Filtros:} Sin filtros adicionales";

  return `\\SetDocCode{CAL-PA-${tex(filters.isoWeek !== "all" ? filters.isoWeek : "ALL")}}
\\SetDocDate{${exportDate.toISOString().slice(0, 10)}}
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
${input.executiveSummary.map((item) => `    \\item ${tex(item)}`).join("\n")}
  \\end{itemize}

  \\section*{Metodologia}
  \\begin{ParrafoMetodologico}
  La exportacion replica el criterio analitico historico del modulo: para cada ciclo se identifica la primera fecha con apertura efectiva y desde ese punto se analiza la mezcla dominante por registro. Los filtros visibles en pantalla restringen el conjunto final antes de consolidar porcentajes, ciclos y tablas de resumen.
  \\end{ParrafoMetodologico}

  \\section*{Indicadores clave}
  \\begin{center}
  \\begin{tabular}{ccc}
    \\FichaKPI{Registros visibles}{${summary.totalRecords}}{${summary.totalCycles} ciclos} &
    \\FichaKPI{Homogeneos}{${pct(summary.homogeneousPct)}}{${summary.homogeneousRecords} registros} &
    \\FichaKPI{No homogeneos}{${pct(100 - summary.homogeneousPct)}}{${summary.nonHomogeneousRecords} registros} \\\\
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

  \\section*{Distribucion por clase dominante}
  \\begin{table}[H]
    \\centering
    \\caption{Participacion de la clase dominante sobre registros visibles}
    \\begin{tabular}{l r r}
      \\toprule
      \\textbf{Clase} & \\textbf{Registros} & \\textbf{Participacion} \\\\
      \\midrule
${input.dominantRows}
      \\bottomrule
    \\end{tabular}
  \\end{table}

  \\section*{Resumen estadistico por clase dominante}
  \\begin{center}
  \\begin{longtable}{@{} l r r r r r r r @{}}
    \\caption{Participacion dominante y tallos promedio por clase} \\\\
    \\toprule
    \\textbf{Clase} & \\textbf{Mallas} & \\textbf{Media} & \\textbf{SD} & \\textbf{Mediana} & \\textbf{P25} & \\textbf{P75} & \\textbf{Media tallos} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Clase} & \\textbf{Mallas} & \\textbf{Media} & \\textbf{SD} & \\textbf{Mediana} & \\textbf{P25} & \\textbf{P75} & \\textbf{Media tallos} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{8}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${input.classSummaryRows}
  \\end{longtable}
  \\end{center}

  \\section*{Evolucion temporal}
  \\begin{center}
  \\begin{longtable}{@{} l r r r @{}}
    \\caption{Media y dispersion mensual del porcentaje dominante} \\\\
    \\toprule
    \\textbf{Mes} & \\textbf{Media dominante} & \\textbf{SD dominante} & \\textbf{Registros} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Mes} & \\textbf{Media dominante} & \\textbf{SD dominante} & \\textbf{Registros} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{4}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${input.monthlyRows}
  \\end{longtable}
  \\end{center}

  ${buildClosingTex(input.detailRows, input.methodologyCritique)}
}
`;
}

function buildClosingTex(detailRows: string, methodologyCritique: string[]) {
  return `\\section*{Registros criticos}
  \\begin{center}
  \\begin{longtable}{@{} l p{4.3cm} p{1.7cm} p{2.2cm} r l @{}}
    \\caption{Registros no homogeneos con menor participacion dominante} \\\\
    \\toprule
    \\textbf{Fecha} & \\textbf{Ciclo} & \\textbf{Bloque} & \\textbf{Clase} & \\textbf{Dominante} & \\textbf{Estado} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Fecha} & \\textbf{Ciclo} & \\textbf{Bloque} & \\textbf{Clase} & \\textbf{Dominante} & \\textbf{Estado} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{6}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${detailRows}
  \\end{longtable}
  \\end{center}

  \\section*{Critica metodologica}
  \\begin{itemize}
${methodologyCritique.map((item) => `    \\item ${tex(item)}`).join("\n")}
  \\end{itemize}

  \\begin{ObservationBox}[Nota metodologica]
    La exportacion se construye con los filtros visibles del modulo. La logica estadistica sigue el mismo criterio de control mostrado en pantalla y prioriza una lectura gerencial del comportamiento dominante por registro.
  \\end{ObservationBox}`;
}
