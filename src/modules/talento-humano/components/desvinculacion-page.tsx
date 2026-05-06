"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { UserX } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type { TalentoExitData, TalentoExitFilters, TalentoExitRecord } from "@/lib/talento-humano";
import { cn } from "@/lib/utils";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { ChartSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDecimal, formatInteger, formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { ExitPeopleModal } from "@/modules/talento-humano/components/desvinculacion-people-modal";

const desvinculacionFetcher = (url: string) =>
  fetchJson<TalentoExitData>(url, "No se pudo cargar desvinculacion personal.");

const MONTH_LABELS: Record<string, string> = {
  "1": "Enero",
  "2": "Febrero",
  "3": "Marzo",
  "4": "Abril",
  "5": "Mayo",
  "6": "Junio",
  "7": "Julio",
  "8": "Agosto",
  "9": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

type ExitGroup = {
  label: string;
  count: number;
  rows: TalentoExitRecord[];
  avgCompliance: number | null;
};

type SelectedGroup = ExitGroup & { title: string };

function buildExitQueryString(filters: TalentoExitFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function groupRows(
  rows: TalentoExitRecord[],
  getLabel: (row: TalentoExitRecord) => string | null | undefined,
  limit = 12,
): ExitGroup[] {
  const grouped = new Map<string, TalentoExitRecord[]>();

  for (const row of rows) {
    const label = getLabel(row)?.trim() || "Sin dato";
    const currentRows = grouped.get(label) ?? [];
    currentRows.push(row);
    grouped.set(label, currentRows);
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

function getComplianceTone(value: number | null) {
  if (value === null) return "neutral";
  if (value > 1) return "success";
  if (value >= 0.9) return "warning";
  return "danger";
}

function toneClass(tone: ReturnType<typeof getComplianceTone>) {
  if (tone === "success") return "text-[var(--color-chart-success-bold)]";
  if (tone === "warning") return "text-[var(--color-chart-warning)]";
  if (tone === "danger") return "text-[var(--color-chart-danger)]";
  return "text-muted-foreground";
}

function BarListCard({
  title,
  subtitle,
  groups,
  onSelect,
  showCompliance = false,
}: {
  title: string;
  subtitle?: string;
  groups: ExitGroup[];
  onSelect: (group: ExitGroup) => void;
  showCompliance?: boolean;
}) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <ChartSurface title={title} subtitle={subtitle}>
      {groups.length ? (
        <div className="space-y-3">
          {groups.map((group) => {
            const ratio = total ? group.count / total : 0;
            const tone = getComplianceTone(group.avgCompliance);
            return (
              <button
                key={group.label}
                type="button"
                className="grid w-full grid-cols-[minmax(100px,0.85fr)_minmax(140px,1.25fr)_auto] items-center gap-3 rounded-[14px] px-2 py-1.5 text-left text-xs transition hover:bg-muted/55"
                onClick={() => onSelect(group)}
              >
                <span className="min-w-0 truncate font-medium">{group.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[var(--chart-line-primary)]"
                    style={{ width: `${Math.max(2, ratio * 100)}%` }}
                  />
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {formatPercent(ratio, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({formatInteger(group.count)})
                  {showCompliance ? (
                    <span className={cn("ml-2", toneClass(tone))}>
                      {formatPercent(group.avgCompliance, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState label="Sin datos disponibles para los filtros seleccionados." />
      )}
    </ChartSurface>
  );
}

function ComplianceMatrixCard({
  groups,
  onSelect,
}: {
  groups: ExitGroup[];
  onSelect: (group: ExitGroup) => void;
}) {
  return (
    <ChartSurface title="Antigüedad vs cumplimiento" subtitle="Lectura rápida de experiencia acumulada y desempeño antes de la salida.">
      {groups.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const tone = getComplianceTone(group.avgCompliance);
            return (
              <button
                key={group.label}
                type="button"
                onClick={() => onSelect(group)}
                className="rounded-[18px] border border-border/70 bg-background/70 p-4 text-left transition hover:border-primary/35 hover:bg-muted/40"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className={cn("text-2xl font-semibold tabular-nums", toneClass(tone))}>
                      {formatPercent(group.avgCompliance, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-muted-foreground">cumplimiento promedio</div>
                  </div>
                  <div className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">{formatInteger(group.count)} salidas</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState label="Sin datos para cruzar antigüedad y cumplimiento." />
      )}
    </ChartSurface>
  );
}

export function TalentoDesvinculacionPage({ initialData }: { initialData: TalentoExitData }) {
  const [filters, setFilters] = useState<TalentoExitFilters>(initialData.filters);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const initialQuery = useMemo(() => buildExitQueryString(initialData.filters), [initialData.filters]);
  const queryString = useMemo(() => buildExitQueryString(deferredFilters), [deferredFilters]);

  const { data, isValidating, mutate } = useSWR(`/api/talento-humano/desvinculacion?${queryString}`, desvinculacionFetcher, {
    fallbackData: queryString === initialQuery ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar desvinculacion personal."),
  });

  const current = data ?? initialData;
  const rows = current.rows;
  const groups = useMemo(
    () => ({
      exitReason: groupRows(rows, (row) => row.exitReason),
      resignationReason: groupRows(rows, (row) => row.resignationReason),
      resignationCategory: groupRows(rows, (row) => row.resignationCategory),
      resignationClassification: groupRows(rows, (row) => row.resignationClassification),
      compliance: groupRows(rows, (row) => row.complianceBucket, 8),
      tenure: groupRows(rows, (row) => row.tenureBucket, 8),
      socialWorker: groupRows(rows, (row) => row.associatedWorkerName, 10),
    }),
    [rows],
  );

  function setFilter<K extends keyof TalentoExitFilters>(key: K, value: TalentoExitFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function selectGroup(title: string, group: ExitGroup) {
    setSelectedGroup({ ...group, title: `${title}: ${group.label}` });
  }

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
              <SingleSelectField id="exit-filter-year" label="Año" value={filters.year} options={current.options.years} onChange={(value) => setFilter("year", value)} />
              <SingleSelectField
                id="exit-filter-month"
                label="Mes"
                value={filters.month}
                options={current.options.months}
                onChange={(value) => setFilter("month", value)}
                displayValue={(value) => MONTH_LABELS[value] ?? value}
              />
              <MultiSelectField id="exit-filter-ts" label="Trabajadora social" value={filters.associatedWorker} options={current.options.associatedWorkers} onChange={(value) => setFilter("associatedWorker", value)} />
              <MultiSelectField id="exit-filter-exit-reason" label="Motivo de salida" value={filters.exitReason} options={current.options.exitReasons} onChange={(value) => setFilter("exitReason", value)} />
              <MultiSelectField id="exit-filter-resignation-reason" label="Motivo renuncia" value={filters.resignationReason} options={current.options.resignationReasons} onChange={(value) => setFilter("resignationReason", value)} />
              <MultiSelectField id="exit-filter-category" label="Categoría" value={filters.resignationCategory} options={current.options.resignationCategories} onChange={(value) => setFilter("resignationCategory", value)} />
              <MultiSelectField id="exit-filter-classification" label="Clasificación" value={filters.resignationClassification} options={current.options.resignationClassifications} onChange={(value) => setFilter("resignationClassification", value)} />
              <MultiSelectField id="exit-filter-compliance" label="Cumplimiento" value={filters.complianceBucket} options={current.options.complianceBuckets} onChange={(value) => setFilter("complianceBucket", value)} />
              <MultiSelectField id="exit-filter-tenure" label="Antigüedad evento" value={filters.tenureBucket} options={current.options.tenureBuckets} onChange={(value) => setFilter("tenureBucket", value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setFilters(initialData.filters)}>
                Restablecer
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
                {isValidating ? "Cargando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          <KpiGrid className="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <MetricTile label="Total salidas" value={formatInteger(current.summary.totalExits)} />
            <MetricTile label="Salidas con motivo" value={formatInteger(current.summary.exitsWithReason)} />
            <MetricTile label="Categorías detectadas" value={formatInteger(current.summary.categoriesDetected)} />
            <MetricTile label="TS responsables" value={formatInteger(current.summary.socialWorkers)} />
            <MetricTile
              label="Cumplimiento promedio"
              value={formatPercent(current.summary.avgCompliance, { input: "ratio" })}
              hint="Rendimiento / mínimo"
              accent={
                getComplianceTone(current.summary.avgCompliance) === "danger"
                  ? "danger"
                  : getComplianceTone(current.summary.avgCompliance) === "warning"
                    ? "warning"
                    : "success"
              }
            />
            <MetricTile label="Antigüedad promedio" value={formatDecimal(current.summary.avgActiveMonths, 1)} hint="meses al evento" />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {rows.length ? (
        <ChartSection>
          <KpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Rendimiento promedio" value={formatPercent(current.summary.avgRendimiento, { input: "ratio" })} />
            <MetricTile label="Rendimiento mínimo" value={formatPercent(current.summary.avgRendimientoMin, { input: "ratio" })} />
            <MetricTile label="% horas rendimiento" value={formatPercent(current.summary.avgPctActualHoursRend)} />
            <MetricTile label="% absentismo total" value={formatPercent(current.summary.avgPctAbsTotal)} />
          </KpiGrid>

          <div className="grid gap-5 xl:grid-cols-2">
            <BarListCard title="Top motivos de salida" groups={groups.exitReason} onSelect={(group) => selectGroup("Motivo de salida", group)} />
            <BarListCard title="Motivos de renuncia" groups={groups.resignationReason} onSelect={(group) => selectGroup("Motivo renuncia", group)} />
            <BarListCard title="Categorías de renuncia" groups={groups.resignationCategory} onSelect={(group) => selectGroup("Categoría", group)} />
            <BarListCard title="Clasificación de renuncia" groups={groups.resignationClassification} onSelect={(group) => selectGroup("Clasificación", group)} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <BarListCard
              title="Cumplimiento al salir"
              subtitle="Segmentación por desempeño frente al rendimiento mínimo."
              groups={groups.compliance}
              onSelect={(group) => selectGroup("Cumplimiento", group)}
              showCompliance
            />
            <ComplianceMatrixCard groups={groups.tenure} onSelect={(group) => selectGroup("Antigüedad", group)} />
          </div>

          <BarListCard
            title="Resumen por trabajadora social"
            subtitle="Volumen y cumplimiento promedio asociado a cada TS."
            groups={groups.socialWorker}
            onSelect={(group) => selectGroup("Trabajadora social", group)}
            showCompliance
          />
        </ChartSection>
      ) : (
        <EmptyState label="Sin desvinculaciones para los filtros seleccionados." />
      )}

      {selectedGroup ? <ExitPeopleModal title={selectedGroup.title} rows={selectedGroup.rows} onClose={() => setSelectedGroup(null)} /> : null}
    </div>
  );
}
