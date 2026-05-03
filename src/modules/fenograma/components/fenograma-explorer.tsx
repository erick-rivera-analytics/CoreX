"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { LoaderCircle, RefreshCcw, Sprout } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import useSWR from "swr";
import { toast } from "sonner";

import { BlockProfileModal } from "@/modules/fenograma/components/block-profile-modal";
import { useBlockProfileModal } from "@/hooks/use-block-profile-modal";
import { FenogramaMetricSelector } from "@/modules/fenograma/components/fenograma-metric-selector";
import { FenogramaPivotTable } from "@/modules/fenograma/components/fenograma-pivot-table";
import { FenogramaWeeklyBarsChart } from "@/modules/fenograma/components/fenograma-weekly-bars-chart";
import { Button } from "@/shared/ui/button";
import { formatDate, formatInteger, formatIsoWeekLabel } from "@/shared/lib/format";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { DetailSection, FilterPanel, KpiGrid, ChartSection } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { ToggleChipGroup } from "@/shared/filters/toggle-chip-group";
import { EmptyState } from "@/shared/data-display/empty-state";
import { fetchJson } from "@/lib/fetch-json";
import { FENOGRAMA_METRIC_DEFAULT, type FenogramaMetric } from "@/lib/fenograma-types";
import type {
  FenogramaDashboardData,
  FenogramaFilters,
  FenogramaLifecycle,
  FenogramaPivotRow,
} from "@/lib/fenograma";

const fenogramaFetcher = (url: string) =>
  fetchJson<FenogramaDashboardData>(url, "No se pudo filtrar el fenograma.");

function buildQueryString(filters: FenogramaFilters) {
  const params = new URLSearchParams();
  params.set("includeActive", String(filters.includeActive));
  params.set("includePlanned", String(filters.includePlanned));
  params.set("includeHistory", String(filters.includeHistory));
  params.set("area", filters.area);
  params.set("variety", filters.variety);
  params.set("spType", filters.spType);
  params.set("startWeek", filters.startWeek);
  params.set("endWeek", filters.endWeek);
  return params.toString();
}

const lifecycleOptions: { value: FenogramaLifecycle; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "planned", label: "Planificados" },
  { value: "history", label: "Históricos" },
];

const lifecycleFilterKeys: Record<FenogramaLifecycle, "includeActive" | "includePlanned" | "includeHistory"> = {
  active: "includeActive",
  planned: "includePlanned",
  history: "includeHistory",
};

export function FenogramaExplorer({ initialData }: { initialData: FenogramaDashboardData }) {
  const [filters, setFilters] = useState<FenogramaFilters>(initialData.filters);
  const [selectedRow, setSelectedRow] = useState<FenogramaPivotRow | null>(null);
  /**
   * Estado del selector de métrica.
   *
   * NO se resetea con `Restablecer` — el usuario lo elige independientemente
   * de los filtros. La métrica activa se propaga a tabla y chart.
   */
  const [metric, setMetric] = useState<FenogramaMetric>(FENOGRAMA_METRIC_DEFAULT);
  const deferredFilters = useDeferredValue(filters);
  const initialFilterKey = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const filterKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);
  const {
    data: dashboardData,
    error: dashboardError,
    isValidating,
    mutate,
  } = useSWR(
    `/api/fenograma/pivot?${filterKey}`,
    fenogramaFetcher,
    {
      fallbackData: filterKey === initialFilterKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (err) => toast.error(err?.message || "Error al cargar datos"),
    },
  );
  const data = dashboardData ?? initialData;
  const blockModal = useBlockProfileModal(selectedRow);

  function updateFilter<Key extends keyof FenogramaFilters>(key: Key, value: FenogramaFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateWeekRange(boundary: "startWeek" | "endWeek", value: string) {
    setFilters((current) => {
      const nextFilters = {
        ...current,
        [boundary]: value,
      };

      if (
        nextFilters.startWeek
        && nextFilters.endWeek
        && Number(nextFilters.startWeek) > Number(nextFilters.endWeek)
      ) {
        if (boundary === "startWeek") {
          nextFilters.endWeek = value;
        } else {
          nextFilters.startWeek = value;
        }
      }

      return nextFilters;
    });
  }

  function resetFilters() {
    setFilters(initialData.filters);
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Campo"
        title="Fenograma"
        subtitle="Pivot semanal por dimensiones con rango manual, estados operativos y apertura a la ficha completa del ciclo."
        icon={<Sprout className="size-6" aria-hidden="true" />}
        actions={<FenogramaMetricSelector value={metric} onChange={setMetric} />}
      >
        <FilterPanel>
          <ToggleChipGroup
            options={lifecycleOptions}
            selected={lifecycleOptions.flatMap((o) => (filters[lifecycleFilterKeys[o.value]] ? [o.value] : []))}
            onChange={(selected) => {
              setFilters((current) => ({
                ...current,
                includeActive: selected.includes("active"),
                includePlanned: selected.includes("planned"),
                includeHistory: selected.includes("history"),
              }));
            }}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MultiSelectField id="fenograma-area" label="Área" value={filters.area} options={data.options.areas} onChange={(value) => updateFilter("area", value)} />
            <MultiSelectField id="fenograma-variety" label="Variedad" value={filters.variety} options={data.options.varieties} onChange={(value) => updateFilter("variety", value)} />
            <MultiSelectField id="fenograma-sp-type" label="Tipo SP" value={filters.spType} options={data.options.spTypes} onChange={(value) => updateFilter("spType", value)} />
            <SingleSelectField id="fenograma-start-week" label="Semana desde" value={filters.startWeek} options={data.availableWeeks} emptyLabel="Inicio disponible" displayValue={formatIsoWeekLabel} onChange={(value) => updateWeekRange("startWeek", value)} />
            <SingleSelectField id="fenograma-end-week" label="Semana hasta" value={filters.endWeek} options={data.availableWeeks} emptyLabel="Fin disponible" displayValue={formatIsoWeekLabel} onChange={(value) => updateWeekRange("endWeek", value)} />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium leading-none">Rango visible</p>
              <div className="rounded-[24px] border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                <p>{data.summary.firstWeek ?? "-"} a {data.summary.lastWeek ?? "-"}</p>
                <p className="mt-1 text-xs">{data.availableWeeks.length} semanas disponibles en el dataset.</p>
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={resetFilters}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid>
            <MetricTile label="Activos" value={formatInteger(data.summary.activeRows)} />
            <MetricTile label="Planificados" value={formatInteger(data.summary.plannedRows)} />
            <MetricTile label="Históricos" value={formatInteger(data.summary.historyRows)} />
            <MetricTile label="Hoy" value={formatDate(data.today)} />
          </KpiGrid>

          {!dashboardData && isValidating ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          ) : isValidating ? <div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Actualizando fenograma.</div> : null}
          {dashboardError ? <div className="flex items-center gap-3 text-sm text-destructive">{dashboardError.message}<button type="button" className="underline underline-offset-2 hover:text-destructive/80" onClick={() => mutate()}>Reintentar</button></div> : null}
        </FilterPanel>
      </SectionPageShell>

      <ChartSection>
        <ChartSurface title="Acumulado semanal">
          <FenogramaWeeklyBarsChart data={data.weeklyTotals} metric={metric} />
        </ChartSurface>
      </ChartSection>

      <DetailSection>
        {data.rows.length === 0 ? <EmptyState /> : <FenogramaPivotTable data={data} metric={metric} onRowSelect={setSelectedRow} />}
      </DetailSection>

      <BlockProfileModal
        row={selectedRow}
        data={blockModal.blockData}
        loading={blockModal.blockLoading}
        error={blockModal.blockError}
        selectedCycleKey={blockModal.selectedCycleKey}
        bedData={blockModal.bedData}
        bedLoading={blockModal.bedLoading}
        bedError={blockModal.bedError}
        selectedValveCycleKey={blockModal.selectedValveCycleKey}
        valvesData={blockModal.valvesData}
        valvesLoading={blockModal.valvesLoading}
        valvesError={blockModal.valvesError}
        selectedValve={blockModal.selectedValve}
        valveData={blockModal.valveData}
        valveLoading={blockModal.valveLoading}
        valveError={blockModal.valveError}
        selectedCurveCycleKey={blockModal.selectedCurveCycleKey}
        curveData={blockModal.curveData}
        curveLoading={blockModal.curveLoading}
        curveError={blockModal.curveError}
        selectedMortalityCurve={blockModal.selectedMortalityCurve}
        mortalityCurveData={blockModal.mortalityCurveData}
        mortalityCurveLoading={blockModal.mortalityCurveLoading}
        mortalityCurveError={blockModal.mortalityCurveError}
        onOpenBeds={blockModal.openBeds}
        onCloseBeds={blockModal.closeBeds}
        onOpenValves={blockModal.openValves}
        onCloseValves={blockModal.closeValves}
        onOpenValve={blockModal.openValve}
        onOpenCurve={blockModal.openCurve}
        onCloseCurve={blockModal.closeCurve}
        onOpenCycleMortalityCurve={blockModal.openCycleMortalityCurve}
        onOpenValveMortalityCurve={blockModal.openValveMortalityCurve}
        onOpenBedMortalityCurve={blockModal.openBedMortalityCurve}
        onCloseMortalityCurve={blockModal.closeMortalityCurve}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
