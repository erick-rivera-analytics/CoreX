"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoaderCircle } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import type { TalentoPersonRendimientoPayload, TalentoPersonRendimientoWeek } from "@/lib/talento-humano";
import { axisConfig, axisTickStyleCompact, gridConfig, tooltipCursorStyle } from "@/shared/charts/chart-axis-config";
import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatFlexibleNumber as formatNumber, formatPercent } from "@/shared/lib/format";

type ComplianceTone = "success" | "warning" | "danger" | "neutral";

function getComplianceTone(value: number | null): ComplianceTone {
  if (value === null) return "neutral";
  if (value > 1) return "success";
  if (value >= 0.9) return "warning";
  return "danger";
}

function toneClass(tone: ComplianceTone) {
  if (tone === "success") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "warning") return "text-amber-600 dark:text-amber-400";
  if (tone === "danger") return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function toneFill(tone: ComplianceTone) {
  if (tone === "success") return "var(--color-chart-success-bold)";
  if (tone === "warning") return "var(--color-chart-warning)";
  if (tone === "danger") return "var(--color-chart-danger)";
  return "var(--chart-line-secondary)";
}

function pct(value: number | null) {
  return value === null ? "-" : formatPercent(value, { input: "ratio" });
}

function hoursShare(value: number, total: number) {
  return total > 0 ? formatPercent(value / total, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "-";
}

function HoursValue({ value, total }: { value: number; total: number }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span>{formatNumber(value)}</span>
      <span className="text-[10px] text-muted-foreground">{hoursShare(value, total)}</span>
    </span>
  );
}

function ChartBarLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  payload?: TalentoPersonRendimientoWeek;
}) {
  if (typeof props.x !== "number" || typeof props.y !== "number" || typeof props.width !== "number") return null;
  const row = props.payload;
  const value = typeof props.value === "number" ? props.value : null;
  if (!row || value === null) return null;
  const centerX = props.x + props.width / 2;

  return (
    <g pointerEvents="none">
      <text x={centerX} y={props.y - 16} textAnchor="middle" className="fill-muted-foreground text-[9px] font-semibold">
        {formatPercent(value, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </text>
      <text x={centerX} y={props.y - 5} textAnchor="middle" className="fill-muted-foreground/80 text-[8px]">
        {formatNumber(row.actualHoursRend)}h
      </text>
    </g>
  );
}

/**
 * Tab "Rendimiento" de PersonProfileDialog cuando `sourceContext.module === "talento"`.
 *
 * Fuente: `gld.prod_rend_adj_cur`, al grano persona/semana.
 */
export function PersonProfileTalentoPerformanceSection({ personId }: { personId: string }) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const url = personId
    ? `/api/talento-humano/persona/${encodeURIComponent(personId)}/rendimiento`
    : null;

  const { data, isLoading, error } = useSWRImmutable<TalentoPersonRendimientoPayload>(
    url,
    (target: string) => fetchJson<TalentoPersonRendimientoPayload>(target, "No se pudo cargar el rendimiento del personal."),
    { revalidateOnFocus: false },
  );

  const selectedRow = useMemo(() => {
    if (!data?.weeklyRows.length) return null;
    return data.weeklyRows.find((row) => row.isoWeekId === selectedWeek) ?? data.weeklyRows[0] ?? null;
  }, [data, selectedWeek]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Cargando rendimiento del personal.
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "No se pudo cargar el rendimiento del personal.";
    return <div className="py-8 text-sm text-destructive">{errorMessage}</div>;
  }

  if (!data || data.weeklyRows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Sin registros de rendimiento para este personal.
      </div>
    );
  }

  const totalTone = getComplianceTone(data.totals.cumplimiento);
  const chartRows = [...data.weeklyRows].reverse();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Rendimiento ponderado"
          value={pct(data.totals.rendimiento)}
          hint="SUM(rendimiento x horas rendimiento) / horas rendimiento"
        />
        <MetricTile
          label="Rendimiento mínimo"
          value={pct(data.totals.rendimientoMin)}
          hint="Meta ponderada por horas rendimiento"
        />
        <MetricTile
          label="Cumplimiento"
          value={pct(data.totals.cumplimiento)}
          hint="Rendimiento / rendimiento mínimo"
          accent={totalTone === "danger" ? "danger" : totalTone === "warning" ? "warning" : totalTone === "success" ? "success" : "default"}
        />
        <MetricTile
          label="Horas totales"
          value={formatNumber(data.totals.totalActualHours)}
          hint={`${data.totals.weekCount} semanas visibles`}
        />
      </div>

      <div className="space-y-5">
        <ChartSurface title="Cumplimiento semanal">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Seleccione una semana para resaltar la tabla.</span>
            {selectedRow ? (
              <span className={cn("font-semibold", toneClass(getComplianceTone(selectedRow.cumplimiento)))}>
                Semana {selectedRow.isoWeekId}: {pct(selectedRow.cumplimiento)} · {formatNumber(selectedRow.actualHoursRend)} h rend.
              </span>
            ) : null}
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chartRows}
              margin={{ top: 34, right: 14, left: 0, bottom: 0 }}
              onClick={(state) => {
                const row = (state as { activePayload?: Array<{ payload?: TalentoPersonRendimientoWeek }> } | null)
                  ?.activePayload?.[0]?.payload;
                if (row?.isoWeekId) setSelectedWeek(row.isoWeekId);
              }}
            >
              <CartesianGrid {...gridConfig} />
              <XAxis {...axisConfig} dataKey="isoWeekId" tick={axisTickStyleCompact} />
              <YAxis
                {...axisConfig}
                tick={axisTickStyleCompact}
                tickFormatter={(value) => formatPercent(Number(value), { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              />
              <Tooltip
                cursor={tooltipCursorStyle}
                content={(
                  <RechartsTooltipAdapter
                    title={(label) => `Semana ${label}`}
                    mapPayload={(payload) =>
                      payload.flatMap((entry) => {
                        const row = entry.payload as TalentoPersonRendimientoWeek | undefined;
                        return [
                          {
                            label: "Cumplimiento",
                            value: typeof entry.value === "number" ? pct(entry.value) : "-",
                          },
                          { label: "Horas rendimiento", value: row ? formatNumber(row.actualHoursRend) : "-" },
                          { label: "Horas HN", value: row ? formatNumber(row.actualHoursHn) : "-" },
                          { label: "Horas totales", value: row ? formatNumber(row.totalActualHours) : "-" },
                        ];
                      })
                    }
                  />
                )}
              />
              <Bar dataKey="cumplimiento" radius={[8, 8, 0, 0]} cursor="pointer">
                <LabelList dataKey="cumplimiento" content={(props) => <ChartBarLabel {...(props as Parameters<typeof ChartBarLabel>[0])} />} />
                {chartRows.map((row) => (
                  <Cell
                    key={row.isoWeekId}
                    fill={toneFill(getComplianceTone(row.cumplimiento))}
                    fillOpacity={selectedRow?.isoWeekId === row.isoWeekId ? 1 : 0.72}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSurface>

        <div className="rounded-2xl border border-border/60 bg-card/80">
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-sm font-semibold">Resumen semanal</p>
            <p className="text-xs text-muted-foreground">Cumplimiento = rendimiento / rendimiento mínimo.</p>
          </div>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[920px] text-xs">
              <thead className="sticky top-0 z-10 bg-muted/60 text-[10px] uppercase tracking-widest text-muted-foreground/80">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Semana</th>
                  <th className="px-3 py-2 text-right font-semibold">Rendimiento</th>
                  <th className="px-3 py-2 text-right font-semibold">Rend. mín.</th>
                  <th className="px-3 py-2 text-right font-semibold">Cumplimiento</th>
                  <th className="px-3 py-2 text-right font-semibold">Horas HN</th>
                  <th className="px-3 py-2 text-right font-semibold">Horas rend.</th>
                  <th className="px-3 py-2 text-right font-semibold">Horas totales</th>
                </tr>
              </thead>
              <tbody>
                {data.weeklyRows.map((row) => {
                  const tone = getComplianceTone(row.cumplimiento);
                  const isSelected = selectedRow?.isoWeekId === row.isoWeekId;
                  return (
                    <tr
                      key={row.isoWeekId}
                      className={cn("border-t border-border/40 hover:bg-muted/24", isSelected && "bg-muted/35")}
                      onClick={() => setSelectedWeek(row.isoWeekId)}
                    >
                      <td className="px-3 py-2 font-semibold">{row.isoWeekId}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(row.rendimiento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(row.rendimientoMin)}</td>
                      <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", toneClass(tone))}>{pct(row.cumplimiento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums"><HoursValue value={row.actualHoursHn} total={row.totalActualHours} /></td>
                      <td className="px-3 py-2 text-right tabular-nums"><HoursValue value={row.actualHoursRend} total={row.totalActualHours} /></td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatNumber(row.totalActualHours)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
