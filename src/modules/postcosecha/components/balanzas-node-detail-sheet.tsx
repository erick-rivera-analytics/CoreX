"use client";

import { Layers3, TableProperties } from "lucide-react";

import { BalanzasGroupedTable } from "@/modules/postcosecha/components/balanzas-grouped-table";
import {
  buildNodeHeadline,
  buildVisibleSummary,
  formatDisplayValue,
  getRatioTone,
  type NodeLocalFilters,
} from "@/modules/postcosecha/lib/balanzas-node-format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatDate, formatInteger, formatPercent } from "@/shared/lib/format";
import { cn } from "@/lib/utils";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { SheetShell } from "@/shared/overlays/sheet-shell";
import type {
  BalanzasNodeData,
  BalanzasTableRow,
} from "@/lib/postcosecha-balanzas";

export type { NodeLocalFilters } from "@/modules/postcosecha/lib/balanzas-node-format";
export {
  DEFAULT_NODE_LOCAL_FILTERS,
  createNodeLocalFilters,
} from "@/modules/postcosecha/lib/balanzas-node-format";

export function BalanzasNodeDetailSheet({
  node,
  rows,
  search,
  filters,
  open,
  onSearchChange,
  onFilterChange,
  onClose,
}: {
  node: BalanzasNodeData;
  rows: BalanzasTableRow[];
  search: string;
  filters: NodeLocalFilters;
  open: boolean;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: keyof NodeLocalFilters, value: string) => void;
  onClose: () => void;
}) {
  const sourceKey = node.columnMap.source;
  const targetKey = node.columnMap.target;
  const ratioKey = node.columnMap.ratio;
  const gapKey = node.columnMap.gap;
  const visibleColumns = node.tableColumns.filter((column) => column.key !== node.columnMap.destination);
  const visibleSummary = buildVisibleSummary(node, rows);
  const tableFilters = [
    { key: "grade" as const, label: "Grado", options: node.localOptions.grades },
    { key: "lot" as const, label: "Lote", options: node.localOptions.lots },
    { key: "hydrationDays" as const, label: "Dias de hidratacion", options: node.localOptions.hydrationDays },
    { key: "isoWeek" as const, label: "Semana", options: node.localOptions.isoWeeks },
    { key: "dayName" as const, label: "Dia", options: node.localOptions.dayNames },
    { key: "month" as const, label: "Mes", options: node.localOptions.months },
    { key: "date" as const, label: "Fecha", options: node.localOptions.dates },
  ].filter((entry) => entry.options.length > 1);

  return (
    <SheetShell
      open={open}
      title={buildNodeHeadline(node)}
      description={node.description}
      side="right"
      widthClassName="w-[min(1100px,100vw-80px)] max-w-[1100px]"
      onClose={onClose}
      headerActions={
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {node.label}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {node.laneLabel}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {node.kind === "aggregate" ? "GENERAL" : "CHART"}
          </Badge>
          {node.sourceView ? (
            <Badge variant="outline" className="rounded-full px-3 py-1 font-mono text-[11px]">
              {node.sourceView}
            </Badge>
          ) : null}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {formatInteger(rows.length)} filas visibles
            {node.sourceView ? ` · fuente: ${node.sourceView}` : ""}
          </p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      {node.status !== "ready" ? (
        <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-4 text-sm text-slate-950 dark:text-slate-100">
          {node.statusMessage ?? "No hay vista disponible para este nodo."}
        </div>
      ) : (
        <div className="space-y-5">
          <KpiGrid columns={5}>
            <MetricTile
              label={node.focusStage}
              value={node.metric === "peso" ? `${formatInteger(node.primaryTotal)} kg` : formatInteger(node.primaryTotal)}
            />
            <MetricTile
              label={node.sourceStage}
              value={node.metric === "peso" ? `${formatInteger(visibleSummary.sourceTotal)} kg` : formatInteger(visibleSummary.sourceTotal)}
            />
            <MetricTile
              label={node.targetStage}
              value={node.metric === "peso" ? `${formatInteger(visibleSummary.targetTotal)} kg` : formatInteger(visibleSummary.targetTotal)}
            />
            <MetricTile
              label="Macro indicador"
              value={formatPercent(visibleSummary.ratioPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              accent="success"
            />
            <MetricTile label="Ultimo corte" value={formatDate(visibleSummary.latestDate)} />
            <MetricTile
              label="Brecha"
              value={node.metric === "peso" ? `${formatInteger(visibleSummary.gapTotal)} kg` : formatInteger(visibleSummary.gapTotal)}
            />
          </KpiGrid>

          <div className="grid gap-3 rounded-[24px] border border-border/70 bg-background/80 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="balanzas-detail-search">Buscar dentro del nodo</Label>
              <Input
                id="balanzas-detail-search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar por fecha, lote, destino o valor visible..."
                className="rounded-xl"
              />
            </div>
            {tableFilters.map((entry) => (
              <MultiSelectField
                key={entry.key}
                id={`balanzas-detail-${entry.key}`}
                label={entry.label}
                value={filters[entry.key]}
                options={entry.options}
                onChange={(value) => onFilterChange(entry.key, value)}
              />
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Layers3 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold">Tabla agrupable del nodo</p>
                <p className="text-sm text-muted-foreground">
                  Agrupa por semana, dia, fecha, lote o grado segun la vista disponible.
                </p>
              </div>
            </div>
            <BalanzasGroupedTable key={node.key} node={node} rows={rows} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                  <TableProperties className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-base font-semibold">Detalle crudo del nodo</p>
                  <p className="text-sm text-muted-foreground">
                    Filas visibles despues de filtros globales y filtros locales.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {rows.length} filas visibles
              </Badge>
            </div>

            <div className="max-h-[min(42dvh,480px)] overflow-auto rounded-[24px] border border-border/70">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur">
                  <tr>
                    {visibleColumns.map((column) => (
                      <th
                        key={column.key}
                        className="border-b border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground last:border-r-0"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row, rowIndex) => (
                    <tr
                      key={row.id}
                      className={cn(
                        rowIndex % 2 === 0 ? "bg-background/84" : "bg-background/70",
                        row.ratioPct !== null && row.ratioPct < 80 && "bg-slate-500/8",
                      )}
                    >
                      {visibleColumns.map((column) => (
                        <td
                          key={`${row.id}-${column.key}`}
                          className={cn(
                            "border-b border-r border-border/50 px-3 py-2.5 align-middle text-foreground last:border-r-0",
                            column.key === ratioKey && getRatioTone(row.ratioPct),
                            column.key === sourceKey && "bg-slate-500/6",
                            column.key === targetKey && "bg-chart-success-bold/6",
                            column.key === gapKey && row.gapValue !== null && row.gapValue < 0 && "bg-slate-500/8",
                          )}
                        >
                          {formatDisplayValue(node, column, row)}
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr>
                      <td
                        colSpan={visibleColumns.length}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        No hay filas visibles para este nodo con el filtro local aplicado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </SheetShell>
  );
}
