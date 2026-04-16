"use client";

import { useEffect, useDeferredValue, useMemo, useState } from "react";
import { Activity, LoaderCircle, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { BlockProfileModal } from "@/modules/fenograma/components/block-profile-modal";
import { useBlockProfileModal } from "@/hooks/use-block-profile-modal";
import { MortalityCurvePanel } from "@/modules/mortality/components/mortality-curve-panel";
import { MortalityTable } from "@/modules/mortality/components/mortality-table";
import { Button } from "@/shared/ui/button";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { FilterPanel, KpiGrid, ChartSection, DetailSection } from "@/shared/layout/filter-panel";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { EmptyState } from "@/shared/data-display/empty-state";
import { fetchJson } from "@/lib/fetch-json";
import { formatFlexibleNumber as formatNumber, formatPercent } from "@/shared/lib/format";
import type { BlockModalRow } from "@/lib/fenograma";
import type {
  MortalityCurvePayload,
  MortalityDashboardData,
  MortalityDashboardRow,
  MortalityFilters,
} from "@/lib/mortality";

const mortalityDashboardFetcher = (url: string) =>
  fetchJson<MortalityDashboardData>(url, "No se pudo cargar el dashboard de mortandades.");

const mortalityCurveFetcher = (url: string) =>
  fetchJson<MortalityCurvePayload>(url, "No se pudo cargar la curva de mortandad.");

function buildQueryString(filters: MortalityFilters) {
  const params = new URLSearchParams();
  params.set("area", filters.area);
  params.set("spType", filters.spType);
  params.set("variety", filters.variety);
  params.set("parentBlock", filters.parentBlock);
  params.set("block", filters.block);
  return params.toString();
}

function buildBlockModalRow(row: MortalityDashboardRow): BlockModalRow {
  return {
    block: row.parentBlock || row.block,
    cycleKey: null,
    area: row.area,
    variety: row.variety,
    spType: row.spType,
    spDate: row.validFrom,
    harvestStartDate: null,
    harvestEndDate: row.validTo,
    totalStems: 0,
    primaryMetricLabel: "Mortandad del ciclo",
    primaryMetricText: row.mortalityPct === null ? "-" : formatPercent(row.mortalityPct),
  };
}

export function MortalityExplorer({ initialData }: { initialData: MortalityDashboardData }) {
  const [filters, setFilters] = useState<MortalityFilters>(initialData.filters);
  const [selectedBlockRow, setSelectedBlockRow] = useState<BlockModalRow | null>(null);
  const deferredFilters = useDeferredValue(filters);
  const initialFilterKey = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const filterKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);
  const blockModal = useBlockProfileModal(selectedBlockRow);
  const {
    data: dashboardData,
    error: dashboardError,
    isValidating,
    mutate,
  } = useSWR(
    `/api/mortality?${filterKey}`,
    mortalityDashboardFetcher,
    {
      fallbackData: filterKey === initialFilterKey ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );
  const data = dashboardData ?? initialData;

  useEffect(() => { if (dashboardError) toast.error(dashboardError.message || "Error al cargar datos"); }, [dashboardError]);

  const {
    data: curveData,
    error: curveError,
    isLoading: curveLoading,
  } = useSWR(
    `/api/mortality/curve?${filterKey}`,
    mortalityCurveFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
    },
  );

  function updateFilter<Key extends keyof MortalityFilters>(key: Key, value: MortalityFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(initialData.filters);
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Indicadores / Produccion / Campo"
        title="Mortandades"
        subtitle="Curva agregada ponderada por filtros y tabla de ciclos con apertura al historial completo del bloque."
        icon={<Activity className="size-6" aria-hidden="true" />}
        actions={
          <span className="text-sm tabular-nums text-muted-foreground">
            {data.summary.totalCycles} ciclos
          </span>
        }
      >
        <FilterPanel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MultiSelectField id="mortality-area" label="Área" value={filters.area} options={data.options.areas} onChange={(value) => updateFilter("area", value)} />
            <MultiSelectField id="mortality-sp-type" label="Tipo SP" value={filters.spType} options={data.options.spTypes} onChange={(value) => updateFilter("spType", value)} />
            <MultiSelectField id="mortality-variety" label="Variedad" value={filters.variety} options={data.options.varieties} onChange={(value) => updateFilter("variety", value)} />
            <MultiSelectField id="mortality-parent-block" label="Bloque padre" value={filters.parentBlock} options={data.options.parentBlocks} onChange={(value) => updateFilter("parentBlock", value)} />
            <MultiSelectField id="mortality-block" label="Bloque" value={filters.block} options={data.options.blocks} onChange={(value) => updateFilter("block", value)} />
            <div className="flex items-end">
              <Button variant="outline" className="w-full rounded-xl" onClick={resetFilters}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid>
            <MetricTile label="Mortandad ponderada" value={formatPercent(data.summary.weightedMortalityPct)} accent="danger" />
            <MetricTile label="Bajas" value={formatNumber(data.summary.totalDeadPlants)} accent="danger" />
            <MetricTile label="Resiembras" value={formatNumber(data.summary.totalReseededPlants)} accent="warning" />
            <MetricTile label="Plantas finales" value={formatNumber(data.summary.totalFinalPlants)} accent="success" />
          </KpiGrid>

          {isValidating ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Actualizando dashboard de mortandades.
            </div>
          ) : null}
          {dashboardError ? (
            <div className="flex items-center gap-3 text-sm text-destructive">
              {dashboardError.message}
              <button type="button" className="underline underline-offset-2 hover:text-destructive/80" onClick={() => mutate()}>Reintentar</button>
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      {data.rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ChartSection>
            <ChartSurface title="Curva de mortandades" subtitle="Promedio ponderado diario y acumulado segun los filtros activos.">
              <KpiGrid columns={5}>
                <MetricTile label="Ciclos visibles" value={`${data.summary.totalCycles}`} />
                <MetricTile label="Mortandad acumulada actual" value={curveData ? formatPercent(curveData.summary.lastCumulativeMortalityPct) : "-"} />
                <MetricTile label="Mortandad diaria actual" value={curveData ? formatPercent(curveData.summary.lastDailyMortalityPct) : "-"} />
                <MetricTile label="Bajas acumuladas" value={curveData ? formatNumber(curveData.summary.totalDeadPlants) : formatNumber(data.summary.totalDeadPlants)} />
                <MetricTile label="Resiembras acumuladas" value={curveData ? formatNumber(curveData.summary.totalReseededPlants) : formatNumber(data.summary.totalReseededPlants)} />
              </KpiGrid>

              {curveLoading ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Cargando curva agregada.
                </div>
              ) : curveError ? (
                <div className="text-sm text-destructive">{curveError.message}</div>
              ) : curveData?.points.length ? (
                <MortalityCurvePanel data={curveData.points} />
              ) : (
                <EmptyState label="No hay datos diarios para el corte actual." />
              )}
            </ChartSurface>
          </ChartSection>

          <DetailSection>
            <MortalityTable
              rows={data.rows}
              onOpenHistory={(row) => setSelectedBlockRow(buildBlockModalRow(row))}
            />
          </DetailSection>
        </>
      )}

      <BlockProfileModal
        row={selectedBlockRow}
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
        onClose={() => setSelectedBlockRow(null)}
      />
    </div>
  );
}
