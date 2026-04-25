"use client";

import { memo, useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ClickableTableRow } from "@/shared/tables/clickable-table-row";
import { InteractiveCell } from "@/shared/tables/interactive-cell";
import { cn } from "@/lib/utils";
import { formatDateSlash as formatDate, formatFlexibleNumber } from "@/shared/lib/format";
import {
  aggregateRows,
  buildLeadingColumns,
  dimensionOptions,
  getStickyStyle,
  isLastLeadingColumn,
  lifecycleLabelMap,
  sortAggregatedRows,
  type AggregatedPivotRow,
  type PivotDimensionKey,
  type PivotSortKey,
  type SortDirection,
} from "@/modules/fenograma/lib/fenograma-pivot-aggregation";
import type { FenogramaDashboardData, FenogramaPivotRow } from "@/lib/fenograma";

function formatCellValue(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) {
    return "";
  }

  return formatFlexibleNumber(value, { empty: "" });
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
            <SingleSelectField
              id="fenograma-pivot-sort"
              label="Orden"
              value={sortBy}
              emptyValue={dimensionOptions[0]!.key}
              emptyLabel={dimensionOptions[0]!.label}
              options={[...dimensionOptions.slice(1).map((o) => o.key), "totalStems"]}
              displayValue={(v) => v === "totalStems" ? "Total tallos" : (dimensionOptions.find((o) => o.key === v)?.label ?? v)}
              onChange={(v) => setSortBy(v as PivotSortKey)}
            />

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
                  <ClickableTableRow
                    key={row.id}
                    isClickable={isClickable}
                    onSelect={isClickable ? () => handleRowSelect(row) : undefined}
                    className={cn(
                      rowIndex % 2 === 0 ? "bg-background/84" : "bg-background/70",
                      lifecycleTone(row.sourceRows),
                    )}
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
                              isClickable && "group-hover:bg-primary/6",
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
                              isClickable && "group-hover:bg-primary/6",
                              isLastColumn && "shadow-[14px_0_20px_-16px_rgba(15,23,42,0.22)]",
                            )}
                          >
                            <div className="min-w-0">
                              {isClickable && columnIndex === 0 ? (
                                <InteractiveCell
                                  variant="underline-text"
                                  decorative
                                  truncate
                                  label={<span className="font-semibold">{displayValue}</span>}
                                />
                              ) : (
                                <p className="truncate">{displayValue}</p>
                              )}
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
                        className={cn(
                          "border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums text-foreground/92",
                          isClickable && "group-hover:bg-primary/6",
                        )}
                      >
                        <div className="min-w-[92px]">{formatCellValue(row.weekValues[week])}</div>
                      </td>
                    ))}
                  </ClickableTableRow>
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
