"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ClipboardCheck, TrendingDown, TrendingUp, X } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useSWR from "swr";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { FilterPanel, KpiGrid, ChartSection, DetailSection } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { DateField } from "@/shared/filters/date-field";
import { Button } from "@/shared/ui/button";
import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";
import { axisConfig, axisTickStyle, axisTickStyleCompact, gridConfig, tooltipCursorStyle } from "@/shared/charts/chart-axis-config";
import { formatPercent, formatInteger } from "@/shared/lib/format";
import type { FollowupIndicatorData, FollowupIndicatorFilters } from "@/lib/talento-humano-seguimientos-indicador";

// ── Color tokens ───────────────────────────────────────────────────────────────

const COLOR_REGISTERED = "var(--color-chart-success-bold)";
const COLOR_PENDING = "var(--color-chart-warning)";
const COLOR_COMPLIANCE = "var(--color-chart-primary)";
const COLOR_GOAL = "var(--color-chart-danger)";

// ── SWR fetcher ────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetchJson<FollowupIndicatorData>(url, "No se pudo cargar el indicador de seguimientos.");

function buildQuery(f: FollowupIndicatorFilters) {
  const params = new URLSearchParams();
  if (f.year) params.set("year", f.year);
  if (f.month) params.set("month", f.month);
  if (f.area) params.set("area", f.area);
  if (f.worker) params.set("worker", f.worker);
  if (f.route) params.set("route", f.route);
  if (f.dateFrom) params.set("dateFrom", f.dateFrom);
  if (f.dateTo) params.set("dateTo", f.dateTo);
  return params.toString();
}

function hasActiveFilters(f: FollowupIndicatorFilters) {
  return !!(f.year || f.month || f.area || f.worker || f.route || f.dateFrom || f.dateTo);
}

// ── Default filters (duplicated here to avoid importing server-only lib) ──────

const DEFAULT_FILTERS: FollowupIndicatorFilters = {
  year: "", month: "", area: "", worker: "", route: "", dateFrom: "", dateTo: "",
};

// ── Month labels ───────────────────────────────────────────────────────────────

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
const MONTH_OPTIONS = MONTHS_ES.map((label, i) => String(i + 1));
const ROUTE_OPTIONS = ["AGR", "ADM"];

// ── Main explorer ──────────────────────────────────────────────────────────────

export function SeguimientosIndicadorExplorer({ initialData }: { initialData: FollowupIndicatorData }) {
  const [filters, setFilters] = useState<FollowupIndicatorFilters>(initialData.filters);
  const deferredFilters = useDeferredValue(filters);

  const initialQuery = useMemo(() => buildQuery(initialData.filters), [initialData.filters]);
  const queryString = useMemo(() => buildQuery(deferredFilters), [deferredFilters]);

  const { data, isValidating } = useSWR(
    `/api/talento-humano/seguimientos-indicador?${queryString}`,
    fetcher,
    {
      fallbackData: queryString === initialQuery ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el indicador de seguimientos."),
    },
  );

  const current = data ?? initialData;
  const { summary, byWorker, byArea, byMonth, options } = current;

  function setFilter<K extends keyof FollowupIndicatorFilters>(key: K, value: FollowupIndicatorFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const isEmpty = summary.totalScheduled === 0;
  const complianceStr = formatPercent(summary.complianceRate);
  const meetsGoal = summary.complianceRate >= summary.goal;
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Dashboard / Indicadores / Talento Humano"
        title="Cumplimiento de seguimientos"
        subtitle="Seguimientos de Trabajo Social programados vs realizados, por trabajadora, área y período."
        icon={<ClipboardCheck className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          {/* Filters row */}
          <div className="flex flex-wrap items-end gap-3">
            <MultiSelectField
              id="ind-seg-year"
              label="Año"
              value={filters.year}
              options={options.years}
              displayValue={(v) => v}
              emptyLabel="Todos los años"
              onChange={(v) => setFilter("year", v)}
            />
            <MultiSelectField
              id="ind-seg-month"
              label="Mes"
              value={filters.month}
              options={MONTH_OPTIONS}
              displayValue={(v) => MONTHS_ES[Number(v) - 1] ?? v}
              emptyLabel="Todos los meses"
              onChange={(v) => setFilter("month", v)}
            />
            <MultiSelectField
              id="ind-seg-area"
              label="Área"
              value={filters.area}
              options={options.areas}
              displayValue={(v) => v}
              emptyLabel="Todas las áreas"
              onChange={(v) => setFilter("area", v)}
            />
            <MultiSelectField
              id="ind-seg-worker"
              label="Trabajadora Social"
              value={filters.worker}
              options={options.workers}
              displayValue={(v) => v}
              emptyLabel="Todas"
              onChange={(v) => setFilter("worker", v)}
            />
            <MultiSelectField
              id="ind-seg-route"
              label="Clasificación"
              value={filters.route}
              options={ROUTE_OPTIONS}
              displayValue={(v) => v}
              emptyLabel="Todas"
              onChange={(v) => setFilter("route", v)}
            />
            <DateField
              id="ind-seg-date-from"
              label="Desde"
              value={filters.dateFrom}
              onChange={(v) => setFilter("dateFrom", v)}
            />
            <DateField
              id="ind-seg-date-to"
              label="Hasta"
              value={filters.dateTo}
              onChange={(v) => setFilter("dateTo", v)}
            />
            {filtersActive && (
              <div className="flex items-end pb-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="h-9 gap-1.5 text-muted-foreground"
                >
                  <X className="size-3.5" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>

          <KpiGrid>
            <MetricTile
              label="Seguimientos agendados"
              value={formatInteger(summary.totalScheduled)}
              hint="Total en el período"
            />
            <MetricTile
              label="Seguimientos realizados"
              value={formatInteger(summary.totalRegistered)}
              hint={`${formatPercent(summary.totalScheduled > 0 ? (summary.totalRegistered / summary.totalScheduled) * 100 : 0)} del total`}
              accent="success"
            />
            <MetricTile
              label="% Cumplimiento general"
              value={complianceStr}
              hint={`Meta: ${summary.goal}%`}
              accent={meetsGoal ? "success" : "warning"}
            />
            <MetricTile
              label="Seguimientos pendientes"
              value={formatInteger(summary.totalPending)}
              hint={`${formatPercent(summary.totalScheduled > 0 ? (summary.totalPending / summary.totalScheduled) * 100 : 0)} del total`}
              accent={summary.totalPending > 0 ? "warning" : "success"}
            />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      {isEmpty ? (
        <EmptyState label="No hay seguimientos para los filtros seleccionados." />
      ) : (
        <>
          {/* Row 1: Charts */}
          <ChartSection>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <WorkerComplianceChart data={byWorker} goal={summary.goal} />
              </div>
              <div className="lg:col-span-2">
                <DistributionDonut
                  registered={summary.totalRegistered}
                  pending={summary.totalPending}
                />
              </div>
            </div>
          </ChartSection>

          {/* Row 2: Evolution + Area charts */}
          <ChartSection>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <EvolutionChart data={byMonth} goal={summary.goal} />
              </div>
              <div className="lg:col-span-1">
                <AreaComplianceChart data={byArea} />
              </div>
              <div className="lg:col-span-1">
                <AreaPendingChart data={byArea} />
              </div>
            </div>
          </ChartSection>

          {/* Detail table + Comparison */}
          <DetailSection>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <WorkerDetailTable data={byWorker} goal={summary.goal} />
              </div>
              <div className="lg:col-span-1">
                {(() => {
                  const selectedYears = decodeMultiSelectValue(filters.year);
                  const selectedMonths = decodeMultiSelectValue(filters.month);
                  const currentLabel =
                    selectedYears.length === 1 && selectedMonths.length === 1
                      ? `${MONTHS_ES[Number(selectedMonths[0]) - 1]} ${selectedYears[0]}`
                      : selectedYears.length === 1
                        ? selectedYears[0]!
                        : "Período actual";
                  return (
                    <PeriodComparison
                      current={summary.complianceRate}
                      prevPeriod={summary.prevPeriod}
                      currentLabel={currentLabel}
                      byMonth={byMonth}
                    />
                  );
                })()}
              </div>
            </div>
          </DetailSection>
        </>
      )}
    </div>
  );
}

// ── Subcharts ──────────────────────────────────────────────────────────────────

function WorkerComplianceChart({
  data,
  goal,
}: {
  data: FollowupIndicatorData["byWorker"];
  goal: number;
}) {
  return (
    <ChartSurface title="Cumplimiento por Trabajadora Social">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 40, left: 0, bottom: 8 }}>
            <CartesianGrid {...gridConfig} />
            <XAxis
              {...axisConfig}
              dataKey="workerName"
              tick={{ ...axisTickStyleCompact, width: 80 }}
              tickFormatter={(v: string) => v.replace(/^TS\.\s*/i, "")}
              minTickGap={12}
            />
            <YAxis {...axisConfig} yAxisId="count" tick={axisTickStyleCompact} />
            <YAxis
              {...axisConfig}
              yAxisId="pct"
              orientation="right"
              tick={axisTickStyleCompact}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={tooltipCursorStyle}
              content={
                <RechartsTooltipAdapter
                  title={(label) => String(label)}
                  mapPayload={(payload) =>
                    payload.map((entry) => ({
                      label: String(entry.name ?? ""),
                      value:
                        entry.name === "% Cumplimiento"
                          ? formatPercent(Number(entry.value))
                          : formatInteger(Number(entry.value)),
                    }))
                  }
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              yAxisId="count"
              dataKey="registered"
              name="Realizados"
              fill={COLOR_REGISTERED}
              fillOpacity={0.82}
              radius={[6, 6, 0, 0]}
            />
            <Bar
              yAxisId="count"
              dataKey="pending"
              name="Pendientes"
              fill={COLOR_PENDING}
              fillOpacity={0.7}
              radius={[6, 6, 0, 0]}
            />
            <Line
              yAxisId="pct"
              dataKey="complianceRate"
              name="% Cumplimiento"
              type="monotone"
              stroke={COLOR_COMPLIANCE}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: COLOR_COMPLIANCE }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            {/* Goal reference */}
            <Line
              yAxisId="pct"
              dataKey={() => goal}
              name={`Meta ${goal}%`}
              stroke={COLOR_GOAL}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              legendType="plainline"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

function DistributionDonut({
  registered,
  pending,
}: {
  registered: number;
  pending: number;
}) {
  const total = registered + pending;
  const pieData = [
    { name: "Realizados", value: registered, color: COLOR_REGISTERED },
    { name: "Pendientes", value: pending, color: COLOR_PENDING },
  ];

  return (
    <ChartSurface title="Distribución de seguimientos">
      <div className="flex h-[300px] items-center justify-center">
        <div className="relative w-full">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <RechartsTooltipAdapter
                    mapPayload={(payload) =>
                      payload.map((entry) => ({
                        label: String(entry.name ?? ""),
                        value: `${formatInteger(Number(entry.value))} (${formatPercent(total > 0 ? (Number(entry.value) / total) * 100 : 0)})`,
                      }))
                    }
                  />
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value, entry) => {
                  const val = (entry as { payload?: { value: number } }).payload?.value ?? 0;
                  return `${value} ${formatInteger(val)} (${formatPercent(total > 0 ? (val / total) * 100 : 0)})`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
            <span className="text-2xl font-bold tabular-nums">{formatInteger(total)}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
      </div>
    </ChartSurface>
  );
}

function EvolutionChart({
  data,
  goal,
}: {
  data: FollowupIndicatorData["byMonth"];
  goal: number;
}) {
  return (
    <ChartSurface title="Evolución del cumplimiento">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="grad-compliance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_REGISTERED} stopOpacity={0.22} />
                <stop offset="95%" stopColor={COLOR_REGISTERED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridConfig} />
            <XAxis
              {...axisConfig}
              dataKey="label"
              tick={axisTickStyleCompact}
              minTickGap={20}
            />
            <YAxis
              {...axisConfig}
              tick={axisTickStyleCompact}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={tooltipCursorStyle}
              content={
                <RechartsTooltipAdapter
                  title={(label) => String(label)}
                  mapPayload={(payload) =>
                    payload
                      .filter((e) => e.name !== `Meta ${goal}%`)
                      .map((e) => ({
                        label: String(e.name ?? ""),
                        value: formatPercent(Number(e.value)),
                      }))
                  }
                />
              }
            />
            <Area
              type="monotone"
              dataKey="complianceRate"
              name="% Cumplimiento"
              stroke={COLOR_REGISTERED}
              strokeWidth={2.5}
              fill="url(#grad-compliance)"
              dot={{ r: 4, strokeWidth: 0, fill: COLOR_REGISTERED }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey={() => goal}
              name={`Meta ${goal}%`}
              stroke={COLOR_GOAL}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              legendType="none"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

function AreaComplianceChart({ data }: { data: FollowupIndicatorData["byArea"] }) {
  const sorted = [...data].sort((a, b) => b.complianceRate - a.complianceRate);

  return (
    <ChartSurface title="Cumplimiento por área">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
          >
            <CartesianGrid {...gridConfig} horizontal={false} vertical />
            <XAxis
              {...axisConfig}
              type="number"
              domain={[0, 100]}
              tick={axisTickStyle}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              {...axisConfig}
              type="category"
              dataKey="areaName"
              tick={{ ...axisTickStyleCompact, width: 80 }}
              width={88}
            />
            <Tooltip
              cursor={tooltipCursorStyle}
              content={
                <RechartsTooltipAdapter
                  title={(_, payload) => {
                    const d = payload?.[0]?.payload as FollowupIndicatorData["byArea"][number] | undefined;
                    return d?.areaName ?? "";
                  }}
                  mapPayload={(payload) =>
                    payload.map((e) => ({
                      label: String(e.name ?? ""),
                      value: formatPercent(Number(e.value)),
                    }))
                  }
                />
              }
            />
            <Bar
              dataKey="complianceRate"
              name="% Cumplimiento"
              fill={COLOR_REGISTERED}
              fillOpacity={0.82}
              radius={[0, 6, 6, 0]}
              label={{ position: "right", fontSize: 10, fill: "var(--color-muted-foreground)", formatter: (v: unknown) => `${Number(v).toFixed(1)}%` }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

function AreaPendingChart({ data }: { data: FollowupIndicatorData["byArea"] }) {
  const sorted = [...data].sort((a, b) => b.pending - a.pending);

  return (
    <ChartSurface title="Pendientes por área">
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 8, right: 32, left: 8, bottom: 8 }}
          >
            <CartesianGrid {...gridConfig} horizontal={false} vertical />
            <XAxis {...axisConfig} type="number" tick={axisTickStyle} />
            <YAxis
              {...axisConfig}
              type="category"
              dataKey="areaName"
              tick={{ ...axisTickStyleCompact, width: 80 }}
              width={88}
            />
            <Tooltip
              cursor={tooltipCursorStyle}
              content={
                <RechartsTooltipAdapter
                  title={(_, payload) => {
                    const d = payload?.[0]?.payload as FollowupIndicatorData["byArea"][number] | undefined;
                    return d?.areaName ?? "";
                  }}
                  mapPayload={(payload) =>
                    payload.map((e) => ({
                      label: String(e.name ?? ""),
                      value: formatInteger(Number(e.value)),
                    }))
                  }
                />
              }
            />
            <Bar
              dataKey="pending"
              name="Pendientes"
              fill={COLOR_PENDING}
              fillOpacity={0.8}
              radius={[0, 6, 6, 0]}
              label={{ position: "right", fontSize: 10, fill: "var(--color-muted-foreground)", formatter: (v: unknown) => String(Number(v)) }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

// ── Detail table ───────────────────────────────────────────────────────────────

function WorkerDetailTable({
  data,
  goal,
}: {
  data: FollowupIndicatorData["byWorker"];
  goal: number;
}) {
  return (
    <ChartSurface title="Detalle por Trabajadora Social">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              {["Trabajadora Social", "Agendados", "Realizados", "Pendientes", "% Cumplimiento", "Meta", "Cumple meta"].map((h) => (
                <th key={h} className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground last:pr-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const meets = row.complianceRate >= goal;
              return (
                <tr key={row.workerName} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{row.workerName}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatInteger(row.scheduled)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatInteger(row.registered)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatInteger(row.pending)}</td>
                  <td className="py-2.5 pr-4">
                    <ComplianceBar value={row.complianceRate} goal={goal} />
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{goal}%</td>
                  <td className="py-2.5">
                    <span className={meets ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                      {meets ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            {data.length > 1 && (() => {
              const total = data.reduce((acc, r) => ({
                scheduled: acc.scheduled + r.scheduled,
                registered: acc.registered + r.registered,
                pending: acc.pending + r.pending,
              }), { scheduled: 0, registered: 0, pending: 0 });
              const totalRate = total.scheduled > 0 ? (total.registered / total.scheduled) * 100 : 0;
              const totalMeets = totalRate >= goal;
              return (
                <tr className="border-t-2 border-border/80 font-semibold">
                  <td className="py-2.5 pr-4">TOTAL</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatInteger(total.scheduled)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatInteger(total.registered)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatInteger(total.pending)}</td>
                  <td className="py-2.5 pr-4">
                    <ComplianceBar value={totalRate} goal={goal} />
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{goal}%</td>
                  <td className="py-2.5">
                    <span className={totalMeets ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                      {totalMeets ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </ChartSurface>
  );
}

function ComplianceBar({ value, goal }: { value: number; goal: number }) {
  const pct = Math.min(value, 100);
  const meets = value >= goal;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: meets ? COLOR_REGISTERED : COLOR_PENDING,
          }}
        />
      </div>
      <span className="min-w-[3.2rem] tabular-nums text-xs">{formatPercent(value)}</span>
    </div>
  );
}

// ── Period comparison ──────────────────────────────────────────────────────────

function PeriodComparison({
  current,
  prevPeriod,
  currentLabel,
  byMonth,
}: {
  current: number;
  prevPeriod: { label: string; complianceRate: number } | null;
  currentLabel: string;
  byMonth: FollowupIndicatorData["byMonth"];
}) {
  const comparisonData = useMemo(() => {
    if (prevPeriod) {
      return [
        { label: prevPeriod.label, value: prevPeriod.complianceRate },
        { label: currentLabel, value: current },
      ];
    }
    if (byMonth.length >= 2) {
      return byMonth.slice(-6).map((m) => ({ label: m.label, value: m.complianceRate }));
    }
    return [];
  }, [prevPeriod, current, currentLabel, byMonth]);

  const delta = comparisonData.length >= 2
    ? comparisonData[comparisonData.length - 1].value - comparisonData[comparisonData.length - 2].value
    : null;

  const isPositive = delta !== null && delta >= 0;

  return (
    <ChartSurface title="Comparación con período anterior">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">% Cumplimiento actual</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: COLOR_COMPLIANCE }}>
              {formatPercent(current)}
            </p>
          </div>
          {prevPeriod && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">% Cumplimiento anterior</p>
              <p className="text-base font-semibold tabular-nums text-muted-foreground">
                {formatPercent(prevPeriod.complianceRate)}
              </p>
            </div>
          )}
        </div>

        {delta !== null && (
          <div className="flex items-center gap-1.5 rounded-[12px] border border-border/60 bg-muted/40 px-3 py-2">
            {isPositive ? (
              <TrendingUp className="size-4 text-green-500" />
            ) : (
              <TrendingDown className="size-4 text-destructive" />
            )}
            <span className={`text-sm font-semibold tabular-nums ${isPositive ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {isPositive ? "+" : ""}{formatPercent(delta)} pp
            </span>
            {prevPeriod && (
              <span className="text-xs text-muted-foreground">vs {prevPeriod.label}</span>
            )}
          </div>
        )}

        {comparisonData.length >= 2 && (
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comparisonData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="grad-comparison" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_COMPLIANCE} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={COLOR_COMPLIANCE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis {...axisConfig} dataKey="label" tick={axisTickStyleCompact} />
                <YAxis
                  {...axisConfig}
                  tick={axisTickStyleCompact}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  domain={[
                    (dataMin: number) => Math.max(0, dataMin - 10),
                    (dataMax: number) => Math.min(100, dataMax + 10),
                  ]}
                />
                <Tooltip
                  cursor={tooltipCursorStyle}
                  content={
                    <RechartsTooltipAdapter
                      title={(label) => String(label)}
                      mapPayload={(payload) =>
                        payload.map((e) => ({ label: "Cumplimiento", value: formatPercent(Number(e.value)) }))
                      }
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={COLOR_COMPLIANCE}
                  strokeWidth={2.5}
                  fill="url(#grad-comparison)"
                  dot={{ r: 5, strokeWidth: 2, fill: "var(--color-card)", stroke: COLOR_COMPLIANCE }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: COLOR_COMPLIANCE }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartSurface>
  );
}
