import type {
  FenogramaMetric,
  FenogramaPivotRow,
  FenogramaWeekMetricValues,
} from "@/lib/fenograma";

const collator = new Intl.Collator("es-EC", {
  numeric: true,
  sensitivity: "base",
});

export const SUMMARY_COLUMN_WIDTH = 176;
export const TOTAL_COLUMN_WIDTH = 128;

export const dimensionOptions = [
  { key: "area", label: "Área", type: "text", width: 116 },
  { key: "variety", label: "Variedad", type: "text", width: 168 },
  { key: "block", label: "Bloque", type: "text", width: 102 },
  { key: "cycleKey", label: "Ciclo", type: "text", width: 234 },
  { key: "spType", label: "SP", type: "text", width: 96 },
  { key: "spDate", label: "Fecha SP", type: "date", width: 122 },
  { key: "harvestStartDate", label: "Fecha Ini Cos", type: "date", width: 132 },
  { key: "harvestEndDate", label: "Fecha Fin Cos", type: "date", width: 132 },
  { key: "lifecycleStatus", label: "Estado", type: "status", width: 112 },
] as const;

export type PivotDimensionKey = (typeof dimensionOptions)[number]["key"];
export type PivotSortKey = PivotDimensionKey | "totalStems";
export type SortDirection = "asc" | "desc";
export type LeadingColumnKey = PivotDimensionKey | "summary" | "totalStems";
export type SortValue = number | string;
export type LeadingColumn = {
  key: LeadingColumnKey;
  label: string;
  width: number;
  offset: number;
};
export type AggregatedPivotRow = {
  id: string;
  groupValues: Partial<Record<PivotDimensionKey, string>>;
  weekValues: Record<string, number | null>;
  /**
   * Valores brutos por métrica para cada semana del rango visible.
   * Habilita el selector de métrica del Fenograma (Tallos / Cajas verde / Cajas blanco / Peso por tallo).
   */
  weekMetrics: Record<string, FenogramaWeekMetricValues | null>;
  totalStems: number;
  totalGreenBoxes: number;
  totalWhiteBoxes: number;
  totalGreenWeightKg: number;
  sourceRows: FenogramaPivotRow[];
  sourceCount: number;
  sortValues: Record<PivotSortKey, SortValue>;
};

// Helpers `getCellValueForMetric` y `getTotalForMetric` viven en
// `@/modules/fenograma/lib/fenograma-metric-helpers` para mantener este
// archivo dentro del límite estructural canónico.
export { getCellValueForMetric, getTotalForMetric } from "@/modules/fenograma/lib/fenograma-metric-helpers";

export const lifecycleLabelMap: Record<FenogramaPivotRow["lifecycleStatus"], string> = {
  active: "Activo",
  planned: "Planificado",
  history: "Historia",
};

export function getDimensionValue(row: FenogramaPivotRow, key: PivotDimensionKey) {
  switch (key) {
    case "area":
      return row.area;
    case "variety":
      return row.variety;
    case "block":
      return row.block;
    case "cycleKey":
      return row.cycleKey;
    case "spType":
      return row.spType;
    case "spDate":
      return row.spDate ?? "";
    case "harvestStartDate":
      return row.harvestStartDate ?? "";
    case "harvestEndDate":
      return row.harvestEndDate ?? "";
    case "lifecycleStatus":
      return row.lifecycleStatus;
    default:
      return "";
  }
}

function lifecycleRank(value: string) {
  if (value === "active") return 0;
  if (value === "planned") return 1;
  if (value === "history") return 2;
  return 3;
}

function toDateSortValue(value: string) {
  return value ? Number(value.replace(/-/g, "")) : Number.POSITIVE_INFINITY;
}

export function buildLeadingColumns(selectedDimensions: PivotDimensionKey[]) {
  const baseColumns: Array<Pick<LeadingColumn, "key" | "label" | "width">> = selectedDimensions.length
    ? dimensionOptions
      .filter((option) => selectedDimensions.includes(option.key))
      .map((option) => ({
        key: option.key,
        label: option.label,
        width: option.width,
      }))
    : [{ key: "summary", label: "Vista", width: SUMMARY_COLUMN_WIDTH }];
  let offset = 0;

  const leadingColumns: LeadingColumn[] = baseColumns.map((column) => {
    const nextColumn = {
      key: column.key,
      label: column.label,
      width: column.width,
      offset,
    } satisfies LeadingColumn;

    offset += column.width;
    return nextColumn;
  });

  leadingColumns.push({
    key: "totalStems",
    label: "Total",
    width: TOTAL_COLUMN_WIDTH,
    offset,
  });

  return leadingColumns;
}

function buildAggregateSortValue(rows: FenogramaPivotRow[], key: PivotDimensionKey) {
  const option = dimensionOptions.find((entry) => entry.key === key);
  const values = Array.from(
    new Set(
      rows
        .map((row) => getDimensionValue(row, key))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (!option) {
    return "";
  }

  if (!values.length) {
    return option.type === "date" || option.type === "status" ? Number.POSITIVE_INFINITY : "";
  }

  if (option.type === "date") {
    return Math.min(...values.map((value) => toDateSortValue(value)));
  }

  if (option.type === "status") {
    return Math.min(...values.map((value) => lifecycleRank(value)));
  }

  return values.sort((left, right) => collator.compare(left, right))[0] ?? "";
}

export function aggregateRows(
  rows: FenogramaPivotRow[],
  weeks: string[],
  selectedDimensions: PivotDimensionKey[],
) {
  type GroupAccum = {
    groupValues: Partial<Record<PivotDimensionKey, string>>;
    sourceRows: FenogramaPivotRow[];
    totalStems: number;
    totalGreenBoxes: number;
    totalWhiteBoxes: number;
    totalGreenWeightKg: number;
    weekValues: Record<string, number>;
    weekMetrics: Record<string, FenogramaWeekMetricValues>;
  };

  const groups = new Map<string, GroupAccum>();

  for (const row of rows) {
    const groupKey = selectedDimensions.length
      ? selectedDimensions.map((key) => getDimensionValue(row, key)).join("|")
      : "__total__";

    let existingGroup = groups.get(groupKey);
    if (!existingGroup) {
      existingGroup = {
        groupValues: Object.fromEntries(
          selectedDimensions.map((key) => [key, getDimensionValue(row, key)]),
        ) as Partial<Record<PivotDimensionKey, string>>,
        sourceRows: [],
        totalStems: 0,
        totalGreenBoxes: 0,
        totalWhiteBoxes: 0,
        totalGreenWeightKg: 0,
        weekValues: Object.fromEntries(weeks.map((week) => [week, 0])) as Record<string, number>,
        weekMetrics: Object.fromEntries(
          weeks.map((week) => [week, { stems: 0, greenBoxes: 0, whiteBoxes: 0, greenWeightKg: 0 }]),
        ) as Record<string, FenogramaWeekMetricValues>,
      };
      groups.set(groupKey, existingGroup);
    }

    existingGroup.sourceRows.push(row);
    existingGroup.totalStems += row.totalStems;
    existingGroup.totalGreenBoxes += row.totalGreenBoxes ?? 0;
    existingGroup.totalWhiteBoxes += row.totalWhiteBoxes ?? 0;
    existingGroup.totalGreenWeightKg += row.totalGreenWeightKg ?? 0;

    for (const week of weeks) {
      existingGroup.weekValues[week] = (existingGroup.weekValues[week] ?? 0) + (row.weekValues[week] ?? 0);
      const sourceMetrics = row.weekMetrics?.[week];
      if (sourceMetrics) {
        const accum = existingGroup.weekMetrics[week]!;
        accum.stems += sourceMetrics.stems;
        accum.greenBoxes += sourceMetrics.greenBoxes;
        accum.whiteBoxes += sourceMetrics.whiteBoxes;
        accum.greenWeightKg += sourceMetrics.greenWeightKg;
      }
    }
  }

  return Array.from(groups.entries()).map(([groupKey, group]) => {
    const weeklyValues = Object.fromEntries(
      weeks.map((week) => {
        const weekValue = group.weekValues[week] ?? 0;
        return [week, weekValue === 0 ? null : Number(weekValue.toFixed(2))];
      }),
    ) as Record<string, number | null>;

    const weeklyMetrics = Object.fromEntries(
      weeks.map((week) => {
        const m = group.weekMetrics[week] ?? { stems: 0, greenBoxes: 0, whiteBoxes: 0, greenWeightKg: 0 };
        const isEmpty = m.stems === 0 && m.greenBoxes === 0 && m.whiteBoxes === 0 && m.greenWeightKg === 0;
        return [week, isEmpty ? null : m];
      }),
    ) as Record<string, FenogramaWeekMetricValues | null>;

    return {
      id: groupKey,
      groupValues: group.groupValues,
      weekValues: weeklyValues,
      weekMetrics: weeklyMetrics,
      totalStems: Number(group.totalStems.toFixed(2)),
      totalGreenBoxes: Number(group.totalGreenBoxes.toFixed(2)),
      totalWhiteBoxes: Number(group.totalWhiteBoxes.toFixed(2)),
      totalGreenWeightKg: Number(group.totalGreenWeightKg.toFixed(2)),
      sourceRows: group.sourceRows,
      sourceCount: group.sourceRows.length,
      sortValues: {
        totalStems: Number(group.totalStems.toFixed(2)),
        area: buildAggregateSortValue(group.sourceRows, "area"),
        variety: buildAggregateSortValue(group.sourceRows, "variety"),
        block: buildAggregateSortValue(group.sourceRows, "block"),
        cycleKey: buildAggregateSortValue(group.sourceRows, "cycleKey"),
        spType: buildAggregateSortValue(group.sourceRows, "spType"),
        spDate: buildAggregateSortValue(group.sourceRows, "spDate"),
        harvestStartDate: buildAggregateSortValue(group.sourceRows, "harvestStartDate"),
        harvestEndDate: buildAggregateSortValue(group.sourceRows, "harvestEndDate"),
        lifecycleStatus: buildAggregateSortValue(group.sourceRows, "lifecycleStatus"),
      },
    } satisfies AggregatedPivotRow;
  });
}

function compareSortValues(left: SortValue, right: SortValue) {
  if (typeof left === "number" && typeof right === "number") {
    if (left === right) return 0; // guards Infinity - Infinity = NaN
    return left - right;
  }

  return collator.compare(String(left), String(right));
}

export function sortAggregatedRows(
  rows: AggregatedPivotRow[],
  selectedDimensions: PivotDimensionKey[],
  sortBy: PivotSortKey,
  sortDirection: SortDirection,
) {
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const primaryComparison = compareSortValues(left.sortValues[sortBy], right.sortValues[sortBy]);

    if (primaryComparison !== 0) {
      return primaryComparison * directionMultiplier;
    }

    for (const dimension of selectedDimensions) {
      if (dimension === sortBy) {
        continue;
      }

      const comparison = compareSortValues(left.sortValues[dimension], right.sortValues[dimension]);

      if (comparison !== 0) {
        return comparison;
      }
    }

    const byTotal = Number(right.totalStems.toFixed(2)) - Number(left.totalStems.toFixed(2));

    if (byTotal !== 0) {
      return byTotal;
    }

    return collator.compare(left.id, right.id);
  });
}

export function isLastLeadingColumn(columnKey: LeadingColumnKey, columns: LeadingColumn[]) {
  return columnKey === columns[columns.length - 1]?.key;
}

export function getStickyStyle(offset: number, width: number) {
  return {
    left: `${offset}px`,
    minWidth: `${width}px`,
    width: `${width}px`,
  };
}
