import type {
  PostharvestProductivityDashboardData,
  PostharvestProductivityRow,
} from "@/lib/postcosecha-productividad-contract";
import {
  buildPostharvestProductivityPdfAssets,
  type PostharvestProcessWeeklyPdfPoint,
  type PostharvestWeeklyPdfPoint,
} from "@/lib/postcosecha-productividad-pdf-charts";
import type { GeneratePdfAsset } from "@pdf-canon/scripts/generate_pdf_service";

type PathDestinationSummaryRow = {
  pathPost: string;
  finalDestination: string;
  totalHours: number;
  boxes10: number;
  hpbTotal: number;
  shareCls: number;
  shareSb: number;
  shareEmp: number;
};

type AreaSummaryRow = {
  label: string;
  hours: number;
  sharePct: number;
  hpb: number;
};

const PATH_ORDER = new Map([
  ["APERTURA", 1],
  ["GV", 2],
  ["PRECLASIFICACION", 3],
]);

const DESTINATION_ORDER = new Map([
  ["BLANCO", 1],
  ["TINTURADO", 2],
  ["ARCOIRIS", 3],
]);

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

function dec(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "---";
  return tex(
    new Intl.NumberFormat("es-EC", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value),
  );
}

function pct(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "---";
  return `${dec(value, digits)}\\%`;
}

function formatFilterLabel(values: string[], emptyLabel = "Todos") {
  return values.length ? values.join(", ") : emptyLabel;
}

function parseSelectedValues(value: string) {
  if (!value || value === "all") return [];
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortPathDestinationRows(rows: PathDestinationSummaryRow[]) {
  return [...rows].sort((left, right) => {
    const leftPath = PATH_ORDER.get(left.pathPost) ?? 99;
    const rightPath = PATH_ORDER.get(right.pathPost) ?? 99;
    if (leftPath !== rightPath) return leftPath - rightPath;
    const leftDestination = DESTINATION_ORDER.get(left.finalDestination) ?? 99;
    const rightDestination = DESTINATION_ORDER.get(right.finalDestination) ?? 99;
    if (leftDestination !== rightDestination) return leftDestination - rightDestination;
    return left.finalDestination.localeCompare(right.finalDestination, "es-EC");
  });
}

function sliceLastWeeks<T extends { weekLabel: string }>(points: T[], limit = 10) {
  return [...points]
    .sort((left, right) => left.weekLabel.localeCompare(right.weekLabel, "es-EC"))
    .slice(-limit);
}

function buildWeeklyPoints(rows: PostharvestProductivityRow[]): PostharvestWeeklyPdfPoint[] {
  const weekMap = new Map<string, PostharvestWeeklyPdfPoint>();

  for (const row of rows) {
    const current = weekMap.get(row.isoWeekId) ?? {
      weekLabel: row.isoWeekId,
      totalHours: 0,
      boxes10: 0,
      hpbTotal: 0,
      hpbCls: 0,
      hpbSb: 0,
      hpbEmp: 0,
    };

    current.totalHours += row.totalHours;
    current.boxes10 += row.boxes10;
    current.hpbCls += row.hoursCls;
    current.hpbSb += row.hoursSb;
    current.hpbEmp += row.hoursEmp;

    weekMap.set(row.isoWeekId, current);
  }

  return Array.from(weekMap.values())
    .sort((left, right) => left.weekLabel.localeCompare(right.weekLabel, "es-EC"))
    .map((point) => ({
      ...point,
      hpbTotal: point.boxes10 > 0 ? point.totalHours / point.boxes10 : 0,
      hpbCls: point.boxes10 > 0 ? point.hpbCls / point.boxes10 : 0,
      hpbSb: point.boxes10 > 0 ? point.hpbSb / point.boxes10 : 0,
      hpbEmp: point.boxes10 > 0 ? point.hpbEmp / point.boxes10 : 0,
    }));
}

function buildProcessWeeklyPoints(rows: PostharvestProductivityRow[]): PostharvestProcessWeeklyPdfPoint[] {
  const processMap = new Map<string, PostharvestProcessWeeklyPdfPoint>();

  for (const row of rows) {
    if (!PATH_ORDER.has(row.pathPost)) continue;
    const key = `${row.isoWeekId}|${row.pathPost}`;
    const current = processMap.get(key) ?? {
      weekLabel: row.isoWeekId,
      pathPost: row.pathPost,
      totalHours: 0,
      boxes10: 0,
      hpbTotal: 0,
    };

    current.totalHours += row.totalHours;
    current.boxes10 += row.boxes10;
    processMap.set(key, current);
  }

  return Array.from(processMap.values())
    .map((point) => ({
      ...point,
      hpbTotal: point.boxes10 > 0 ? point.totalHours / point.boxes10 : 0,
    }))
    .sort((left, right) => {
      const weekSort = left.weekLabel.localeCompare(right.weekLabel, "es-EC");
      if (weekSort !== 0) return weekSort;
      return (PATH_ORDER.get(left.pathPost) ?? 99) - (PATH_ORDER.get(right.pathPost) ?? 99);
    });
}

function buildAreaSummary(data: PostharvestProductivityDashboardData): AreaSummaryRow[] {
  const totalBoxes10 = data.summary.totalBoxes10 || 0;
  const totalHours = data.summary.totalHours || 0;

  return [
    {
      label: "CLS",
      hours: data.summary.totalHoursCls,
      sharePct: totalHours > 0 ? (data.summary.totalHoursCls / totalHours) * 100 : 0,
      hpb: totalBoxes10 > 0 ? data.summary.totalHoursCls / totalBoxes10 : 0,
    },
    {
      label: "SB",
      hours: data.summary.totalHoursSb,
      sharePct: totalHours > 0 ? (data.summary.totalHoursSb / totalHours) * 100 : 0,
      hpb: totalBoxes10 > 0 ? data.summary.totalHoursSb / totalBoxes10 : 0,
    },
    {
      label: "EMP",
      hours: data.summary.totalHoursEmp,
      sharePct: totalHours > 0 ? (data.summary.totalHoursEmp / totalHours) * 100 : 0,
      hpb: totalBoxes10 > 0 ? data.summary.totalHoursEmp / totalBoxes10 : 0,
    },
  ];
}

function buildPathDestinationSummary(rows: PostharvestProductivityRow[]): PathDestinationSummaryRow[] {
  const map = new Map<string, PathDestinationSummaryRow>();

  for (const row of rows) {
    const key = `${row.pathPost}|${row.finalDestination}`;
    const current = map.get(key) ?? {
      pathPost: row.pathPost,
      finalDestination: row.finalDestination,
      totalHours: 0,
      boxes10: 0,
      hpbTotal: 0,
      shareCls: 0,
      shareSb: 0,
      shareEmp: 0,
    };

    current.totalHours += row.totalHours;
    current.boxes10 += row.boxes10;
    current.shareCls += row.hoursCls;
    current.shareSb += row.hoursSb;
    current.shareEmp += row.hoursEmp;
    map.set(key, current);
  }

  return sortPathDestinationRows(
    Array.from(map.values()).map((row) => ({
      ...row,
      hpbTotal: row.boxes10 > 0 ? row.totalHours / row.boxes10 : 0,
      shareCls: row.totalHours > 0 ? (row.shareCls / row.totalHours) * 100 : 0,
      shareSb: row.totalHours > 0 ? (row.shareSb / row.totalHours) * 100 : 0,
      shareEmp: row.totalHours > 0 ? (row.shareEmp / row.totalHours) * 100 : 0,
    })),
  );
}

function buildExecutiveSummary(
  data: PostharvestProductivityDashboardData,
  weekly: PostharvestWeeklyPdfPoint[],
  processWeekly: PostharvestProcessWeeklyPdfPoint[],
) {
  const highestWeek = [...weekly].sort((left, right) => right.hpbTotal - left.hpbTotal)[0];
  const lowestWeek = [...weekly].sort((left, right) => left.hpbTotal - right.hpbTotal)[0];
  const pathSummary = buildPathDestinationSummary(data.rows);
  const dominantPath = [...pathSummary].sort((left, right) => right.totalHours - left.totalHours)[0];
  const highestProcess = [...processWeekly].sort((left, right) => right.hpbTotal - left.hpbTotal)[0];

  return [
    `El periodo visible consolida ${dec(data.summary.totalBoxes10, 2)} cajas de 10kg y ${dec(data.summary.totalHours, 2)} horas trabajadas, con un KPI total de ${dec(data.summary.weightedHoursPerBox ?? 0, 4)} h/caja.`,
    highestWeek && lowestWeek
      ? `En las ultimas 10 semanas visibles, el indicador se movio entre ${dec(lowestWeek.hpbTotal, 4)} h/caja en ${tex(lowestWeek.weekLabel)} y ${dec(highestWeek.hpbTotal, 4)} h/caja en ${tex(highestWeek.weekLabel)}.`
      : "No hubo suficientes semanas visibles para construir un rango semanal.",
    dominantPath
      ? `El mayor consumo consolidado de horas se concentro en ${tex(dominantPath.pathPost)} / ${tex(dominantPath.finalDestination)}, con ${dec(dominantPath.totalHours, 2)} horas y ${dec(dominantPath.hpbTotal, 4)} h/caja.`
      : "No hubo datos suficientes para construir el consolidado por camino y destino.",
    highestProcess
      ? `El proceso con mayor H/Caja semanal reciente fue ${tex(highestProcess.pathPost)} en ${tex(highestProcess.weekLabel)}, con ${dec(highestProcess.hpbTotal, 4)} h/caja.`
      : "No hubo datos suficientes para contrastar procesos por semana.",
  ];
}

export async function buildPostharvestProductivityPdfDocument(
  data: PostharvestProductivityDashboardData,
  exportDate: Date,
): Promise<{ dataTexContent: string; assets: GeneratePdfAsset[] }> {
  const weeklyPoints = sliceLastWeeks(buildWeeklyPoints(data.rows), 10);
  const processWeeklyPoints = sliceLastWeeks(buildProcessWeeklyPoints(data.rows), 30);
  const areaSummary = buildAreaSummary(data);
  const pathDestinationSummary = buildPathDestinationSummary(data.rows);
  const executiveSummary = buildExecutiveSummary(data, weeklyPoints, processWeeklyPoints);
  const assets = await buildPostharvestProductivityPdfAssets(weeklyPoints, processWeeklyPoints);

  const exportDateLabel = exportDate.toISOString().slice(0, 10);
  const yearFilter = formatFilterLabel(parseSelectedValues(data.filters.year));
  const monthFilter = formatFilterLabel(parseSelectedValues(data.filters.month));
  const areaFilter = formatFilterLabel(parseSelectedValues(data.filters.area));
  const pathFilter = formatFilterLabel(parseSelectedValues(data.filters.pathPost));
  const destinationFilter = formatFilterLabel(parseSelectedValues(data.filters.finalDestination));
  const varietyFilter = formatFilterLabel(parseSelectedValues(data.filters.variety));

  const areaRowsTex = areaSummary
    .map((row) => `  ${tex(row.label)} & ${dec(row.hours, 2)} & ${pct(row.sharePct, 2)} & ${dec(row.hpb, 4)} \\\\`)
    .join("\n");

  const pathDestinationRowsTex =
    pathDestinationSummary.length > 0
      ? pathDestinationSummary
          .map(
            (row) =>
              `  ${tex(row.pathPost)} & ${tex(row.finalDestination)} & ${dec(row.totalHours, 2)} & ${dec(row.boxes10, 2)} & ${pct(row.shareCls, 2)} & ${pct(row.shareSb, 2)} & ${pct(row.shareEmp, 2)} & ${dec(row.hpbTotal, 4)} \\\\`,
          )
          .join("\n")
      : "  \\multicolumn{8}{c}{\\textit{Sin datos para el consolidado actual.}} \\\\";

  const weeklyRowsTex =
    weeklyPoints.length > 0
      ? weeklyPoints
          .map(
            (row) =>
              `  ${tex(row.weekLabel)} & ${dec(row.totalHours, 2)} & ${dec(row.boxes10, 2)} & ${dec(row.hpbCls, 4)} & ${dec(row.hpbSb, 4)} & ${dec(row.hpbEmp, 4)} & ${dec(row.hpbTotal, 4)} \\\\`,
          )
          .join("\n")
      : "  \\multicolumn{7}{c}{\\textit{Sin datos semanales para el filtro actual.}} \\\\";

  const filtersNote = [
    `Fecha desde: ${tex(data.filters.dateFrom || "2025-04-29")}`,
    `Fecha hasta: ${tex(data.filters.dateTo || "Hoy")}`,
    `Ano: ${tex(yearFilter)}`,
    `Mes: ${tex(monthFilter)}`,
    `Area: ${tex(areaFilter)}`,
    `Camino: ${tex(pathFilter)}`,
    `Destino: ${tex(destinationFilter)}`,
    `Variedad: ${tex(varietyFilter)}`,
  ].join(" · ");

  const dataTexContent = `\\SetDocCode{POST-PROD-${exportDateLabel}}
\\SetDocDate{${exportDateLabel}}
\\SetDocTitle{Reporte gerencial de productividad de postcosecha}
\\SetDocArea{Postcosecha}
\\SetDocAuthor{CoreX}

\\newcommand{\\PostharvestProductivityBody}{%
  \\section*{Reporte gerencial de productividad de postcosecha}
  \\NoteInline{Filtros activos:} ${filtersNote}

  \\section*{Resumen ejecutivo}
  \\begin{ParrafoEjecutivo}
  ${tex(executiveSummary[0])}
  \\end{ParrafoEjecutivo}

  \\begin{itemize}
${executiveSummary.map((item) => `    \\item ${tex(item)}`).join("\n")}
  \\end{itemize}

  \\section*{Metodologia}
  \\begin{ParrafoMetodologico}
  El reporte se alimenta desde la capa analitica oficial de productividad de postcosecha publicada en datalakehouse. Usa horas trabajadas a pagar (effective hours), cajas de 10kg visibles desde 2025-04-29 y redistribucion metodologica consistente con el modulo operativo de CoreX.
  \\end{ParrafoMetodologico}

  \\section*{Indicadores clave}
  \\begin{center}
  \\begin{tabular}{ccc}
    \\FichaKPI{Horas total}{${dec(data.summary.totalHours, 2)} h}{consolidado visible} &
    \\FichaKPI{Cajas 10kg}{${dec(data.summary.totalBoxes10, 2)}}{universo visible} &
    \\FichaKPI{H/Caja total}{${dec(data.summary.weightedHoursPerBox ?? 0, 4)}}{horas totales / cajas 10kg} \\\\
  \\end{tabular}
  \\end{center}

  \\vspace{4mm}
  \\begin{center}
  \\begin{tabular}{ccc}
    \\FichaKPI{\\% Part. CLS}{${pct((data.summary.totalHoursCls / Math.max(data.summary.totalHours, 1)) * 100, 2)}}{sobre horas totales} &
    \\FichaKPI{\\% Part. SB}{${pct((data.summary.totalHoursSb / Math.max(data.summary.totalHours, 1)) * 100, 2)}}{sobre horas totales} &
    \\FichaKPI{\\% Part. EMP}{${pct((data.summary.totalHoursEmp / Math.max(data.summary.totalHours, 1)) * 100, 2)}}{sobre horas totales} \\\\
  \\end{tabular}
  \\end{center}

  \\section*{Comparacion por area}
  \\begin{table}[H]
    \\centering
    \\caption{Participacion operativa por area}
    \\begin{tabular}{l r r r}
      \\toprule
      \\textbf{Area} & \\textbf{Horas} & \\textbf{Participacion} & \\textbf{H/Caja} \\\\
      \\midrule
${areaRowsTex}
      \\bottomrule
    \\end{tabular}
  \\end{table}

  \\section*{Tendencia semanal reciente}
  \\FiguraConFallback{./assets/postharvest_weekly_hpb.png}{Tendencia semanal de H/Caja total y por area para las ultimas 10 semanas}
  \\FiguraConFallback{./assets/postharvest_weekly_process_hpb.png}{Comparativo semanal de H/Caja por proceso para Apertura, GV y Preclasificacion}

  \\begin{center}
  \\begin{longtable}{@{} l r r r r r r @{}}
    \\caption{Resumen semanal de productividad (ultimas 10 semanas)} \\\\
    \\toprule
    \\textbf{Semana} & \\textbf{Horas total} & \\textbf{Cajas 10kg} & \\textbf{H/Caja CLS} & \\textbf{H/Caja SB} & \\textbf{H/Caja EMP} & \\textbf{H/Caja total} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Semana} & \\textbf{Horas total} & \\textbf{Cajas 10kg} & \\textbf{H/Caja CLS} & \\textbf{H/Caja SB} & \\textbf{H/Caja EMP} & \\textbf{H/Caja total} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{7}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${weeklyRowsTex}
  \\end{longtable}
  \\end{center}

  \\section*{Consolidado por camino y destino}
  \\begin{center}
  \\begin{longtable}{@{} l l r r r r r r @{}}
    \\caption{Horas, cajas y participacion por camino y destino} \\\\
    \\toprule
    \\textbf{Camino} & \\textbf{Destino} & \\textbf{Horas total} & \\textbf{Cajas 10kg} & \\textbf{\\% CLS} & \\textbf{\\% SB} & \\textbf{\\% EMP} & \\textbf{H/Caja total} \\\\
    \\midrule
    \\endfirsthead
    \\toprule
    \\textbf{Camino} & \\textbf{Destino} & \\textbf{Horas total} & \\textbf{Cajas 10kg} & \\textbf{\\% CLS} & \\textbf{\\% SB} & \\textbf{\\% EMP} & \\textbf{H/Caja total} \\\\
    \\midrule
    \\endhead
    \\midrule
    \\multicolumn{8}{r}{\\small\\itshape Continua\\ldots} \\\\
    \\endfoot
    \\bottomrule
    \\endlastfoot
${pathDestinationRowsTex}
  \\end{longtable}
  \\end{center}

  \\ObservationBox[Lectura operativa]{
    El PDF consolida la misma fuente oficial visible en CoreX. La lectura semanal se limita a las ultimas 10 semanas para priorizar tendencias recientes y evitar que la historia completa diluya cambios operativos de corto plazo.
  }
}
`;

  return { dataTexContent, assets };
}
