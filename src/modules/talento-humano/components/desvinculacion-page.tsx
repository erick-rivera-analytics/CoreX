"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useState } from "react";
import { UserX } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type { TalentoExitData, TalentoExitFilters, TalentoExitRecord } from "@/lib/talento-humano";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { ChartSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDecimal, formatInteger, formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import {
  BarListCard,
  ContingencyTableCard,
  DonutBreakdownCard,
  getComplianceTone,
  SocialWorkerContingencyCard,
  type CrossGroup,
  type ExitGroup,
} from "@/modules/talento-humano/components/desvinculacion-charts";
import { ExitPeopleModal } from "@/modules/talento-humano/components/desvinculacion-people-modal";

// Recharts es pesado (~80 KB gzip). Diferimos los charts grandes
// (Scatter + AreaChart temporal) que son la última pieza visible
// del scroll para que el bundle inicial baje y la primera pintura
// del filtro/KPIs sea más rápida. ssr:false porque Recharts requiere
// window al medir el ResponsiveContainer.
const ExitScatterCard = dynamic(
  () =>
    import("@/modules/talento-humano/components/desvinculacion-charts").then((m) => ({
      default: m.ExitScatterCard,
    })),
  { ssr: false },
);
const ExitTimeSeriesCard = dynamic(
  () =>
    import("@/modules/talento-humano/components/desvinculacion-charts").then((m) => ({
      default: m.ExitTimeSeriesCard,
    })),
  { ssr: false },
);

const fetcher = (url: string) => fetchJson<TalentoExitData>(url, "No se pudo cargar desvinculacion personal.");

const MONTH_LABELS: Record<string, string> = {
  "1": "Enero", "2": "Febrero", "3": "Marzo", "4": "Abril",
  "5": "Mayo", "6": "Junio", "7": "Julio", "8": "Agosto",
  "9": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
};

type SelectedGroup = ExitGroup & { title: string };

function buildQueryString(filters: TalentoExitFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function groupRows(
  rows: TalentoExitRecord[],
  getLabel: (row: TalentoExitRecord) => string | null | undefined,
  limit = 12,
): ExitGroup[] {
  const grouped = new Map<string, TalentoExitRecord[]>();
  for (const row of rows) {
    const rawLabel = getLabel(row)?.trim();
    const label = rawLabel || "Sin dato";
    grouped.set(label, [...(grouped.get(label) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([label, currentRows]) => ({
      label,
      count: currentRows.length,
      rows: currentRows,
      avgCompliance: average(currentRows.map((row) => row.cumplimiento)),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es-EC"))
    .slice(0, limit);
}

function buildBuckets(
  rows: TalentoExitRecord[],
  getLabel: (row: TalentoExitRecord) => string | null | undefined,
) {
  const total = rows.length || 1;
  return groupRows(rows, getLabel, 999).map((group) => ({
    label: group.label,
    count: group.count,
    rows: group.rows,
    ratio: group.count / total,
  }));
}

function buildCrossGroups(
  rows: TalentoExitRecord[],
  getPrimary: (row: TalentoExitRecord) => string | null | undefined,
  getSecondary: (row: TalentoExitRecord) => string | null | undefined,
  limit = 8,
): CrossGroup[] {
  return groupRows(rows, getPrimary, limit).map((group) => ({
    ...group,
    buckets: buildBuckets(group.rows, getSecondary),
  }));
}

function buildSocialWorkerGroups(rows: TalentoExitRecord[]) {
  return groupRows(
    rows.filter((row) => Boolean(row.associatedWorkerName?.trim())),
    (row) => row.associatedWorkerName,
    9,
  ).map((group) => ({
    ...group,
    buckets: buildBuckets(group.rows, (row) => row.exitReason),
    complianceBuckets: buildBuckets(group.rows, (row) => row.complianceBucket),
    tenureBuckets: buildBuckets(group.rows, (row) => row.tenureBucket),
  }));
}

function Filter({ id, label, value, options, onChange, displayValue }: {
  id: string;
  label: string;
  value: string;
  options?: string[];
  onChange: (value: string) => void;
  displayValue?: (value: string) => string;
}) {
  return (
    <MultiSelectField
      id={id}
      label={label}
      value={value}
      options={options ?? []}
      onChange={onChange}
      displayValue={displayValue}
    />
  );
}

export function TalentoDesvinculacionPage({ initialData }: { initialData: TalentoExitData }) {
  const [filters, setFilters] = useState<TalentoExitFilters>(initialData.filters);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const deferredFilters = useDeferredValue(filters);
  const initialQuery = useMemo(() => buildQueryString(initialData.filters), [initialData.filters]);
  const queryString = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);

  const { data, isValidating, mutate } = useSWR(`/api/talento-humano/desvinculacion?${queryString}`, fetcher, {
    fallbackData: queryString === initialQuery ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar desvinculacion personal."),
  });

  const current = data ?? initialData;
  const rows = current.rows;
  const options = current.options;
  const groups = useMemo(() => ({
    exitReason: groupRows(rows, (row) => row.exitReason, 12),
    resignationReason: groupRows(rows, (row) => row.resignationReason, 12),
    resignationCategory: groupRows(rows, (row) => row.resignationCategory, 12),
    resignationClassification: groupRows(rows, (row) => row.resignationClassification, 12),
    compliance: groupRows(rows, (row) => row.complianceBucket, 8),
    tenure: groupRows(rows, (row) => row.tenureBucket, 8),
    reasonCompliance: buildCrossGroups(rows, (row) => row.exitReason, (row) => row.complianceBucket),
    reasonTenure: buildCrossGroups(rows, (row) => row.exitReason, (row) => row.tenureBucket),
    tenureCompliance: buildCrossGroups(rows, (row) => row.tenureBucket, (row) => row.complianceBucket, 8),
    socialWorker: buildSocialWorkerGroups(rows),
  }), [rows]);

  function setFilter<K extends keyof TalentoExitFilters>(key: K, value: TalentoExitFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function selectGroup(title: string, group: ExitGroup) {
    setSelectedGroup({ ...group, title: `${title}: ${group.label}` });
  }

  const complianceTone = getComplianceTone(current.summary.avgCompliance);
  const topReason = groups.exitReason.find((group) => group.label !== "Sin dato") ?? groups.exitReason[0] ?? null;

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Talento Humano / Indicadores & KPI"
        title="Desvinculación personal"
        subtitle="Motivos de salida, antigüedad del evento, rendimiento y señales de cumplimiento antes de la desvinculación."
        icon={<UserX className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <div className="space-y-4 overflow-visible">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              <Filter id="exit-filter-year" label="Año" value={filters.year} options={options.years} onChange={(value) => setFilter("year", value)} />
              <Filter id="exit-filter-month" label="Mes" value={filters.month} options={options.months} onChange={(value) => setFilter("month", value)} displayValue={(value) => MONTH_LABELS[value] ?? value} />
              <Filter id="exit-filter-area-general" label="Área general" value={filters.areaGeneral} options={options.areaGenerals} onChange={(value) => setFilter("areaGeneral", value)} />
              <Filter id="exit-filter-area" label="Área" value={filters.area} options={options.areas} onChange={(value) => setFilter("area", value)} />
              <Filter id="exit-filter-job-title" label="Cargo" value={filters.jobTitle} options={options.jobTitles} onChange={(value) => setFilter("jobTitle", value)} />
              <Filter id="exit-filter-job-classification" label="Clasificación" value={filters.jobClassification} options={options.jobClassifications} onChange={(value) => setFilter("jobClassification", value)} />
              <Filter id="exit-filter-ts" label="Trabajadora social" value={filters.associatedWorker} options={options.associatedWorkers} onChange={(value) => setFilter("associatedWorker", value)} />
              <Filter id="exit-filter-exit-reason" label="Motivo de salida" value={filters.exitReason} options={options.exitReasons} onChange={(value) => setFilter("exitReason", value)} />
              <Filter id="exit-filter-resignation-reason" label="Motivo renuncia" value={filters.resignationReason} options={options.resignationReasons} onChange={(value) => setFilter("resignationReason", value)} />
              <Filter id="exit-filter-category" label="Categoría" value={filters.resignationCategory} options={options.resignationCategories} onChange={(value) => setFilter("resignationCategory", value)} />
              <Filter id="exit-filter-classification" label="Clasificación renuncia" value={filters.resignationClassification} options={options.resignationClassifications} onChange={(value) => setFilter("resignationClassification", value)} />
              <Filter id="exit-filter-compliance" label="Cumplimiento" value={filters.complianceBucket} options={options.complianceBuckets} onChange={(value) => setFilter("complianceBucket", value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setFilters(initialData.filters)}>Restablecer</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
                {isValidating ? "Cargando..." : "Actualizar"}
              </Button>
            </div>
          </div>
          <KpiGrid className="grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            <MetricTile label="Total salidas" value={formatInteger(current.summary.totalExits)} />
            <MetricTile
              label="Motivo top"
              value={topReason ? formatInteger(topReason.count) : "-"}
              hint={topReason?.label ?? "Sin datos"}
            />
            <MetricTile label="Cumplimiento promedio" value={formatPercent(current.summary.avgCompliance, { input: "ratio" })} hint="Rendimiento / mínimo" accent={complianceTone === "danger" ? "danger" : complianceTone === "warning" ? "warning" : "success"} />
            <MetricTile label="Antigüedad promedio" value={formatDecimal(current.summary.avgActiveMonths, 1)} hint="meses al evento" />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {rows.length ? (
        <ChartSection>
          {/* Métricas secundarias */}
          <KpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Rendimiento promedio" value={formatPercent(current.summary.avgRendimiento, { input: "ratio" })} />
            <MetricTile label="Rendimiento mínimo" value={formatPercent(current.summary.avgRendimientoMin, { input: "ratio" })} />
            <MetricTile label="% horas rendimiento" value={formatPercent(current.summary.avgPctActualHoursRend)} />
            <MetricTile label="% ausentismo total" value={formatPercent(current.summary.avgPctAbsTotal)} />
          </KpiGrid>

          {/* Composición principal: 4 donuts canon (los 4 ejes de análisis) */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <DonutBreakdownCard
              title="Motivo de salida"
              groups={groups.exitReason}
              onSelect={(group) => selectGroup("Motivo de salida", group)}
            />
            <DonutBreakdownCard
              title="Motivo de renuncia"
              groups={groups.resignationReason}
              onSelect={(group) => selectGroup("Motivo renuncia", group)}
            />
            <DonutBreakdownCard
              title="Categoría de renuncia"
              groups={groups.resignationCategory}
              onSelect={(group) => selectGroup("Categoría", group)}
            />
            <DonutBreakdownCard
              title="Clasificación de renuncia"
              groups={groups.resignationClassification}
              onSelect={(group) => selectGroup("Clasificación", group)}
            />
          </div>

          {/* Mapa interpretativo de salidas — full width para que se lea bien */}
          <ExitScatterCard rows={rows} />

          {/* Análisis de cumplimiento y antigüedad: BarLists pares */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))] gap-5">
            <BarListCard
              title="Cumplimiento al salir"
              subtitle="Segmentación por desempeño frente al rendimiento mínimo."
              groups={groups.compliance}
              onSelect={(group) => selectGroup("Cumplimiento", group)}
              showCompliance
            />
            <BarListCard
              title="Antigüedad al salir"
              subtitle="Rangos de meses al momento de la salida (con cumplimiento prom. del grupo)."
              groups={groups.tenure}
              onSelect={(group) => selectGroup("Antigüedad", group)}
              showCompliance
            />
          </div>

          {/* Tablas de contingencia — full width para que las columnas no se ahoguen */}
          <ContingencyTableCard
            title="Motivo de salida × cumplimiento"
            subtitle="Tabla de contingencia: filas por motivo, columnas por cumplimiento. Click en fila abre listado de personas."
            groups={groups.reasonCompliance}
            onSelect={(group) => selectGroup("Motivo de salida", group)}
          />
          <ContingencyTableCard
            title="Antigüedad × cumplimiento"
            subtitle="Tabla de contingencia: filas por antigüedad, columnas por cumplimiento."
            groups={groups.tenureCompliance}
            onSelect={(group) => selectGroup("Antigüedad", group)}
          />

          {/* Trabajadora social — matriz cross full-width */}
          <SocialWorkerContingencyCard
            groups={groups.socialWorker}
            onSelect={(group) => selectGroup("Trabajadora social", group)}
          />

          {/* Bloque temporal AL FINAL: AreaChart de salidas por mes */}
          <ExitTimeSeriesCard rows={rows} />
        </ChartSection>
      ) : (
        <EmptyState label="Sin desvinculaciones para los filtros seleccionados." />
      )}
      {selectedGroup ? <ExitPeopleModal title={selectedGroup.title} rows={selectedGroup.rows} onClose={() => setSelectedGroup(null)} /> : null}
    </div>
  );
}
