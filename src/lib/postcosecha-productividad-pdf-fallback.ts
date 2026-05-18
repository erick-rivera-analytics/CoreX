import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import type {
  PostharvestProductivityDashboardData,
  PostharvestProductivityRow,
} from "@/lib/postcosecha-productividad-contract";
import {
  buildPostharvestProductivityPdfAssets,
  type PostharvestProcessWeeklyPdfPoint,
  type PostharvestWeeklyPdfPoint,
} from "@/lib/postcosecha-productividad-pdf-charts";

const execFileAsync = promisify(execFile);

const BUNDLED_PYTHON_BIN = resolve(
  "C:\\Users\\paul.loja\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
);
const FALLBACK_SCRIPT = resolve(process.cwd(), "scripts", "generate_postharvest_productivity_pdf_fallback.py");

type AreaSummaryRow = {
  label: string;
  hours: number;
  sharePct: number;
  hpb: number;
};

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

function sliceLastWeeks<T extends { weekLabel: string }>(points: T[], limit = 10) {
  return [...points]
    .sort((left, right) => left.weekLabel.localeCompare(right.weekLabel, "es-EC"))
    .slice(-limit);
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

function buildWeeklyPoints(data: PostharvestProductivityDashboardData): PostharvestWeeklyPdfPoint[] {
  const weekMap = new Map<string, PostharvestWeeklyPdfPoint>();

  for (const row of data.rows) {
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

function buildPathDestinationSummary(data: PostharvestProductivityDashboardData): PathDestinationSummaryRow[] {
  const map = new Map<string, PathDestinationSummaryRow>();
  for (const row of data.rows) {
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
  const pathSummary = buildPathDestinationSummary(data);
  const dominantPath = [...pathSummary].sort((left, right) => right.totalHours - left.totalHours)[0];
  const highestProcess = [...processWeekly].sort((left, right) => right.hpbTotal - left.hpbTotal)[0];

  return [
    `El periodo visible consolida ${data.summary.totalBoxes10.toFixed(2)} cajas de 10kg y ${data.summary.totalHours.toFixed(2)} horas trabajadas, con un KPI total de ${(data.summary.weightedHoursPerBox ?? 0).toFixed(4)} h/caja.`,
    highestWeek && lowestWeek
      ? `En las ultimas 10 semanas visibles, el indicador se movio entre ${lowestWeek.hpbTotal.toFixed(4)} h/caja en ${lowestWeek.weekLabel} y ${highestWeek.hpbTotal.toFixed(4)} h/caja en ${highestWeek.weekLabel}.`
      : "No hubo suficientes semanas visibles para construir un rango semanal.",
    dominantPath
      ? `El mayor consumo consolidado de horas se concentro en ${dominantPath.pathPost} / ${dominantPath.finalDestination}, con ${dominantPath.totalHours.toFixed(2)} horas y ${dominantPath.hpbTotal.toFixed(4)} h/caja.`
      : "No hubo datos suficientes para construir el consolidado por camino y destino.",
    highestProcess
      ? `El proceso con mayor H/Caja semanal reciente fue ${highestProcess.pathPost} en ${highestProcess.weekLabel}, con ${highestProcess.hpbTotal.toFixed(4)} h/caja.`
      : "No hubo datos suficientes para contrastar procesos por semana.",
  ];
}

export async function generatePostharvestProductivityFallbackPdf(
  data: PostharvestProductivityDashboardData,
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "post_prod_pdf_"));
  try {
    const weeklyPoints = sliceLastWeeks(buildWeeklyPoints(data), 10);
    const processWeeklyPoints = sliceLastWeeks(buildProcessWeeklyPoints(data.rows), 30);
    const areaSummary = buildAreaSummary(data);
    const pathDestinationSummary = buildPathDestinationSummary(data);
    const executiveSummary = buildExecutiveSummary(data, weeklyPoints, processWeeklyPoints);
    const assets = await buildPostharvestProductivityPdfAssets(weeklyPoints, processWeeklyPoints);

    const chartPaths: string[] = [];
    for (const asset of assets) {
      const assetPath = join(tempDir, asset.fileName);
      await writeFile(assetPath, asset.content);
      chartPaths.push(assetPath);
    }

    const payloadPath = join(tempDir, "input.json");
    const outputPath = join(tempDir, "productividad_postcosecha.pdf");

    await writeFile(
      payloadPath,
      JSON.stringify(
        {
          summary: data.summary,
          filters: data.filters,
          areaSummary,
          pathDestinationSummary,
          weeklyPoints,
          processWeeklyPoints,
          executiveSummary,
          chartPaths,
        },
        null,
        2,
      ),
      "utf-8",
    );

    const pythonBin = process.env["PYTHON_BIN"]?.trim() || BUNDLED_PYTHON_BIN;
    await execFileAsync(pythonBin, [FALLBACK_SCRIPT, payloadPath, outputPath], {
      cwd: process.cwd(),
      timeout: 120000,
    });

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
