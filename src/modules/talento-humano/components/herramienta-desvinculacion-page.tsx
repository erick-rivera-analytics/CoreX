"use client";

import { useMemo, useState } from "react";
import { Activity, X } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type {
  DesvinculacionToolData,
  DesvinculacionToolFilters,
} from "@/lib/talento-humano-herramienta-desvinculacion";
import { PersonEvolutionChart } from "@/modules/talento-humano/components/herramienta-desvinculacion-person-chart";
import { DesvinculacionDetailTable } from "@/modules/talento-humano/components/herramienta-desvinculacion-table";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MultiSelectField, WeekField } from "@/shared/filters";
import { FilterPanel } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatIsoWeekLabel } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

function desvinculacionFetcher(url: string) {
  return fetchJson<DesvinculacionToolData>(url, "No se pudo cargar la herramienta de desvinculación.");
}

function buildQuery(filters: DesvinculacionToolFilters): string {
  const params = new URLSearchParams();
  if (filters.weekId) params.set("weekId", filters.weekId);
  if (filters.area && filters.area !== "all") params.set("area", filters.area);
  if (filters.jobClassification && filters.jobClassification !== "all") {
    params.set("jobClassification", filters.jobClassification);
  }
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

export function HerramientaDesvinculacionPage({ initialData }: { initialData: DesvinculacionToolData }) {
  const [filters, setFilters] = useState<DesvinculacionToolFilters>(initialData.filters);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const query = buildQuery(filters);
  const url = `/api/talento-humano/herramienta-desvinculacion?${query}`;

  const { data, error, isValidating, mutate } = useSWR<DesvinculacionToolData>(url, desvinculacionFetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 30_000,
  });

  const payload = data ?? initialData;
  const rows = payload.rows;
  const summary = payload.summary;

  const optionsAreas = useMemo(() => payload.options?.areas ?? [], [payload.options?.areas]);
  const optionsClassifications = useMemo(
    () => payload.options?.jobClassifications ?? [],
    [payload.options?.jobClassifications],
  );
  const optionsWeeks = useMemo(
    () => payload.options?.weeks ?? [],
    [payload.options?.weeks],
  );

  const updateFilter = <K extends keyof DesvinculacionToolFilters>(key: K, value: DesvinculacionToolFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    setFilters(initialData.filters);
    setSelectedPersonId(null);
  };

  const handleSelectPerson = (personId: string) => {
    setSelectedPersonId((current) => (current === personId ? null : personId));
  };

  const selectedRow = useMemo(
    () => rows.find((row) => row.personId === selectedPersonId) ?? null,
    [rows, selectedPersonId],
  );

  const weekOptions = useMemo(
    () => optionsWeeks.map((week) => ({ value: week, label: formatIsoWeekLabel(week) })),
    [optionsWeeks],
  );

  const areaOptions = useMemo(() => optionsAreas.map((entry) => entry.id), [optionsAreas]);
  const areaLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of optionsAreas) {
      map.set(entry.id, entry.name);
    }
    return map;
  }, [optionsAreas]);

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Talento Humano / Explorador"
        title="Herramienta de Desvinculación"
        subtitle="Rendimiento por colaborador activo en la semana seleccionada. Las métricas se calculan a partir de las horas reales de rendimiento."
        icon={<Activity className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <WeekField
              id="hd-week"
              label="Semana"
              value={filters.weekId}
              options={weekOptions}
              onChange={(value) => updateFilter("weekId", value)}
            />
            <MultiSelectField
              id="hd-area"
              label="Área"
              value={filters.area}
              options={areaOptions}
              displayValue={(id) => areaLabelMap.get(id) ?? id}
              onChange={(value) => updateFilter("area", value)}
            />
            <MultiSelectField
              id="hd-clasif"
              label="Clasificación"
              value={filters.jobClassification}
              options={optionsClassifications}
              onChange={(value) => updateFilter("jobClassification", value)}
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
        </FilterPanel>
      </SectionPageShell>

      {error ? (
        <Card className="border-amber-300/60 bg-amber-500/10">
          <CardContent className="px-4 py-3 text-sm">
            <p className="font-medium">No se pudo cargar la herramienta.</p>
            <p className="opacity-90">{error instanceof Error ? error.message : "Error desconocido."}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {selectedPersonId ? (
        <PersonEvolutionChart
          personId={selectedPersonId}
          fallbackName={selectedRow?.personName ?? null}
          onClose={() => setSelectedPersonId(null)}
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState label="Sin colaboradores con cumplimiento calculable en la semana seleccionada." />
      ) : (
        <DesvinculacionDetailTable
          rows={rows}
          weekId={summary.weekId}
          searchValue={filters.q}
          onSearchChange={(value) => updateFilter("q", value)}
          isValidating={isValidating}
          selectedPersonId={selectedPersonId}
          onSelectPerson={handleSelectPerson}
        />
      )}
    </div>
  );
}
