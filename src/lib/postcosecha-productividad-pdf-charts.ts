import sharp from "sharp";

import type { GeneratePdfAsset } from "@pdf-canon/scripts/generate_pdf_service";

export type PostharvestWeeklyPdfPoint = {
  weekLabel: string;
  totalHours: number;
  boxes10: number;
  hpbTotal: number;
  hpbCls: number;
  hpbSb: number;
  hpbEmp: number;
};

export type PostharvestProcessWeeklyPdfPoint = {
  weekLabel: string;
  pathPost: string;
  totalHours: number;
  boxes10: number;
  hpbTotal: number;
};

type SeriesDefinition = {
  label: string;
  color: string;
  values: Array<number | null>;
};

const CHART_WIDTH = 1280;
const CHART_HEIGHT = 720;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function buildPolylinePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function buildSegments(values: Array<number | null>, xForIndex: (index: number) => number, yForValue: (value: number) => number) {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      return;
    }

    current.push({
      x: xForIndex(index),
      y: yForValue(value),
    });
  });

  if (current.length) {
    segments.push(current);
  }

  return segments;
}

async function svgToPngBuffer(svg: string) {
  return sharp(Buffer.from(svg, "utf-8")).png().toBuffer();
}

function sliceLastWeeks<T extends { weekLabel: string }>(points: T[], limit = 10) {
  return [...points]
    .sort((left, right) => left.weekLabel.localeCompare(right.weekLabel, "es-EC"))
    .slice(-limit);
}

async function buildLineChartPng({
  title,
  subtitle,
  points,
  series,
}: {
  title: string;
  subtitle: string;
  points: string[];
  series: SeriesDefinition[];
}) {
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const margin = { top: 80, right: 60, bottom: 100, left: 90 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const valuePool = series.flatMap((item) => item.values).filter((value): value is number => value !== null && Number.isFinite(value));
  const maxValue = valuePool.length ? Math.max(...valuePool) : 1;
  const minValue = 0;
  const yMax = maxValue > 0 ? maxValue * 1.12 : 1;
  const yTicks = 5;

  const xForIndex = (index: number) =>
    margin.left + (points.length <= 1 ? chartWidth / 2 : (chartWidth * index) / Math.max(points.length - 1, 1));
  const yForValue = (value: number) => margin.top + chartHeight - ((value - minValue) / (yMax - minValue || 1)) * chartHeight;

  const tickLabels = Array.from({ length: yTicks + 1 }, (_, index) => {
    const value = minValue + ((yMax - minValue) * index) / yTicks;
    const y = yForValue(value);
    return { value, y };
  });

  const lineSvg = series
    .map((item) => {
      const segments = buildSegments(item.values, xForIndex, yForValue);
      const paths = segments
        .map(
          (segment) =>
            `<path d="${buildPolylinePath(segment)}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
        )
        .join("");
      const dots = segments
        .flatMap((segment) => segment)
        .map(
          (point) =>
            `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5" fill="${item.color}" stroke="#ffffff" stroke-width="1.5" />`,
        )
        .join("");
      return `
        ${paths}
        ${dots}
      `;
    })
    .join("");

  const legendItems = series
    .map(
      (item, index) => `
        <g transform="translate(${margin.left + index * 220}, ${height - 28})">
          <rect x="0" y="-14" width="20" height="6" rx="3" fill="${item.color}" />
          <text x="30" y="-8" font-size="20" fill="#334155" font-family="Arial, Helvetica, sans-serif">${escapeXml(item.label)}</text>
        </g>
      `,
    )
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="${margin.left}" y="40" font-size="28" font-weight="700" fill="#0f172a" font-family="Arial, Helvetica, sans-serif">
        ${escapeXml(title)}
      </text>
      <text x="${margin.left}" y="68" font-size="16" fill="#64748b" font-family="Arial, Helvetica, sans-serif">
        ${escapeXml(subtitle)}
      </text>

      ${tickLabels
        .map(
          (tick) => `
            <line x1="${margin.left}" y1="${tick.y.toFixed(2)}" x2="${width - margin.right}" y2="${tick.y.toFixed(2)}" stroke="#e2e8f0" stroke-width="1" />
            <text x="${margin.left - 14}" y="${(tick.y + 5).toFixed(2)}" text-anchor="end" font-size="16" fill="#64748b" font-family="Arial, Helvetica, sans-serif">${escapeXml(formatNumber(tick.value, 1))}</text>
          `,
        )
        .join("")}

      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#94a3b8" stroke-width="1.5" />
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#94a3b8" stroke-width="1.5" />

      ${points
        .map(
          (label, index) => `
            <text x="${xForIndex(index).toFixed(2)}" y="${height - margin.bottom + 28}" text-anchor="middle" font-size="15" fill="#64748b" font-family="Arial, Helvetica, sans-serif">
              ${escapeXml(label)}
            </text>
          `,
        )
        .join("")}

      ${lineSvg}
      ${legendItems}
    </svg>
  `;

  return svgToPngBuffer(svg);
}

async function buildWeeklyTrendChartPng(points: PostharvestWeeklyPdfPoint[]) {
  return buildLineChartPng({
    title: "Tendencia semanal de H/Caja",
    subtitle: "Ultimas 10 semanas visibles del consolidado total y por area",
    points: points.map((point) => point.weekLabel),
    series: [
      { label: "TOTAL", color: "#0f172a", values: points.map((point) => point.hpbTotal) },
      { label: "CLS", color: "#1f4e79", values: points.map((point) => point.hpbCls) },
      { label: "SB", color: "#7c3aed", values: points.map((point) => point.hpbSb) },
      { label: "EMP", color: "#dc2626", values: points.map((point) => point.hpbEmp) },
    ],
  });
}

async function buildProcessComparisonChartPng(points: PostharvestProcessWeeklyPdfPoint[]) {
  const weeks = Array.from(new Set(points.map((point) => point.weekLabel))).sort((left, right) =>
    left.localeCompare(right, "es-EC"),
  );
  const processMap = new Map(points.map((point) => [`${point.pathPost}|${point.weekLabel}`, point.hpbTotal] as const));

  return buildLineChartPng({
    title: "H/Caja semanal por proceso",
    subtitle: "Comparativo de Apertura, GV y Preclasificacion en las ultimas 10 semanas",
    points: weeks,
    series: [
      {
        label: "APERTURA",
        color: "#1f4e79",
        values: weeks.map((weekLabel) => processMap.get(`APERTURA|${weekLabel}`) ?? null),
      },
      {
        label: "GV",
        color: "#16a34a",
        values: weeks.map((weekLabel) => processMap.get(`GV|${weekLabel}`) ?? null),
      },
      {
        label: "PRECLASIFICACION",
        color: "#dc2626",
        values: weeks.map((weekLabel) => processMap.get(`PRECLASIFICACION|${weekLabel}`) ?? null),
      },
    ],
  });
}

export async function buildPostharvestProductivityPdfAssets(
  weeklyPoints: PostharvestWeeklyPdfPoint[],
  processWeeklyPoints: PostharvestProcessWeeklyPdfPoint[],
): Promise<GeneratePdfAsset[]> {
  const latestWeeklyPoints = sliceLastWeeks(weeklyPoints, 10);
  const latestProcessWeeklyPoints = sliceLastWeeks(processWeeklyPoints, 30);

  if (!latestWeeklyPoints.length && !latestProcessWeeklyPoints.length) return [];

  const assets: GeneratePdfAsset[] = [];

  if (latestWeeklyPoints.length) {
    assets.push({
      fileName: "postharvest_weekly_hpb.png",
      content: await buildWeeklyTrendChartPng(latestWeeklyPoints),
    });
  }

  if (latestProcessWeeklyPoints.length) {
    assets.push({
      fileName: "postharvest_weekly_process_hpb.png",
      content: await buildProcessComparisonChartPng(latestProcessWeeklyPoints),
    });
  }

  return assets;
}
