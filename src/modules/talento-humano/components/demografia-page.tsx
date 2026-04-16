"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { UserCircle2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { ChartSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import type { TalentoActivosData, TalentoFilters, TalentoPersonRecord } from "@/lib/talento-humano";
import {
  DistributionChart,
  DonutChart,
  EmptyState,
  MetricTile,
  PersonListModal,
  TalentoFilterToolbar,
  buildTalentoQueryString,
  groupTalentoRows,
  type TalentoGroup,
} from "@/modules/talento-humano/components/shared";

const activosFetcher = (url: string) =>
  fetchJson<TalentoActivosData>(url, "No se pudo cargar demografia personal.");

type SelectedGroup = TalentoGroup<TalentoPersonRecord> & { title: string };

export function TalentoDemografiaPage({ initialData }: { initialData: TalentoActivosData }) {
  const [filters, setFilters] = useState<TalentoFilters>(initialData.filters);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const initialQuery = useMemo(() => buildTalentoQueryString(initialData.filters), [initialData.filters]);
  const queryString = useMemo(() => buildTalentoQueryString(deferredFilters), [deferredFilters]);

  const { data, isValidating, mutate } = useSWR(`/api/talento-humano/activos?${queryString}`, activosFetcher, {
    fallbackData: queryString === initialQuery ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar demografia personal."),
  });

  const current = data ?? initialData;
  const rows = current.rows;
  const options = current.options;

  const groups = useMemo(
    () => ({
      gender: groupTalentoRows(rows, "gender"),
      maritalStatus: groupTalentoRows(rows, "maritalStatus"),
      birthPlace: groupTalentoRows(rows, "birthPlace"),
      employeeType: groupTalentoRows(rows, "employeeType"),
      contractType: groupTalentoRows(rows, "contractType"),
      city: groupTalentoRows(rows, "city"),
      parish: groupTalentoRows(rows, "parish"),
      nationality: groupTalentoRows(rows, "nationality"),
      educationTitle: groupTalentoRows(rows, "educationTitle"),
    }),
    [rows],
  );

  const distinctCities = groups.city.filter((group) => group.label !== "Sin dato").length;
  const women = rows.filter((row) => row.gender?.trim().toUpperCase().startsWith("F")).length;
  const womenPct = rows.length
    ? formatPercent(women / rows.length, { input: "ratio", minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "-";

  function setFilter<K extends keyof TalentoFilters>(key: K, value: TalentoFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function selectGroup(title: string, group: TalentoGroup<TalentoPersonRecord>) {
    setSelectedGroup({ ...group, title: `${title}: ${group.label}` });
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Talento Humano"
        title="Demografía personal"
        subtitle="Distribución del personal activo por género, tipo de contrato, ciudad y otras dimensiones demográficas."
        icon={<UserCircle2 className="size-6" aria-hidden="true" />}
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
            containerless
          />

          <KpiGrid className="sm:grid-cols-3 xl:grid-cols-3">
            <MetricTile label="Total personas" value={formatInteger(current.summary.totalPersonas)} />
            <MetricTile label="Mujeres" value={womenPct} />
            <MetricTile label="Ciudades" value={formatInteger(distinctCities)} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {rows.length ? (
        <ChartSection>
          <div className="grid gap-5 md:grid-cols-3">
            <DonutChart title="Género" data={groups.gender} onSelect={(group) => selectGroup("Género", group)} />
            <DonutChart title="Tipo de empleado" data={groups.employeeType} onSelect={(group) => selectGroup("Tipo de empleado", group)} />
            <DonutChart title="Tipo de contrato" data={groups.contractType} onSelect={(group) => selectGroup("Tipo de contrato", group)} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <DistributionChart title="Estado civil" data={groups.maritalStatus} onSelect={(group) => selectGroup("Estado civil", group)} />
            <DistributionChart title="Lugar de nacimiento" data={groups.birthPlace} onSelect={(group) => selectGroup("Lugar de nacimiento", group)} />
            <DistributionChart title="Ciudad" data={groups.city} onSelect={(group) => selectGroup("Ciudad", group)} />
            <DistributionChart title="Parroquia" data={groups.parish} onSelect={(group) => selectGroup("Parroquia", group)} />
            <DistributionChart title="Nacionalidad" data={groups.nationality} onSelect={(group) => selectGroup("Nacionalidad", group)} />
            <DistributionChart title="Nivel de instrucción" data={groups.educationTitle} onSelect={(group) => selectGroup("Nivel de instrucción", group)} />
          </div>
        </ChartSection>
      ) : (
        <EmptyState label="No hay personal activo para el día seleccionado." />
      )}

      {selectedGroup ? <PersonListModal title={selectedGroup.title} people={selectedGroup.people} onClose={() => setSelectedGroup(null)} /> : null}
    </div>
  );
}
