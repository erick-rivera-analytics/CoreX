"use client";

import { memo, useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/lib/utils";
import { formatFlexibleNumber, formatPercent } from "@/shared/lib/format";
import type {
  BalanzasNodeData,
  BalanzasTableColumn,
  BalanzasTableRow,
} from "@/lib/postcosecha-balanzas";

type SortKey = "ratio" | "source" | "target" | "gap" | "rows" | "group";
type SortDirection = "asc" | "desc";

type AggregatedRow = {
  id: string;
  groupValues: Record<string, string>;
  source: number;
  target: number;
  gap: number | null;
  ratioPct: number | null;
  rowCount: number;
};

function formatMetricNumber(value: number | null, appendKg = false) {
  const displayValue = formatFlexibleNumber(value);
  return displayValue === "—" || !appendKg ? displayValue : `${displayValue} kg`;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

function getDisplayValue(column: BalanzasTableColumn | undefined, row: BalanzasTableRow) {
  if (!column) {
    return "-";
  }

  const value = row.values[column.key];
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function getRatioTone(value: number | null) {
  if (value === null) {
    return "bg-background/64";
  }

  if (value >= 95) {
    return "bg-chart-success-bold/14";
  }

  if (value >= 80) {
    return "bg-slate-500/14";
  }

  return "bg-slate-500/14";
}

export const BalanzasGroupedTable = memo(function BalanzasGroupedTable({
  node,
  rows,
}: {
  node: BalanzasNodeData;
  rows: BalanzasTableRow[];
}) {
  const groupableColumns = useMemo(
    () => node.tableColumns.filter((column) => (
      column.key !== node.columnMap.source
      && column.key !== node.columnMap.target
      && column.key !== node.columnMap.gap
      && column.key !== node.columnMap.ratio
      && column.key !== node.columnMap.destination
      && column.kind !== "number"
      && column.kind !== "ratio"
    )),
    [node.columnMap.destination, node.columnMap.gap, node.columnMap.ratio, node.columnMap.source, node.columnMap.target, node.tableColumns],
  );
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(
    node.groupDefaults.length
      ? node.groupDefaults
      : groupableColumns.slice(0, 2).map((column) => column.key),
  );
  const [sortBy, setSortBy] = useState<SortKey>("ratio");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const groupedRows = useMemo(() => {
    const groups = new Map<string, AggregatedRow>();

    for (const row of rows) {
      const groupValues = Object.fromEntries(
        selectedDimensions.map((dimension) => {
          const column = node.tableColumns.find((entry) => entry.key === dimension);
          return [dimension, getDisplayValue(column, row)];
        }),
      ) as Record<string, string>;
      const groupKey = selectedDimensions.length
        ? selectedDimensions.map((dimension) => groupValues[dimension]).join(" | ")
        : "Vista general";
      const current = groups.get(groupKey) ?? {
        id: groupKey,
        groupValues,
        source: 0,
        target: 0,
        gap: null,
        ratioPct: null,
        rowCount: 0,
      };

      current.source += node.columnMap.source ? toNumber(row.values[node.columnMap.source]) : 0;
      current.target += node.columnMap.target ? toNumber(row.values[node.columnMap.target]) : 0;
      current.rowCount += 1;
      groups.set(groupKey, current);
    }

    return Array.from(groups.values())
      .map((row) => ({
        ...row,
        gap: row.target !== 0 || row.source !== 0 ? Number((row.source - row.target).toFixed(2)) : null,
        ratioPct: row.source > 0
          ? Number((((row.target / row.source) - 1) * 100).toFixed(2))
          : null,
      }))
      .sort((left, right) => {
        const multiplier = sortDirection === "asc" ? 1 : -1;

        if (sortBy === "source") {
          return (left.source - right.source) * multiplier;
        }

        if (sortBy === "target") {
          return (left.target - right.target) * multiplier;
        }

        if (sortBy === "gap") {
          return ((left.gap ?? 0) - (right.gap ?? 0)) * multiplier;
        }

        if (sortBy === "rows") {
          return (left.rowCount - right.rowCount) * multiplier;
        }

        if (sortBy === "ratio") {
          return ((left.ratioPct ?? -1) - (right.ratioPct ?? -1)) * multiplier;
        }

        return left.id.localeCompare(right.id, "en-US", { numeric: true }) * multiplier;
      });
  }, [node.columnMap.source, node.columnMap.target, node.tableColumns, rows, selectedDimensions, sortBy, sortDirection]);

  function toggleDimension(columnKey: string) {
    setSelectedDimensions((current) => {
      if (current.includes(columnKey)) {
        return current.filter((value) => value !== columnKey);
      }

      return [...current, columnKey];
    });
  }

  return (
    <Card className="border-border/70 bg-background/72">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Agrupar por
            </p>
            <div className="flex flex-wrap gap-2">
              {groupableColumns.map((column) => (
                <Button
                  key={column.key}
                  variant={selectedDimensions.includes(column.key) ? "secondary" : "outline"}
                  className="rounded-full"
                  onClick={() => toggleDimension(column.key)}
                >
                  {column.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Orden
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortKey)}
                className="flex h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="ratio">Macro indicador</option>
                <option value="source">{node.sourceStage}</option>
                <option value="target">{node.targetStage}</option>
                <option value="gap">Brecha</option>
                <option value="rows">Filas</option>
                <option value="group">Grupo</option>
              </select>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}
              >
                <ArrowDownUp className="size-4" aria-hidden="true" />
                {sortDirection === "asc" ? "Asc" : "Desc"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {groupedRows.length} grupos
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {selectedDimensions.length} dimensiones
          </Badge>
        </div>

        <div className="max-h-[min(44dvh,500px)] overflow-auto rounded-[24px] border border-border/70">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur">
              <tr>
                {selectedDimensions.length ? selectedDimensions.map((dimension) => {
                  const column = node.tableColumns.find((entry) => entry.key === dimension);

                  return (
                    <th
                      key={dimension}
                      className="border-b border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground"
                    >
                      {column?.label ?? dimension}
                    </th>
                  );
                }) : (
                  <th className="border-b border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground">
                    Grupo
                  </th>
                )}
                <th className="border-b border-r border-border/70 bg-card px-3 py-3 text-right font-semibold text-foreground">
                  {node.sourceStage}
                </th>
                <th className="border-b border-r border-border/70 bg-card px-3 py-3 text-right font-semibold text-foreground">
                  {node.targetStage}
                </th>
                <th className="border-b border-r border-border/70 bg-card px-3 py-3 text-right font-semibold text-foreground">
                  Brecha
                </th>
                <th className="border-b border-r border-border/70 bg-card px-3 py-3 text-right font-semibold text-foreground">
                  Macro indicador
                </th>
                <th className="border-b border-border/70 bg-card px-3 py-3 text-right font-semibold text-foreground">
                  Filas
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.length ? groupedRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={cn(index % 2 === 0 ? "bg-background/84" : "bg-background/70")}
                >
                  {selectedDimensions.length ? selectedDimensions.map((dimension) => (
                    <td
                      key={`${row.id}-${dimension}`}
                      className="border-b border-r border-border/50 px-3 py-2.5 text-foreground"
                    >
                      {row.groupValues[dimension] || "-"}
                    </td>
                  )) : (
                    <td className="border-b border-r border-border/50 px-3 py-2.5 text-foreground">
                      Vista general
                    </td>
                  )}
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                    {formatMetricNumber(row.source, node.metric === "peso")}
                  </td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                    {formatMetricNumber(row.target, node.metric === "peso")}
                  </td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                    {formatMetricNumber(row.gap, node.metric === "peso")}
                  </td>
                  <td className={cn("border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums", getRatioTone(row.ratioPct))}>
                    {formatPercent(row.ratioPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>
                  <td className="border-b border-border/50 px-3 py-2.5 text-right tabular-nums">
                    {row.rowCount}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td
                    colSpan={selectedDimensions.length + 5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No hay datos para agrupar con el corte actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
});
