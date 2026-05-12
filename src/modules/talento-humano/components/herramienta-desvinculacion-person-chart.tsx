"use client";

import { useMemo } from "react";
import { LineChart as LineIcon, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import type { DesvinculacionPersonHistory } from "@/lib/talento-humano-herramienta-desvinculacion";
import {
  RechartsTooltipAdapter,
  axisConfig,
  axisTickStyleCompact,
  gridConfig,
  tooltipCursorStyle,
} from "@/shared/charts";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { EmptyState } from "@/shared/data-display/empty-state";
import { ChartSection } from "@/shared/layout/filter-panel";
import {
  formatDecimal,
  formatInteger,
  formatIsoWeekLabel,
  formatPercent,
} from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const COLOR_CUMPLIMIENTO = "var(--color-chart-success-bold)";
const COLOR_HREND = "var(--color-chart-info-bold)";
const COLOR_HORAS = "var(--color-chart-warning)";

function personFetcher(url: string) {
  return fetchJson<DesvinculacionPersonHistory>(url, "No se pudo cargar el historial del colaborador.");
}

function formatRatio(value: number | null | undefined) {
  return value == null ? "—" : formatPercent(value, {
    input: "ratio",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function pctTickFormatter(value: number) {
  return formatPercent(value, {
    input: "ratio",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function PersonEvolutionChart({
  personId,
  fallbackName,
  onClose,
}: {
  personId: string;
  fallbackName?: string | null;
  onClose: () => void;
}) {
  const url = `/api/talento-humano/herramienta-desvinculacion/history?personId=${encodeURIComponent(personId)}`;
  const { data, error, isLoading } = useSWR<DesvinculacionPersonHistory>(url, personFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
    shouldRetryOnError: true,
    errorRetryCount: 1,
    errorRetryInterval: 2_000,
  });

  const chartData = useMemo(() => {
    const weeks = data?.weeks ?? [];
    return weeks.map((week) => ({
      isoWeekId: week.isoWeekId,
      weekLabel: formatIsoWeekLabel(week.isoWeekId),
      cumplimiento: week.cumplimiento,
      pctHoursRend: week.pctHoursRend,
      totalActualHours: week.totalActualHours,
      rendimiento: week.rendimiento,
      rendimientoMin: week.rendimientoMin,
    }));
  }, [data?.weeks]);

  const title = data?.personName ?? fallbackName ?? personId;
  const subtitle = data?.weeks.length
    ? `${formatInteger(data.weeks.length)} semanas registradas`
    : "Sin historial registrado";

  return (
    <Card className="starter-panel border-border/70 bg-card/86">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LineIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-lg font-semibold">Evolución semanal · {title}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar evolución">
            <X className="size-4" aria-hidden="true" />
            Cerrar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "No se pudo cargar el historial."}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : chartData.length === 0 ? (
          <EmptyState label="Sin semanas registradas para este colaborador." />
        ) : (
          <ChartSection>
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartSurface title="Cumplimiento y % horas con rendimiento" subtitle="Ratios por semana ISO.">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid {...gridConfig} />
                      <XAxis dataKey="weekLabel" {...axisConfig} tick={axisTickStyleCompact} interval="preserveStartEnd" />
                      <YAxis tickFormatter={pctTickFormatter} {...axisConfig} tick={axisTickStyleCompact} domain={[0, "auto"]} />
                      <Tooltip
                        cursor={tooltipCursorStyle}
                        content={(
                          <RechartsTooltipAdapter
                            title={(label) => `Semana ${label}`}
                            mapPayload={(payloadEntries) => {
                              const first = payloadEntries[0];
                              const source = first?.payload as
                                | { cumplimiento?: number | null; pctHoursRend?: number | null; rendimiento?: number | null; rendimientoMin?: number | null }
                                | undefined;
                              return [
                                { label: "Cumplimiento", value: formatRatio(source?.cumplimiento) },
                                { label: "H rend %", value: formatRatio(source?.pctHoursRend) },
                                { label: "Rendimiento", value: source?.rendimiento == null ? "—" : formatDecimal(source.rendimiento, 2) },
                                { label: "Rend. mínimo", value: source?.rendimientoMin == null ? "—" : formatDecimal(source.rendimientoMin, 2) },
                              ];
                            }}
                          />
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumplimiento"
                        name="Cumplimiento"
                        stroke={COLOR_CUMPLIMIENTO}
                        strokeWidth={2}
                        dot={{ r: 2, fill: COLOR_CUMPLIMIENTO }}
                        connectNulls
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pctHoursRend"
                        name="H rend %"
                        stroke={COLOR_HREND}
                        strokeWidth={2}
                        dot={{ r: 2, fill: COLOR_HREND }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_CUMPLIMIENTO }} aria-hidden="true" />
                    Cumplimiento
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_HREND }} aria-hidden="true" />
                    H rend %
                  </span>
                </div>
              </ChartSurface>

              <ChartSurface title="Horas presenciales por semana" subtitle="Total de horas registradas en la semana.">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid {...gridConfig} />
                      <XAxis dataKey="weekLabel" {...axisConfig} tick={axisTickStyleCompact} interval="preserveStartEnd" />
                      <YAxis {...axisConfig} tick={axisTickStyleCompact} />
                      <Tooltip
                        cursor={tooltipCursorStyle}
                        content={(
                          <RechartsTooltipAdapter
                            title={(label) => `Semana ${label}`}
                            mapPayload={(payloadEntries) => {
                              const first = payloadEntries[0];
                              const source = first?.payload as { totalActualHours?: number } | undefined;
                              return [
                                { label: "Horas presenciales", value: formatDecimal(source?.totalActualHours ?? 0, 1) },
                              ];
                            }}
                          />
                        )}
                      />
                      <Bar dataKey="totalActualHours" name="Horas presenciales" fill={COLOR_HORAS} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_HORAS }} aria-hidden="true" />
                    Horas presenciales (total)
                  </span>
                </div>
              </ChartSurface>
            </div>
          </ChartSection>
        )}
      </CardContent>
    </Card>
  );
}
