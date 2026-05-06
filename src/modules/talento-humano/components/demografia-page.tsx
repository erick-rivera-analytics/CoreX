"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { UserCircle2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { ChartSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDecimal, formatInteger, formatPercent, formatDateSlash, parseDateOnly } from "@/shared/lib/format";
import type { TalentoActivosData, TalentoFilters, TalentoPersonRecord } from "@/lib/talento-humano";
import {
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

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

function normalizeUpper(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean.toUpperCase() : null;
}

function booleanLabel(value: boolean | null) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "Sin dato";
}

function getAsOfTime(snapshotDate: string) {
  return (parseDateOnly(snapshotDate) ?? new Date()).getTime();
}

function getAge(row: TalentoPersonRecord, asOfTime: number) {
  const birthDate = parseDateOnly(row.birthDate);
  if (!birthDate) return null;
  const years = Math.floor((asOfTime - birthDate.getTime()) / YEAR_MS);
  return Number.isFinite(years) && years >= 0 ? years : null;
}

function getTenureDays(row: TalentoPersonRecord, asOfTime: number) {
  const entryDate = parseDateOnly(row.lastEntryDate);
  if (!entryDate) return null;
  const days = Math.floor((asOfTime - entryDate.getTime()) / DAY_MS);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function bucketNumber(value: number | null, labels: string[]) {
  if (value === null) return "Sin dato";
  if (value >= 5) return "5+";
  return labels.includes(String(value)) ? String(value) : "Otros";
}

function ageBucket(row: TalentoPersonRecord, asOfTime: number) {
  const age = getAge(row, asOfTime);
  if (age === null) return "Sin dato";
  if (age < 24) return "< 24 años";
  if (age <= 30) return "24 - 30 años";
  if (age <= 37) return "31 - 37 años";
  if (age <= 42) return "38 - 42 años";
  if (age <= 49) return "43 - 49 años";
  return "Otros";
}

function tenureBucket(row: TalentoPersonRecord, asOfTime: number) {
  const days = getTenureDays(row, asOfTime);
  if (days === null) return "Sin dato";
  if (days < 30) return "< 30 días";
  if (days <= 90) return "30 - 90 días";
  if (days <= 180) return "91 - 180 días";
  if (days <= 360) return "181 - 360 días";
  return "> 360 días";
}

function groupByLabel<T extends TalentoPersonRecord>(
  rows: T[],
  getLabel: (row: T) => string,
  order?: string[],
  limit = 20,
): TalentoGroup<T>[] {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const rawLabel = getLabel(row).trim();
    const label = rawLabel || "Sin dato";
    const people = grouped.get(label) ?? [];
    people.push(row);
    grouped.set(label, people);
  }

  const orderMap = new Map((order ?? []).map((label, index) => [label, index]));

  return Array.from(grouped.entries())
    .map(([label, people]) => ({ label, count: people.length, people }))
    .sort((left, right) => {
      const leftOrder = orderMap.get(left.label);
      const rightOrder = orderMap.get(right.label);
      if (leftOrder !== undefined || rightOrder !== undefined) {
        return (leftOrder ?? 9999) - (rightOrder ?? 9999);
      }
      return right.count - left.count || left.label.localeCompare(right.label, "es-EC");
    })
    .slice(0, limit);
}

function ShareBarCard<T extends TalentoPersonRecord>({
  title,
  data,
  onSelect,
}: {
  title: string;
  data: TalentoGroup<T>[];
  onSelect: (group: TalentoGroup<T>) => void;
}) {
  const total = data.reduce((sum, group) => sum + group.count, 0);
  const visible = data.slice(0, 10);

  return (
    <ChartSurface title={title}>
      {visible.length ? (
        <div className="space-y-3">
          {visible.map((group) => {
            const ratio = total ? group.count / total : 0;
            return (
              <button
                key={group.label}
                type="button"
                className="grid w-full grid-cols-[minmax(110px,0.9fr)_minmax(140px,1.3fr)_auto] items-center gap-3 text-left text-xs hover:opacity-80"
                onClick={() => onSelect(group)}
              >
                <span className="min-w-0 truncate font-medium">{group.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-[var(--chart-line-primary)]" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatPercent(ratio, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({formatInteger(group.count)})
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState label="Sin datos para graficar." />
      )}
    </ChartSurface>
  );
}

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
  const asOfTime = useMemo(() => getAsOfTime(filters.snapshotDate), [filters.snapshotDate]);

  const groups = useMemo(
    () => ({
      gender: groupByLabel(rows, (row) => normalizeUpper(row.gender) ?? "Sin dato", ["FEMENINO", "MASCULINO", "Sin dato"]),
      maritalStatus: groupByLabel(rows, (row) => normalizeUpper(row.maritalStatus) ?? "Sin dato"),
      nationality: groupByLabel(rows, (row) => normalizeUpper(row.nationality) ?? "Sin dato"),
      entryCount: groupByLabel(rows, (row) => bucketNumber(row.entryCount, ["1", "2", "3", "4"]), ["1", "2", "3", "4", "5+", "Sin dato"]),
      performancePay: groupByLabel(rows, (row) => booleanLabel(row.performancePayApplicable), ["Sí", "No", "Sin dato"]),
      disabled: groupByLabel(rows, (row) => booleanLabel(row.disabledFlag), ["No", "Sí", "Sin dato"]),
      age: groupByLabel(rows, (row) => ageBucket(row, asOfTime), ["< 24 años", "24 - 30 años", "31 - 37 años", "38 - 42 años", "43 - 49 años", "Otros", "Sin dato"]),
      tenure: groupByLabel(rows, (row) => tenureBucket(row, asOfTime), ["< 30 días", "30 - 90 días", "91 - 180 días", "181 - 360 días", "> 360 días", "Sin dato"]),
      children: groupByLabel(rows, (row) => bucketNumber(row.childrenCount, ["0", "1", "2", "3", "4"]), ["0", "1", "2", "3", "4", "5+", "Sin dato"]),
      dependents: groupByLabel(rows, (row) => bucketNumber(row.dependentsCount, ["0", "1", "2", "3", "4"]), ["0", "1", "2", "3", "4", "5+", "Sin dato"]),
      birthPlace: groupTalentoRows(rows, "birthPlace"),
      educationTitle: groupTalentoRows(rows, "educationTitle"),
      areaGeneral: groupTalentoRows(rows, "areaGeneral"),
      areaName: groupTalentoRows(rows, "areaName"),
      jobClassification: groupTalentoRows(rows, "jobClassificationCode"),
      farm: groupTalentoRows(rows, "farmCode"),
      employer: groupTalentoRows(rows, "employerName"),
      jobTitle: groupTalentoRows(rows, "jobTitle"),
      associatedWorker: groupTalentoRows(rows, "associatedWorkerName"),
    }),
    [asOfTime, rows],
  );

  const women = rows.filter((row) => normalizeUpper(row.gender)?.startsWith("F")).length;
  const avgAge = average(rows.map((row) => getAge(row, asOfTime)));
  const avgTenureDays = average(rows.map((row) => getTenureDays(row, asOfTime)));
  const avgChildren = average(rows.map((row) => row.childrenCount));
  const avgEntries = average(rows.map((row) => row.entryCount));

  function setFilter<K extends keyof TalentoFilters>(key: K, value: TalentoFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function selectGroup(title: string, group: TalentoGroup<TalentoPersonRecord>) {
    setSelectedGroup({ ...group, title: `${title}: ${group.label}` });
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Talento Humano / Indicadores & KPI"
        title="Demografía del personal"
        subtitle="Distribución del personal activo por variables demográficas, familiares, laborales y de concentración."
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

          <KpiGrid className="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <MetricTile
              label="Colaboradores activos"
              value={formatInteger(current.summary.totalPersonas)}
              hint={`al día ${formatDateSlash(filters.snapshotDate)}`}
            />
            <MetricTile
              label="% Mujeres"
              value={formatPercent(rows.length ? women / rows.length : null, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              hint={`Mujeres: ${formatInteger(women)}`}
            />
            <MetricTile label="Prom. N° ingresos" value={formatDecimal(avgEntries, 1)} hint="sobre base activa" />
            <MetricTile label="Prom. edad" value={formatDecimal(avgAge, 1)} hint="años" />
            <MetricTile label="Prom. antigüedad" value={formatDecimal(avgTenureDays, 0)} hint="días desde último ingreso" />
            <MetricTile label="Prom. hijos" value={formatDecimal(avgChildren, 1)} hint="sobre base activa" />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {rows.length ? (
        <ChartSection>
          <div className="grid gap-5 xl:grid-cols-3">
            <DonutChart title="Sexo" data={groups.gender} onSelect={(group) => selectGroup("Sexo", group)} />
            <DonutChart title="Estado civil" data={groups.maritalStatus} onSelect={(group) => selectGroup("Estado civil", group)} />
            <DonutChart title="Nacionalidad" data={groups.nationality} onSelect={(group) => selectGroup("Nacionalidad", group)} />
            <DonutChart title="N° ingresos" data={groups.entryCount} onSelect={(group) => selectGroup("N° ingresos", group)} />
            <DonutChart title="Aplica rendimiento" data={groups.performancePay} onSelect={(group) => selectGroup("Aplica rendimiento", group)} />
            <DonutChart title="Discapacitado" data={groups.disabled} onSelect={(group) => selectGroup("Discapacitado", group)} />
            <DonutChart title="Edad" data={groups.age} onSelect={(group) => selectGroup("Edad", group)} />
            <DonutChart title="Antigüedad" data={groups.tenure} onSelect={(group) => selectGroup("Antigüedad", group)} />
            <DonutChart title="Hijos" data={groups.children} onSelect={(group) => selectGroup("Hijos", group)} />
            <DonutChart title="Cargas" data={groups.dependents} onSelect={(group) => selectGroup("Cargas", group)} />
            <DonutChart title="Lugar nacimiento" data={groups.birthPlace} onSelect={(group) => selectGroup("Lugar nacimiento", group)} />
            <DonutChart title="Nivel instrucción" data={groups.educationTitle} onSelect={(group) => selectGroup("Nivel instrucción", group)} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ShareBarCard title="Concentración - Área general" data={groups.areaGeneral} onSelect={(group) => selectGroup("Área general", group)} />
            <ShareBarCard title="Concentración - Área original" data={groups.areaName} onSelect={(group) => selectGroup("Área original", group)} />
            <ShareBarCard title="Concentración - Clasificación" data={groups.jobClassification} onSelect={(group) => selectGroup("Clasificación", group)} />
            <ShareBarCard title="Concentración - Finca" data={groups.farm} onSelect={(group) => selectGroup("Finca", group)} />
            <ShareBarCard title="Concentración - Empresa" data={groups.employer} onSelect={(group) => selectGroup("Empresa", group)} />
            <ShareBarCard title="Concentración - Sexo" data={groups.gender} onSelect={(group) => selectGroup("Sexo", group)} />
            <ShareBarCard title="Concentración - Cargo actual" data={groups.jobTitle} onSelect={(group) => selectGroup("Cargo actual", group)} />
            <ShareBarCard title="Concentración - Trabajadora social" data={groups.associatedWorker} onSelect={(group) => selectGroup("Trabajadora social", group)} />
          </div>
        </ChartSection>
      ) : (
        <EmptyState label="No hay personal activo para el día seleccionado." />
      )}

      {selectedGroup ? <PersonListModal title={selectedGroup.title} people={selectedGroup.people} onClose={() => setSelectedGroup(null)} /> : null}
    </div>
  );
}
