"use client";

import { useEffect, useDeferredValue, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle, RefreshCcw, Scale } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { BalanzasNodeDetailSheet } from "@/modules/postcosecha/components/balanzas-node-detail-sheet";
import {
  createNodeLocalFilters,
  DEFAULT_NODE_LOCAL_FILTERS,
  type NodeLocalFilters,
} from "@/modules/postcosecha/lib/balanzas-node-format";
import { BalanzasProcessDashboard } from "@/modules/postcosecha/components/balanzas-process-dashboard";
import type { BalanzasProcessSelection } from "@/modules/postcosecha/lib/balanzas-process-stages";
import { Button } from "@/shared/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import { matchesMultiSelectValue } from "@/lib/multi-select";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { ChartSection, FilterPanel } from "@/shared/layout/filter-panel";
import { DateField } from "@/shared/filters/date-field";
import { EmptyState } from "@/shared/data-display/empty-state";
import type {
  BalanzasDashboardData,
  BalanzasFilters,
  BalanzasNodeData,
  BalanzasTableRow,
} from "@/lib/postcosecha-balanzas";

type BalanzasExplorerProps = {
  initialData: BalanzasDashboardData;
  initialError?: string | null;
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

export function BalanzasExplorer({
  initialData,
  initialError,
}: BalanzasExplorerProps) {
  const [filters, setFilters] = useState<BalanzasFilters>(initialData.filters);
  const [selection, setSelection] = useState<BalanzasProcessSelection | null>(null);
  const [stableSelectedNode, setStableSelectedNode] = useState<BalanzasNodeData | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
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

  useEffect(() => {
    if (dashboardError) {
      toast.error(dashboardError.message || "Error al cargar datos");
    }
  }, [dashboardError]);

  const activeMessage = dashboardError?.message ?? data.summary.statusMessage ?? initialError ?? null;
  const weekOptions = data.options.isoWeeks;
  const effectiveWeekValue = data.filters.weekValue;
  const liveSelectedNode = selection
    ? data.nodes.find((node) => node.key === selection.nodeKey) ?? null
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

  function handleSelectionChange(nextSelection: BalanzasProcessSelection | null) {
    setSelection((current) => {
      if (current?.nodeKey !== nextSelection?.nodeKey) {
        setDetailSearch("");
        setDetailFilters(createNodeLocalFilters());
      }
      return nextSelection;
    });
    setDetailSheetOpen(false);

    if (!nextSelection) {
      setStableSelectedNode(null);
      return;
    }

    const liveNode = data.nodes.find((node) => node.key === nextSelection.nodeKey) ?? null;
    if (liveNode) {
      setStableSelectedNode(liveNode);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Indicadores / Produccion / Poscosecha"
        title="Indicadores Balanzas"
        subtitle="Viewer operativo por rutas reales. Cada caja azul es un chart clicable y cada boton GENERAL agrega la rama completa del flujo."
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
              label="Años"
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
              label="Dia"
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
                  {dashboardError ? (
                    <button
                      type="button"
                      className="mt-2 text-sm underline underline-offset-2 opacity-80 hover:opacity-100"
                      onClick={() => mutate()}
                    >
                      Reintentar
                    </button>
                  ) : null}
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
          <BalanzasProcessDashboard
            assetPath={data.processAssetPath}
            metricLabel={data.metricLabel}
            nodes={data.nodes}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onExpandDetail={() => {
              if (selectedNode) {
                setDetailSheetOpen(true);
              }
            }}
          />
        </ChartSection>
      )}

      {selectedNode ? (
        <BalanzasNodeDetailSheet
          node={selectedNode}
          rows={filteredDetailRows}
          search={detailSearch}
          filters={detailFilters}
          open={detailSheetOpen}
          onSearchChange={setDetailSearch}
          onFilterChange={updateDetailFilter}
          onClose={() => setDetailSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
