"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download, X } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  VacationSimulatorData,
  VacationSimulatorFilters,
} from "@/lib/talento-humano-vacaciones";
import { VacationCharts } from "@/modules/talento-humano/components/simulador-vacaciones-charts";
import { VacationDetailTable } from "@/modules/talento-humano/components/simulador-vacaciones-table";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { DateField, MultiSelectField } from "@/shared/filters";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDateSlash, formatInteger } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

function vacationFetcher(url: string) {
  return fetchJson<VacationSimulatorData>(url, "No se pudo cargar el simulador de vacaciones.");
}

function buildQuery(filters: VacationSimulatorFilters): string {
  const params = new URLSearchParams();
  params.set("corteDate", filters.corteDate);
  if (filters.area && filters.area !== "all") params.set("area", filters.area);
  if (filters.jobClassification && filters.jobClassification !== "all") {
    params.set("jobClassification", filters.jobClassification);
  }
  if (filters.associatedWorker && filters.associatedWorker !== "all") {
    params.set("associatedWorker", filters.associatedWorker);
  }
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

function defaultFilters(corteDate: string): VacationSimulatorFilters {
  return {
    corteDate,
    area: "all",
    jobClassification: "all",
    associatedWorker: "all",
    q: "",
  };
}

export function SimuladorVacacionesPage({ initialData }: { initialData: VacationSimulatorData }) {
  const [filters, setFilters] = useState<VacationSimulatorFilters>(initialData.filters);

  const query = buildQuery(filters);
  const url = `/api/talento-humano/simulador-vacaciones?${query}`;

  const { data, error, isValidating, mutate } = useSWR<VacationSimulatorData>(url, vacationFetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 30_000,
  });

  const payload = data ?? initialData;
  const rows = payload.rows;
  const summary = payload.summary;

  const updateFilter = <K extends keyof VacationSimulatorFilters>(key: K, value: VacationSimulatorFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    const today = new Date().toISOString().slice(0, 10);
    setFilters(defaultFilters(today));
  };

  const handleExport = () => {
    window.location.href = `/api/talento-humano/simulador-vacaciones/export-xlsx?${query}`;
  };

  const areasList = useMemo(() => payload.options?.areas ?? [], [payload.options?.areas]);
  const classificationsList = useMemo(
    () => payload.options?.jobClassifications ?? [],
    [payload.options?.jobClassifications],
  );
  const associatedWorkersList = useMemo(
    () => payload.options?.associatedWorkers ?? [],
    [payload.options?.associatedWorkers],
  );

  const areaOptions = useMemo(() => areasList.map((entry) => entry.id), [areasList]);
  const areaLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of areasList) {
      map.set(entry.id, entry.name);
    }
    return map;
  }, [areasList]);

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Talento Humano / Explorador"
        title="Simulador de Vacaciones"
        subtitle="Provisión y disponibilidad de vacaciones por colaborador activo según la fecha de corte. Acumulado = piso(antigüedad ÷ 30 × 1.25)."
        icon={<CalendarDays className="size-6" aria-hidden="true" />}
        actions={(
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" aria-hidden="true" />
            Exportar
          </Button>
        )}
      >
        <FilterPanel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <DateField
              id="vac-corte"
              label="Fecha de corte"
              value={filters.corteDate}
              onChange={(value) => updateFilter("corteDate", value)}
            />
            <MultiSelectField
              id="vac-area"
              label="Área"
              value={filters.area}
              options={areaOptions}
              displayValue={(id) => areaLabelMap.get(id) ?? id}
              onChange={(value) => updateFilter("area", value)}
            />
            <MultiSelectField
              id="vac-clasif"
              label="Clasificación"
              value={filters.jobClassification}
              options={classificationsList}
              onChange={(value) => updateFilter("jobClassification", value)}
            />
            <MultiSelectField
              id="vac-trabajadora"
              label="Trabajadora asociada"
              value={filters.associatedWorker}
              options={associatedWorkersList}
              onChange={(value) => updateFilter("associatedWorker", value)}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleReset}
                aria-label="Restablecer filtros"
              >
                <X className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            </div>
          </div>

          <KpiGrid columns={4}>
            <MetricTile
              label="Total colaboradores"
              value={formatInteger(summary.totalCollaborators)}
              hint={`Activos al ${formatDateSlash(payload.corteDate)}`}
            />
            <MetricTile
              label="Días acumulados"
              value={formatInteger(summary.totalAcumulados)}
              hint="Provisión total a la fecha"
              accent="success"
            />
            <MetricTile
              label="Días tomados"
              value={formatInteger(summary.totalTomados)}
              hint="Registrados como utilizados"
              accent="warning"
            />
            <MetricTile
              label="Días disponibles"
              value={formatInteger(summary.totalDisponibles)}
              hint="Acumulados − Tomados"
              accent={summary.totalDisponibles < 0 ? "danger" : "default"}
            />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {error ? (
        <Card className="border-amber-300/60 bg-amber-500/10">
          <CardContent className="px-4 py-3 text-sm">
            <p className="font-medium">No se pudo cargar el simulador.</p>
            <p className="opacity-90">{error instanceof Error ? error.message : "Error desconocido."}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState label="Sin colaboradores que coincidan con los filtros." />
      ) : (
        <>
          <VacationCharts summary={summary} />
          <VacationDetailTable
            rows={rows}
            searchValue={filters.q}
            onSearchChange={(value) => updateFilter("q", value)}
            isValidating={isValidating}
          />
        </>
      )}
    </div>
  );
}
