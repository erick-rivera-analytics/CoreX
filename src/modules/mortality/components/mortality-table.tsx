"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { ClickableTableRow } from "@/shared/tables/clickable-table-row";
import { InteractiveCell } from "@/shared/tables/interactive-cell";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { SortableHeader } from "@/shared/tables/sortable-header";
import { cn } from "@/lib/utils";
import { formatFlexibleNumber as formatNumber, formatPercent } from "@/shared/lib/format";
import type { MortalityDashboardRow } from "@/lib/mortality";

type MortalitySortKey =
  | "cycleKey"
  | "area"
  | "spType"
  | "variety"
  | "parentBlock"
  | "block"
  | "initialPlants"
  | "deadPlantsCount"
  | "reseedPlantsCount"
  | "initialPlantsCycle"
  | "finalPlantsCount"
  | "availabilityVsScheduledPct"
  | "availabilityVsInitialPct"
  | "mortalityPct";

type SortDirection = "asc" | "desc";

const columns: Array<{
  key: MortalitySortKey;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "cycleKey", label: "Ciclo" },
  { key: "area", label: "Área" },
  { key: "spType", label: "Tipo SP" },
  { key: "variety", label: "Variedad" },
  { key: "parentBlock", label: "Bloque padre" },
  { key: "block", label: "Bloque" },
  { key: "initialPlants", label: "Plantas programadas", align: "right" },
  { key: "deadPlantsCount", label: "Bajas", align: "right" },
  { key: "reseedPlantsCount", label: "Resiembras", align: "right" },
  { key: "initialPlantsCycle", label: "Plantas iniciales ciclo", align: "right" },
  { key: "finalPlantsCount", label: "Plantas finales", align: "right" },
  { key: "availabilityVsScheduledPct", label: "Disp. vs programadas", align: "right" },
  { key: "availabilityVsInitialPct", label: "Disp. vs iniciales", align: "right" },
  { key: "mortalityPct", label: "Mortandad", align: "right" },
];

const collator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});


function getSortableValue(row: MortalityDashboardRow, key: MortalitySortKey) {
  return row[key] ?? "";
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return collator.compare(String(left), String(right));
}

export function MortalityTable({
  rows,
  onOpenHistory,
}: {
  rows: MortalityDashboardRow[];
  onOpenHistory: (row: MortalityDashboardRow) => void;
}) {
  const [sortBy, setSortBy] = useState<MortalitySortKey>("mortalityPct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(() => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    return [...rows].sort((left, right) => {
      const primary = compareValues(getSortableValue(left, sortBy), getSortableValue(right, sortBy));

      if (primary !== 0) {
        return primary * multiplier;
      }

      return collator.compare(left.cycleKey, right.cycleKey);
    });
  }, [rows, sortBy, sortDirection]);

  function toggleSort(nextSortBy: MortalitySortKey) {
    if (nextSortBy === sortBy) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection(nextSortBy === "cycleKey" ? "asc" : "desc");
  }

  return (
    <Card className="starter-panel overflow-hidden border-border/70 bg-card/82">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Tabla de ciclos
            </p>
            <p className="text-sm text-muted-foreground">
              Haz clic en una fila o en el ciclo para abrir el historial completo del bloque.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {rows.length} filas
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Orden: {columns.find((column) => column.key === sortBy)?.label}
            </Badge>
          </div>
        </div>

        <ScrollFadeTable className="border border-border/70">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur">
              <tr>
                {columns.map((column) => (
                  <SortableHeader
                    key={column.key}
                    label={column.label}
                    sortKey={column.key}
                    activeSortKey={sortBy}
                    direction={sortDirection}
                    onSort={(key) => toggleSort(key as MortalitySortKey)}
                    align={column.align}
                    className="last:border-r-0"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? sortedRows.map((row, index) => (
                <ClickableTableRow
                  key={row.id}
                  isClickable
                  onSelect={() => onOpenHistory(row)}
                  className={cn(
                    index % 2 === 0 ? "bg-background/84" : "bg-background/70",
                  )}
                >
                  <td className="border-b border-r border-border/50 px-3 py-2.5 font-medium text-slate-700 dark:text-white">
                    <InteractiveCell
                      variant="underline-text"
                      decorative
                      label={row.cycleKey}
                    />
                  </td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5">{row.area || "-"}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5">{row.spType || "-"}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5">{row.variety || "-"}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5">{row.parentBlock || "-"}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5">{row.block || "-"}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatNumber(row.initialPlants)}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatNumber(row.deadPlantsCount)}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatNumber(row.reseedPlantsCount)}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatNumber(row.initialPlantsCycle)}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatNumber(row.finalPlantsCount)}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatPercent(row.availabilityVsScheduledPct)}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">{formatPercent(row.availabilityVsInitialPct)}</td>
                  <td className="border-b border-border/50 px-3 py-2.5 text-right tabular-nums font-medium">{formatPercent(row.mortalityPct)}</td>
                </ClickableTableRow>
              )) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay ciclos disponibles para el filtro actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollFadeTable>
      </CardContent>
    </Card>
  );
}
