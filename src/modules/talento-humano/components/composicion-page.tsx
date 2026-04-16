"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { PieChart } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { DetailSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatInteger } from "@/shared/lib/format";
import type { TalentoActivosData, TalentoFilters, TalentoPersonRecord } from "@/lib/talento-humano";
import {
  CompositionTable,
  EmptyState,
  MetricTile,
  PersonListModal,
  TalentoFilterToolbar,
  buildCompositionRows,
  buildTalentoQueryString,
  type CompositionRow,
} from "@/modules/talento-humano/components/shared";
import { Label } from "@/shared/ui/label";

const activosFetcher = (url: string) =>
  fetchJson<TalentoActivosData>(url, "No se pudo cargar composicion laboral.");

type SelectedGroup = { title: string; people: TalentoPersonRecord[] };
type CompositionDimension = {
  key: keyof TalentoPersonRecord;
  label: string;
};

const COMPOSITION_DIMENSIONS: CompositionDimension[] = [
  { key: "areaName", label: "Área" },
  { key: "areaGeneral", label: "Área general" },
  { key: "jobTitle", label: "Cargo" },
  { key: "jobClassificationCode", label: "Clasificación" },
  { key: "associatedWorkerName", label: "Trabajadora social" },
  { key: "gender", label: "Género" },
];

export function TalentoComposicionPage({ initialData }: { initialData: TalentoActivosData }) {
  const [filters, setFilters] = useState<TalentoFilters>(initialData.filters);
  const [dimensionKey, setDimensionKey] = useState<keyof TalentoPersonRecord>("areaName");
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const initialQuery = useMemo(() => buildTalentoQueryString(initialData.filters), [initialData.filters]);
  const queryString = useMemo(() => buildTalentoQueryString(deferredFilters), [deferredFilters]);

  const { data, isValidating, mutate } = useSWR(`/api/talento-humano/activos?${queryString}`, activosFetcher, {
    fallbackData: queryString === initialQuery ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar composicion laboral."),
  });

  const current = data ?? initialData;
  const rows = current.rows;
  const options = current.options;

  const selectedDimension =
    COMPOSITION_DIMENSIONS.find((dimension) => dimension.key === dimensionKey) ?? COMPOSITION_DIMENSIONS[0];
  const tableRows = useMemo(
    () => buildCompositionRows(rows, selectedDimension.key, filters.snapshotDate),
    [rows, selectedDimension.key, filters.snapshotDate],
  );

  function setFilter<K extends keyof TalentoFilters>(key: K, value: TalentoFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function selectRow(title: string, row: CompositionRow) {
    setSelectedGroup({ title: `${title}: ${row.label}`, people: row.people });
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Talento Humano"
        title="Composición laboral"
        subtitle="Distribución del personal activo por área, cargo, clasificación y otras dimensiones laborales."
        icon={<PieChart className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <TalentoFilterToolbar
            mode="snapshot"
            filters={filters}
            options={options}
            onFilterChange={setFilter}
            onReset={() => setFilters(initialData.filters)}
            onRefresh={() => mutate()}
            refreshing={isValidating}
            extraControls={
              <div className="space-y-2">
                <Label>Tabla por</Label>
                <select
                  value={dimensionKey}
                  onChange={(event) => setDimensionKey(event.target.value as keyof TalentoPersonRecord)}
                  className="h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {COMPOSITION_DIMENSIONS.map((dimension) => (
                    <option key={dimension.key} value={dimension.key}>
                      {dimension.label}
                    </option>
                  ))}
                </select>
              </div>
            }
            containerless
          />

          <KpiGrid className="sm:grid-cols-3 xl:grid-cols-3">
            <MetricTile label="Total personas activas" value={formatInteger(current.summary.totalPersonas)} />
            <MetricTile label="Áreas con personal" value={formatInteger(current.summary.totalAreas)} />
            <MetricTile label="Cargos distintos" value={formatInteger(current.summary.totalCargos)} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {rows.length ? (
        <DetailSection>
          <CompositionTable
            title={`Composición por ${selectedDimension.label.toLowerCase()}`}
            dimensionLabel={selectedDimension.label}
            rows={tableRows}
            asOfDate={filters.snapshotDate}
            onSelect={(row) => selectRow(selectedDimension.label, row)}
          />
        </DetailSection>
      ) : (
        <EmptyState label="No hay personal activo para el día seleccionado." />
      )}

      {selectedGroup ? <PersonListModal title={selectedGroup.title} people={selectedGroup.people} onClose={() => setSelectedGroup(null)} /> : null}
    </div>
  );
}
