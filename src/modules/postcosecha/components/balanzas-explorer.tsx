"use client";

import { useEffect, useDeferredValue, useMemo, useState } from "react";
import {
  AlertCircle,
  Layers3,
  LoaderCircle,
  RefreshCcw,
  Scale,
  TableProperties,
} from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { BalanzasGroupedTable } from "@/modules/postcosecha/components/balanzas-grouped-table";
import { BalanzasProcessViewer } from "@/modules/postcosecha/components/balanzas-process-viewer";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatDate, formatDecimal, formatInteger } from "@/shared/lib/format";
import { fetchJson } from "@/lib/fetch-json";
import { matchesMultiSelectValue } from "@/lib/multi-select";
import { cn } from "@/lib/utils";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { ChartSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { DateField } from "@/shared/filters/date-field";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import type {
  BalanzasDashboardData,
  BalanzasFilters,
  BalanzasNodeData,
  BalanzasNodeKey,
  BalanzasTableColumn,
  BalanzasTableRow,
} from "@/lib/postcosecha-balanzas";

type BalanzasExplorerProps = {
  initialData: BalanzasDashboardData;
  initialError?: string | null;
};

type NodeLocalFilters = {
  destination: string;
  grade: string;
  lot: string;
  hydrationDays: string;
  isoWeek: string;
  dayName: string;
  month: string;
  date: string;
};

const DEFAULT_NODE_LOCAL_FILTERS: NodeLocalFilters = {
  destination: "all",
  grade: "all",
  lot: "all",
  hydrationDays: "all",
  isoWeek: "all",
  dayName: "all",
  month: "all",
  date: "all",
};

const balanzasFetcher = (url: string) =>
  fetchJson<BalanzasDashboardData>(url, "No se pudo cargar Indicadores Balanzas.");

function buildQueryString(filters: BalanzasFilters) {
  const params = new URLSearchParams();

  params.set("metric", filters.metric);
  params.set("year", filters.year);
  params.set("month", filters.month);
  params.set("dayName", filters.dayName);
  params.set("destination", filters.destination);
  params.set("weekMode", "iso");
  params.set("weekValue", filters.weekValue);
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  return params.toString();
}


function formatDisplayValue(
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

    return `${numericValue.toFixed(1)}%`;
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

function getRatioTone(value: number | null) {
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

function buildNodeHeadline(node: BalanzasNodeData) {
  return `${node.compareLabel} | Rama BPMN: ${node.bpmnBranch}`;
}

function buildVisibleSummary(node: BalanzasNodeData, rows: BalanzasTableRow[]) {
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

function NodeDetailModal({
  node,
  rows,
  search,
  filters,
  onSearchChange,
  onFilterChange,
  onClose,
}: {
  node: BalanzasNodeData;
  rows: BalanzasTableRow[];
  search: string;
  filters: NodeLocalFilters;
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
    {
      key: "grade" as const,
      label: "Grado",
      options: node.localOptions.grades,
    },
    {
      key: "lot" as const,
      label: "Lote",
      options: node.localOptions.lots,
    },
    {
      key: "hydrationDays" as const,
      label: "Dias de hidratacion",
      options: node.localOptions.hydrationDays,
    },
    {
      key: "isoWeek" as const,
      label: "Semana",
      options: node.localOptions.isoWeeks,
    },
    {
      key: "dayName" as const,
      label: "Dia",
      options: node.localOptions.dayNames,
    },
    {
      key: "month" as const,
      label: "Mes",
      options: node.localOptions.months,
    },
    {
      key: "date" as const,
      label: "Fecha",
      options: node.localOptions.dates,
    },
  ].filter((entry) => entry.options.length > 1);

  return (
    <DialogShell
      title={buildNodeHeadline(node)}
      description={node.description}
      onClose={onClose}
      maxWidth="max-w-[1560px]"
      headerActions={
        <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {node.label}
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {node.branchLabel}
              </Badge>
              {node.sourceView ? (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {node.sourceView}
                </Badge>
              ) : null}
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
                  label="Macro indicador"
                  value={visibleSummary.ratioPct === null ? "-" : `${visibleSummary.ratioPct.toFixed(1)}%`}
                  accent="success"
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
                  label="Brecha"
                  value={node.metric === "peso" ? `${formatInteger(visibleSummary.gapTotal)} kg` : formatInteger(visibleSummary.gapTotal)}
                />
                <MetricTile label="Ultimo corte" value={formatDate(visibleSummary.latestDate)} />
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
                  <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
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
                    <div className="rounded-full bg-slate-900/10 dark:bg-slate-900/20 p-3 text-slate-700 dark:text-white">
                      <TableProperties className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Detalle crudo del tramo</p>
                      <p className="text-sm text-muted-foreground">
                        Filas visibles del nodo despues de filtros globales y filtros locales.
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
    </DialogShell>
  );
}

export function BalanzasExplorer({
  initialData,
  initialError,
}: BalanzasExplorerProps) {
  const [filters, setFilters] = useState<BalanzasFilters>(initialData.filters);
  const [selectedNodeKey, setSelectedNodeKey] = useState<BalanzasNodeKey | null>(null);
  const [stableSelectedNode, setStableSelectedNode] = useState<BalanzasNodeData | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailFilters, setDetailFilters] = useState<NodeLocalFilters>(DEFAULT_NODE_LOCAL_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const initialFilterKey = useMemo(
    () => buildQueryString(initialData.filters),
    [initialData.filters],
  );
  const filterKey = useMemo(
    () => buildQueryString(deferredFilters),
    [deferredFilters],
  );
  const {
    data: dashboardData,
    error: dashboardError,
    isValidating,
    mutate,
  } = useSWR(
    `/api/postcosecha/balanzas?${filterKey}`,
    balanzasFetcher,
    {
      fallbackData: filterKey === initialFilterKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );
  const data = dashboardData ?? initialData;

  useEffect(() => { if (dashboardError) toast.error(dashboardError.message || "Error al cargar datos"); }, [dashboardError]);

  const activeMessage = dashboardError?.message ?? data.summary.statusMessage ?? initialError ?? null;
  const weekOptions = data.options.isoWeeks;
  const effectiveWeekValue = data.filters.weekValue;
  const liveSelectedNode = selectedNodeKey
    ? data.nodes.find((node) => node.key === selectedNodeKey) ?? null
    : null;
  const selectedNode = liveSelectedNode ?? stableSelectedNode;

  const filteredDetailRows = useMemo(() => {
    if (!selectedNode) {
      return [] as BalanzasTableRow[];
    }

    const search = detailSearch.trim().toLowerCase();

    return selectedNode.rows.filter((row) => {
      const filterChecks: Array<[string, string | null]> = [
        [detailFilters.destination, selectedNode.columnMap.destination],
        [detailFilters.grade, selectedNode.columnMap.grade],
        [detailFilters.lot, selectedNode.columnMap.lot],
        [detailFilters.hydrationDays, selectedNode.columnMap.hydrationDays],
        [detailFilters.isoWeek, selectedNode.columnMap.isoWeek],
        [detailFilters.dayName, selectedNode.columnMap.dayName],
        [detailFilters.month, selectedNode.columnMap.month],
        [detailFilters.date, selectedNode.columnMap.date],
      ];

      for (const [filterValue, columnKey] of filterChecks) {
        if (!columnKey) {
          continue;
        }

        if (!matchesMultiSelectValue(filterValue, String(row.values[columnKey] ?? ""))) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      return Object.values(row.values).some((value) => String(value ?? "").toLowerCase().includes(search));
    });
  }, [detailFilters, detailSearch, selectedNode]);

  function updateFilter<Key extends keyof BalanzasFilters>(
    key: Key,
    value: BalanzasFilters[Key],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateDetailFilter<Key extends keyof NodeLocalFilters>(key: Key, value: NodeLocalFilters[Key]) {
    setDetailFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetFilters() {
    setFilters(initialData.filters);
  }

  function openNode(nodeKey: BalanzasNodeKey, destination: string | null = null) {
    const liveNode = data.nodes.find((node) => node.key === nodeKey);
    setDetailSearch("");
    setDetailFilters({
      ...DEFAULT_NODE_LOCAL_FILTERS,
      destination: nodeKey === "b2a" && destination ? destination : "all",
    });
    if (liveNode) {
      setStableSelectedNode(liveNode);
    }
    setSelectedNodeKey(nodeKey);
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Indicadores / Produccion / Poscosecha"
        title="Indicadores Balanzas"
        subtitle={`Rama instrumentada: Apertura -> Apertura pelado patas -> BAL2 -> BAL2A. Los filtros globales solo trabajan con fecha y cada nodo abre su detalle flotante.`}
        icon={<Scale className="size-5" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {(["peso", "tallos"] as const).map((metric) => (
              <Button
                key={metric}
                variant={filters.metric === metric ? "secondary" : "outline"}
                className="rounded-full"
                onClick={() => updateFilter("metric", metric)}
              >
                {metric === "peso" ? "Peso" : "Tallos"}
              </Button>
            ))}
          </div>
        }
      >
        <FilterPanel>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <MultiSelectField
              id="balanzas-year"
              label={"A\u00f1os"}
              value={filters.year}
              options={data.options.years}
              onChange={(value) => updateFilter("year", value)}
            />
            <MultiSelectField
              id="balanzas-month"
              label="Meses"
              value={filters.month}
              options={data.options.months}
              onChange={(value) => updateFilter("month", value)}
            />
            <MultiSelectField
              id="balanzas-day-name"
              label="Día"
              value={filters.dayName}
              options={data.options.dayNames}
              onChange={(value) => updateFilter("dayName", value)}
            />
            <MultiSelectField
              id="balanzas-week"
              label="Semana"
              value={effectiveWeekValue}
              options={weekOptions}
              onChange={(value) => updateFilter("weekValue", value)}
              emptyLabel="Ultima disponible"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(2,minmax(0,1fr))_200px]">
            <DateField
              id="balanzas-date-from"
              label="Fecha desde"
              value={filters.dateFrom}
              onChange={(value) => updateFilter("dateFrom", value)}
            />
            <DateField
              id="balanzas-date-to"
              label="Fecha hasta"
              value={filters.dateTo}
              onChange={(value) => updateFilter("dateTo", value)}
            />
            <div className="flex items-end">
              <Button variant="outline" className="w-full rounded-xl" onClick={resetFilters}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          {isValidating ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Actualizando indicadores de balanzas.
            </div>
          ) : null}

          {activeMessage ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">Estado del origen</p>
                  <p className="mt-1 text-sm opacity-90">{activeMessage}</p>
                  {dashboardError ? <button type="button" className="mt-2 text-sm underline underline-offset-2 opacity-80 hover:opacity-100" onClick={() => mutate()}>Reintentar</button> : null}
                </div>
              </div>
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      {data.nodes.length === 0 ? (
        <EmptyState label="No hay nodos de balanzas disponibles para el periodo seleccionado." />
      ) : (
        <ChartSection>
          <ChartSurface
            title="Flujo de postcosecha"
            subtitle='Rama instrumentada: Apertura -> Apertura pelado patas -> BAL2 -> BAL2A. En el ultimo tramo el flujo se abre en Arcoiris, Tinturado y Blanco.'
          >
            <BalanzasProcessViewer
              assetPath={data.processAssetPath}
              metricLabel={data.metricLabel}
              nodes={data.nodes}
              selectedNodeKey={selectedNodeKey}
              onNodeSelect={openNode}
            />
          </ChartSurface>
        </ChartSection>
      )}

      {selectedNode ? (
        <NodeDetailModal
          node={selectedNode}
          rows={filteredDetailRows}
          search={detailSearch}
          filters={detailFilters}
          onSearchChange={setDetailSearch}
          onFilterChange={updateDetailFilter}
          onClose={() => { setSelectedNodeKey(null); setStableSelectedNode(null); }}
        />
      ) : null}
    </div>
  );
}
