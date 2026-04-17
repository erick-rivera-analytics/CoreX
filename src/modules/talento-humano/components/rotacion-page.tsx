"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { ChartSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import { formatWeekLabel } from "@/lib/talento-humano-utils";
import type {
  TalentoFilters,
  TalentoPersonRecord,
  TalentoRotacionData,
  TalentoRotacionWeekRow,
} from "@/lib/talento-humano";
import {
  EmptyState,
  MetricTile,
  PersonListModal,
  TalentoFilterToolbar,
  buildTalentoQueryString,
} from "@/modules/talento-humano/components/shared";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";
import { axisConfig, axisTickStyleCompact, gridConfig, tooltipCursorStyle } from "@/shared/charts/chart-axis-config";

const rotacionFetcher = (url: string) =>
  fetchJson<TalentoRotacionData>(url, "No se pudo cargar rotacion laboral.");

type SelectedGroup = { title: string; people: TalentoPersonRecord[] };

export function TalentoRotacionPage({ initialData }: { initialData: TalentoRotacionData }) {
  const [filters, setFilters] = useState<TalentoFilters>(initialData.filters);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const initialQuery = useMemo(() => buildTalentoQueryString(initialData.filters), [initialData.filters]);
  const queryString = useMemo(() => buildTalentoQueryString(deferredFilters), [deferredFilters]);

  const { data, isValidating, mutate } = useSWR(`/api/talento-humano/rotacion?v=2&${queryString}`, rotacionFetcher, {
    fallbackData: queryString === initialQuery ? initialData : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar rotacion laboral."),
  });

  const current = data ?? initialData;
  const ingresos = current.ingresos ?? [];
  const salidas = current.salidas ?? [];
  const options = current.options;
  const summary = {
    totalIngresos: current.summary.totalIngresos ?? ingresos.length,
    totalSalidas: current.summary.totalSalidas ?? salidas.length,
    avgActivos: current.summary.avgActivos ?? 0,
    rotationRate: current.summary.rotationRate ?? null,
  };

  function setFilter<K extends keyof TalentoFilters>(key: K, value: TalentoFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function selectWeek(week: TalentoRotacionWeekRow, kind: "ingresos" | "salidas") {
    const people = kind === "ingresos"
      ? ingresos.filter((person) => person.isoWeekId === week.isoWeekId)
      : salidas.filter((person) => person.isoWeekId === week.isoWeekId);
    setSelectedGroup({
      people,
      title: `${formatWeekLabel(week.isoWeekId)} - ${kind}`,
    });
  }

  const rotationRate = summary.rotationRate === null ? "-" : formatPercent(summary.rotationRate);

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Talento Humano"
        title="Rotación laboral"
        subtitle="Evolución semanal de ingresos, salidas y base activa para el rango seleccionado."
        icon={<TrendingDown className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <TalentoFilterToolbar
            mode="range"
            filters={filters}
            options={options}
            onFilterChange={setFilter}
            onReset={() => setFilters(initialData.filters)}
            onRefresh={() => mutate()}
            refreshing={isValidating}
            containerless
          />

          <KpiGrid>
            <MetricTile label="Total ingresos" value={formatInteger(summary.totalIngresos)} />
            <MetricTile label="Total salidas" value={formatInteger(summary.totalSalidas)} />
            <MetricTile label="Promedio activos" value={formatInteger(summary.avgActivos)} />
            <MetricTile label="Tasa de rotación" value={rotationRate} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {current.weeklyEvolution.length ? (
        <ChartSection>
          <WeeklyEvolutionChart data={current.weeklyEvolution} onSelect={selectWeek} />
        </ChartSection>
      ) : (
        <EmptyState label="No hay semanas disponibles para el rango seleccionado." />
      )}

      {selectedGroup ? <PersonListModal title={selectedGroup.title} people={selectedGroup.people} onClose={() => setSelectedGroup(null)} /> : null}
    </div>
  );
}

function WeeklyEvolutionChart({
  data,
  onSelect,
}: {
  data: TalentoRotacionWeekRow[];
  onSelect: (week: TalentoRotacionWeekRow, kind: "ingresos" | "salidas") => void;
}) {
  return (
    <ChartSurface title="Evolución semanal">
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={360}>
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid {...gridConfig} />
            <XAxis
              {...axisConfig}
              dataKey="isoWeekId"
              tick={axisTickStyleCompact}
              tickFormatter={(value: string) => formatWeekLabel(value)}
              minTickGap={18}
            />
            <YAxis {...axisConfig} yAxisId="salidas" tick={axisTickStyleCompact} />
            <YAxis {...axisConfig} yAxisId="activos" orientation="right" tick={axisTickStyleCompact} />
            <Tooltip
              cursor={tooltipCursorStyle}
              content={
                <RechartsTooltipAdapter
                  title={(label) => formatWeekLabel(String(label))}
                  mapPayload={(payload) =>
                    payload.map((entry) => ({
                      label: String(entry.name ?? ""),
                      value: formatInteger(Number(entry.value ?? 0)),
                    }))
                  }
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="entries"
              name="Ingresos"
              yAxisId="salidas"
              radius={[8, 8, 0, 0]}
              cursor="pointer"
              fill="var(--color-chart-success-bold)"
              fillOpacity={0.72}
              onClick={(entry: unknown) => {
                const week = (entry as { payload?: TalentoRotacionWeekRow }).payload;
                if (week) onSelect(week, "ingresos");
              }}
            />
            <Bar
              dataKey="exits"
              name="Salidas"
              yAxisId="salidas"
              radius={[8, 8, 0, 0]}
              fill="var(--color-chart-danger)"
              fillOpacity={0.82}
              cursor="pointer"
              onClick={(entry: unknown) => {
                const week = (entry as { payload?: TalentoRotacionWeekRow }).payload;
                if (week) onSelect(week, "salidas");
              }}
            />
            <Line
              dataKey="activos"
              name="Activos"
              yAxisId="activos"
              type="monotone"
              dot={false}
              stroke="var(--chart-line-secondary)"
              strokeWidth={2.5}
              activeDot={{ r: 4, strokeWidth: 0, fill: "var(--chart-line-secondary)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}
