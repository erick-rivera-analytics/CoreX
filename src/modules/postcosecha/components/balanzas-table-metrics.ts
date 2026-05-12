import { formatFlexibleNumber, formatPercent } from "@/shared/lib/format";
import type { BalanzasDetailColumn } from "@/lib/postcosecha-balanzas";

type BalanzasRow = Record<string, unknown>;

const TABLE_EMPTY = "—";

export function asBalanzasNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSummedMetrics(
  rows: BalanzasRow[],
  numericColumns: BalanzasDetailColumn[],
) {
  const sums: Record<string, number | null> = {};

  for (const column of numericColumns) {
    let sum = 0;
    let any = false;

    for (const row of rows) {
      const value = asBalanzasNumber(row[column.key]);
      if (value === null) continue;
      sum += value;
      any = true;
    }

    sums[column.key] = any ? sum : null;
  }

  return sums;
}

export function buildBalanzasLeafMetrics(
  row: BalanzasRow,
  numericColumns: BalanzasDetailColumn[],
) {
  const metrics: Record<string, number | null> = {};

  for (const column of numericColumns) {
    metrics[column.key] = asBalanzasNumber(row[column.key]);
  }

  return metrics;
}

export function aggregateBalanzasMetrics(
  rows: BalanzasRow[],
  numericColumns: BalanzasDetailColumn[],
) {
  const summedMetrics = buildSummedMetrics(rows, numericColumns);
  const aggregated: Record<string, number | null> = {};

  for (const column of numericColumns) {
    if (
      (column.aggregateMode === "derived-ratio"
        || column.aggregateMode === "derived-quotient"
        || column.aggregateMode === "derived-loss-ratio")
      && column.aggregateSources
    ) {
      const numerator = summedMetrics[column.aggregateSources.numeratorKey];
      const denominator = summedMetrics[column.aggregateSources.denominatorKey];

      if (numerator === null || denominator === null || denominator === 0) {
        aggregated[column.key] = null;
      } else if (column.aggregateMode === "derived-ratio") {
        aggregated[column.key] = (numerator / denominator) - 1;
      } else if (column.aggregateMode === "derived-loss-ratio") {
        aggregated[column.key] = 1 - (numerator / denominator);
      } else {
        // derived-quotient
        aggregated[column.key] = numerator / denominator;
      }
      continue;
    }

    aggregated[column.key] = summedMetrics[column.key] ?? null;
  }

  return aggregated;
}

export function formatBalanzasTableMetric(
  value: unknown,
  column: BalanzasDetailColumn,
) {
  const numericValue = asBalanzasNumber(value);
  if (!column.numeric || numericValue === null) {
    return TABLE_EMPTY;
  }

  // Nota: para columnas `derived-loss-ratio` (Desperdicio), el loader
  // ya entregó los valores row-by-row negados (convertidos a positivo),
  // y `aggregateBalanzasMetrics` produce el agregado con la fórmula
  // canon `1 − num/den` también positivo. Ambos contextos llegan acá
  // con la misma escala, no se requiere transformación adicional.

  switch (column.format) {
    case "pct":
    case "ratio":
      return formatPercent(numericValue, { input: "ratio", empty: TABLE_EMPTY });
    case "g":
      return formatFlexibleNumber(numericValue * 1000, { empty: TABLE_EMPTY });
    case "kg":
    case "count":
    default:
      return formatFlexibleNumber(numericValue, { empty: TABLE_EMPTY });
  }
}

export function formatBalanzasTextValue(value: unknown) {
  if (value === null || value === undefined) return TABLE_EMPTY;
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const stringValue = String(value);
  if (stringValue === "" || stringValue === "null" || stringValue === "undefined" || stringValue === "NaN") {
    return TABLE_EMPTY;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(stringValue)) {
    return stringValue.slice(0, 10);
  }

  return stringValue;
}
