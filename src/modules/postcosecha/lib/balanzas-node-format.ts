import { formatDecimal, formatInteger, formatPercent } from "@/shared/lib/format";
import type {
  BalanzasNodeData,
  BalanzasTableColumn,
  BalanzasTableRow,
} from "@/lib/postcosecha-balanzas";

/**
 * Shared formatting helpers for Balanzas node tables (panel preview and detail sheet).
 * Keeps cell rendering consistent regardless of the surface that hosts the data.
 */
export function formatDisplayValue(
  node: BalanzasNodeData,
  column: BalanzasTableColumn,
  row: BalanzasTableRow,
) {
  const value = row.values[column.key];

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (column.kind === "ratio") {
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
      return String(value);
    }

    return formatPercent(numericValue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  if (column.kind === "number" && typeof value === "number") {
    const displayValue = Number.isInteger(value) ? formatInteger(value) : formatDecimal(value);
    const shouldAppendKg = node.metric === "peso"
      && (
        column.key === node.columnMap.source
        || column.key === node.columnMap.target
        || column.key === node.columnMap.gap
        || column.key.toLowerCase().includes("weight")
      );

    return shouldAppendKg ? `${displayValue} kg` : displayValue;
  }

  return String(value);
}

export function getRatioTone(value: number | null) {
  if (value === null) {
    return "bg-background/60 text-muted-foreground";
  }

  if (value >= 95) {
    return "bg-chart-success-bold/16 text-foreground";
  }

  if (value >= 80) {
    return "bg-slate-500/16 text-slate-950 dark:text-slate-100";
  }

  return "bg-slate-500/18 text-slate-950 dark:text-slate-100";
}

export function buildNodeHeadline(node: BalanzasNodeData) {
  return `${node.label} | ${node.laneLabel}`;
}

export function buildVisibleSummary(node: BalanzasNodeData, rows: BalanzasTableRow[]) {
  const sourceKey = node.columnMap.source;
  const targetKey = node.columnMap.target;
  const dateKey = node.columnMap.date;

  let sourceTotal = 0;
  let targetTotal = 0;
  let latestDate: string | null = null;

  for (const row of rows) {
    if (sourceKey) {
      const value = row.values[sourceKey];
      sourceTotal += typeof value === "number" ? value : Number(value ?? 0);
    }

    if (targetKey) {
      const value = row.values[targetKey];
      targetTotal += typeof value === "number" ? value : Number(value ?? 0);
    }

    if (dateKey) {
      const dateValue = String(row.values[dateKey] ?? "");
      if (dateValue && (!latestDate || dateValue > latestDate)) {
        latestDate = dateValue;
      }
    }
  }

  const safeSourceTotal = Number.isFinite(sourceTotal) ? sourceTotal : 0;
  const safeTargetTotal = Number.isFinite(targetTotal) ? targetTotal : 0;
  const gapTotal = safeSourceTotal - safeTargetTotal;
  const ratioPct = safeSourceTotal > 0
    ? ((safeTargetTotal / safeSourceTotal) - 1) * 100
    : null;

  return {
    sourceTotal: safeSourceTotal,
    targetTotal: safeTargetTotal,
    gapTotal,
    ratioPct,
    latestDate: latestDate ?? node.latestDate,
  };
}

export type NodeLocalFilters = {
  destination: string;
  grade: string;
  lot: string;
  hydrationDays: string;
  isoWeek: string;
  dayName: string;
  month: string;
  date: string;
};

export const DEFAULT_NODE_LOCAL_FILTERS: NodeLocalFilters = {
  destination: "all",
  grade: "all",
  lot: "all",
  hydrationDays: "all",
  isoWeek: "all",
  dayName: "all",
  month: "all",
  date: "all",
};

export function createNodeLocalFilters() {
  return { ...DEFAULT_NODE_LOCAL_FILTERS };
}
