"use client";

import { memo, useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { formatDateSlash as formatDate, formatFlexibleNumber } from "@/shared/lib/format";
import type { FenogramaDashboardData, FenogramaPivotRow } from "@/lib/fenograma";

const collator = new Intl.Collator("es-EC", {
  numeric: true,
  sensitivity: "base",
});

const SUMMARY_COLUMN_WIDTH = 176;
const TOTAL_COLUMN_WIDTH = 128;

const dimensionOptions = [
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

type PivotDimensionKey = (typeof dimensionOptions)[number]["key"];
type PivotSortKey = PivotDimensionKey | "totalStems";
type SortDirection = "asc" | "desc";
type LeadingColumnKey = PivotDimensionKey | "summary" | "totalStems";
type SortValue = number | string;
type LeadingColumn = {
  key: LeadingColumnKey;
  label: string;
  width: number;
  offset: number;
};
type AggregatedPivotRow = {
  id: string;
  groupValues: Partial<Record<PivotDimensionKey, string>>;
  weekValues: Record<string, number | null>;
  totalStems: number;
  sourceRows: FenogramaPivotRow[];
  sourceCount: number;
  sortValues: Record<PivotSortKey, SortValue>;
};

const lifecycleLabelMap: Record<FenogramaPivotRow["lifecycleStatus"], string> = {
  active: "Activo",
  planned: "Planificado",
  history: "Historia",
};

function formatCellValue(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) {
    return "";
  }

  return formatFlexibleNumber(value, { empty: "" });
}

function getDimensionValue(row: FenogramaPivotRow, key: PivotDimensionKey) {
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

function formatDimensionValue(key: PivotDimensionKey, value: string | undefined) {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    return "-";
  }

  if (key === "spDate" || key === "harvestStartDate" || key === "harvestEndDate") {
    return formatDate(normalizedValue);
  }

  if (key === "lifecycleStatus") {
    return lifecycleLabelMap[normalizedValue as FenogramaPivotRow["lifecycleStatus"]] ?? normalizedValue;
  }

  return normalizedValue;
}

function lifecycleRank(value: string) {
  if (value === "active") {
    return 0;
  }

  if (value === "planned") {
    return 1;
  }

  if (value === "history") {
    return 2;
  }

  return 3;
}

function toDateSortValue(value: string) {
  return value ? Number(value.replace(/-/g, "")) : Number.POSITIVE_INFINITY;
}

function buildLeadingColumns(selectedDimensions: PivotDimensionKey[]) {
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

function getStickyStyle(offset: number, width: number) {
  return {
    left: `${offset}px`,
    minWidth: `${width}px`,
    width: `${width}px`,
  };
}

function isLastLeadingColumn(columnKey: LeadingColumnKey, columns: LeadingColumn[]) {
  return columnKey === columns[columns.length - 1]?.key;
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

function aggregateRows(
  rows: FenogramaPivotRow[],
  weeks: string[],
  selectedDimensions: PivotDimensionKey[],
) {
  const groups = new Map<string, {
    groupValues: Partial<Record<PivotDimensionKey, string>>;
    sourceRows: FenogramaPivotRow[];
    totalStems: number;
    weekValues: Record<string, number | null>;
  }>();

  for (const row of rows) {
    const groupKey = selectedDimensions.length
      ? selectedDimensions.map((key) => getDimensionValue(row, key)).join("|")
      : "__total__";
    const existingGroup = groups.get(groupKey) ?? {
      groupValues: Object.fromEntries(
        selectedDimensions.map((key) => [key, getDimensionValue(row, key)]),
      ) as Partial<Record<PivotDimensionKey, string>>,
      sourceRows: [],
      totalStems: 0,
      weekValues: Object.fromEntries(weeks.map((week) => [week, null])) as Record<string, number | null>,
    };

    existingGroup.sourceRows.push(row);
    existingGroup.totalStems += row.totalStems;

    for (const week of weeks) {
      const currentValue = existingGroup.weekValues[week] ?? 0;
      existingGroup.weekValues[week] = currentValue + (row.weekValues[week] ?? 0);
    }

    groups.set(groupKey, existingGroup);
  }

  return Array.from(groups.entries()).map(([groupKey, group]) => {
    const weeklyValues = Object.fromEntries(
      weeks.map((week) => {
        const weekValue = group.weekValues[week] ?? 0;
        return [week, weekValue === 0 ? null : Number(weekValue.toFixed(2))];
      }),
    ) as Record<string, number | null>;

    return {
      id: groupKey,
      groupValues: group.groupValues,
      weekValues: weeklyValues,
      totalStems: Number(group.totalStems.toFixed(2)),
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

function sortAggregatedRows(
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

function lifecycleTone(rows: FenogramaPivotRow[]) {
  if (rows.length !== 1) {
    return "bg-background/72";
  }

  if (rows[0]?.lifecycleStatus === "active") {
    return "bg-primary/6";
  }

  if (rows[0]?.lifecycleStatus === "planned") {
    return "bg-accent/14";
  }

  return "bg-background/68";
}

export const FenogramaPivotTable = memo(function FenogramaPivotTable({
  data,
  onRowSelect,
}: {
  data: FenogramaDashboardData;
  onRowSelect?: (row: FenogramaPivotRow) => void;
}) {
  const [selectedDimensions, setSelectedDimensions] = useState<PivotDimensionKey[]>(["area"]);
  const [sortBy, setSortBy] = useState<PivotSortKey>("area");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const leadingColumns = useMemo(
    () => buildLeadingColumns(selectedDimensions),
    [selectedDimensions],
  );
  const aggregatedRows = useMemo(
    () => aggregateRows(data.rows, data.weeks, selectedDimensions),
    [data.rows, data.weeks, selectedDimensions],
  );
  const sortedRows = useMemo(
    () => sortAggregatedRows(aggregatedRows, selectedDimensions, sortBy, sortDirection),
    [aggregatedRows, selectedDimensions, sortBy, sortDirection],
  );

  function toggleDimension(dimension: PivotDimensionKey) {
    setSelectedDimensions((current) => {
      if (current.includes(dimension)) {
        return current.filter((item) => item !== dimension);
      }

      return dimensionOptions
        .map((option) => option.key)
        .filter((key) => current.includes(key) || key === dimension);
    });
  }

  function handleRowSelect(row: AggregatedPivotRow) {
    if (!onRowSelect || row.sourceRows.length !== 1) {
      return;
    }

    onRowSelect(row.sourceRows[0]!);
  }

  return (
    <Card className="starter-panel overflow-hidden border-border/70 bg-card/82">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Columnas de agrupacion
            </p>
            <div className="flex flex-wrap gap-2">
              {dimensionOptions.map((option) => {
                const active = selectedDimensions.includes(option.key);

                return (
                  <Button
                    key={option.key}
                    variant={active ? "secondary" : "outline"}
                    className="rounded-full"
                    onClick={() => toggleDimension(option.key)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Orden
              </p>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as PivotSortKey)}
                className="flex h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {dimensionOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
                <option value="totalStems">Total tallos</option>
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Direccion
              </p>
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl"
                onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
              >
                <ArrowDownUp className="size-4" aria-hidden="true" />
                {sortDirection === "asc" ? "Ascendente" : "Descendente"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {data.rows.length} filas base
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {sortedRows.length} filas pivotadas
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {selectedDimensions.length ? selectedDimensions.length : "Sin"} dimensiones activas
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Click solo cuando el grupo representa 1 ciclo
          </Badge>
        </div>

        <div className="relative">
        <div className="max-h-[min(74dvh,820px)] w-full overflow-auto show-scrollbar rounded-[24px] border border-border/70" role="region" aria-label="Tabla fenograma pivot" tabIndex={0}>
          <table className="min-w-full w-max border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30 bg-card/95 backdrop-blur">
              <tr>
                {leadingColumns.map((column) => (
                  <th
                    key={column.key}
                    style={getStickyStyle(column.offset, column.width)}
                    className={cn(
                      "sticky top-0 z-40 border-b border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground",
                      isLastLeadingColumn(column.key, leadingColumns) && "shadow-[14px_0_20px_-16px_rgba(15,23,42,0.28)]",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
                {data.weeks.map((week) => (
                  <th
                    key={week}
                    className="sticky top-0 border-b border-r border-border/70 bg-card px-3 py-3 text-right font-semibold text-foreground"
                  >
                    <div className="min-w-[92px]">{week}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? sortedRows.map((row, rowIndex) => {
                const isClickable = row.sourceRows.length === 1 && Boolean(onRowSelect);

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      rowIndex % 2 === 0 ? "bg-background/84" : "bg-background/70",
                      lifecycleTone(row.sourceRows),
                      isClickable && "cursor-pointer transition-colors hover:bg-slate-900/4 dark:hover:bg-slate-800/8",
                    )}
                    onClick={isClickable ? () => handleRowSelect(row) : undefined}
                    onKeyDown={isClickable ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowSelect(row);
                      }
                    } : undefined}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                  >
                    {leadingColumns.map((column, columnIndex) => {
                      const isLastColumn = isLastLeadingColumn(column.key, leadingColumns);

                      if (column.key === "totalStems") {
                        return (
                          <td
                            key={`${row.id}-${column.key}`}
                            style={getStickyStyle(column.offset, column.width)}
                            className={cn(
                              "sticky z-20 border-b border-r border-border/60 bg-card px-3 py-2.5 text-right font-semibold tabular-nums text-foreground",
                              isLastColumn && "shadow-[14px_0_20px_-16px_rgba(15,23,42,0.22)]",
                            )}
                          >
                            {formatCellValue(row.totalStems)}
                          </td>
                        );
                      }

                      const displayValue = column.key === "summary"
                        ? "Total general"
                        : formatDimensionValue(column.key, row.groupValues[column.key]);

                      return (
                        <td
                          key={`${row.id}-${column.key}`}
                          style={getStickyStyle(column.offset, column.width)}
                          className={cn(
                            "sticky z-20 border-b border-r border-border/60 bg-card px-3 py-2.5 align-middle text-left text-foreground",
                            isLastColumn && "shadow-[14px_0_20px_-16px_rgba(15,23,42,0.22)]",
                          )}
                        >
                          <div className="min-w-0">
                            <p className={cn("truncate", isClickable && columnIndex === 0 && "font-semibold underline-offset-4 hover:underline")}>
                              {displayValue}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.sourceCount === 1 ? "1 ciclo" : `${row.sourceCount} ciclos`}
                            </p>
                          </div>
                        </td>
                      );
                    })}

                    {data.weeks.map((week) => (
                      <td
                        key={`${row.id}-${week}`}
                        className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums text-foreground/92"
                      >
                        <div className="min-w-[92px]">{formatCellValue(row.weekValues[week])}</div>
                      </td>
                    ))}
                  </tr>
                );
              }) : (
                <tr>
                  <td
                    colSpan={leadingColumns.length + data.weeks.length}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay datos para el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-30 bg-card/96 backdrop-blur">
              <tr>
                {leadingColumns.map((column, columnIndex) => {
                  const isLastColumn = isLastLeadingColumn(column.key, leadingColumns);
                  const content = column.key === "totalStems"
                    ? formatCellValue(data.summary.totalStems)
                    : columnIndex === 0
                      ? "Total general"
                      : "";

                  return (
                    <td
                      key={`footer-${column.key}`}
                      style={getStickyStyle(column.offset, column.width)}
                      className={cn(
                        "sticky bottom-0 z-40 border-t border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground",
                        column.key === "totalStems" && "text-right tabular-nums",
                        isLastColumn && "shadow-[14px_0_20px_-16px_rgba(15,23,42,0.28)]",
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
                {data.weeklyTotals.map((entry) => (
                  <td
                    key={`total-${entry.week}`}
                    className="sticky bottom-0 border-t border-r border-border/70 bg-card px-3 py-3 text-right font-semibold tabular-nums text-foreground"
                  >
                    <div className="min-w-[92px]">{formatCellValue(entry.stems)}</div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent rounded-r-[24px] md:hidden" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
});
