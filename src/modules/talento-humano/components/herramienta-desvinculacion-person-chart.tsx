"use client";

import { useMemo } from "react";
import { LineChart as LineIcon, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Dot,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DesvinculacionToolRow } from "@/lib/talento-humano-herramienta-desvinculacion";
import {
  RULES_CONSTANTS,
  estadoMeta,
  isValidWeek,
  type WeekDatum,
} from "@/lib/talento-humano-desvinculacion-rules";
import {
  RechartsTooltipAdapter,
  axisConfig,
  axisTickStyleCompact,
  gridConfig,
  tooltipCursorStyle,
} from "@/shared/charts";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { ChartSection } from "@/shared/layout/filter-panel";
import {
  formatDecimal,
  formatInteger,
  formatIsoWeekLabel,
  formatPercent,
} from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const COLOR_CUMPLIMIENTO = "var(--color-chart-success-bold)";
const COLOR_HREND = "var(--color-chart-info-bold)";
const COLOR_HORAS_VALID = "var(--color-chart-warning)";
const COLOR_HORAS_INVALID = "var(--color-chart-neutral)";

type ChartDatum = {
  isoWeekId: string;
  weekLabel: string;
  cumplimiento: number | null;
  pctHoursRend: number | null;
  totalActualHours: number;
  isValid: boolean;
};

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

type ValidityDotProps = {
  cx?: number;
  cy?: number;
  stroke?: string;
  payload?: ChartDatum;
};

function ValidityDot(props: ValidityDotProps) {
  const { cx, cy, stroke, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isValid = payload.isValid;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={isValid ? 4 : 3.5}
      stroke={stroke}
      strokeWidth={isValid ? 0 : 1.5}
      fill={isValid ? stroke : "var(--color-background)"}
    />
  );
}

export function PersonEvolutionChart({
  row,
  onClose,
}: {
  row: DesvinculacionToolRow;
  onClose: () => void;
}) {
  const meta = estadoMeta(row.estado);

  const chartData: ChartDatum[] = useMemo(() => {
    return row.window.map((week: WeekDatum) => ({
      isoWeekId: week.isoWeekId,
      weekLabel: formatIsoWeekLabel(week.isoWeekId),
      cumplimiento: week.cumplimiento,
      pctHoursRend: week.totalActualHours > 0 ? week.actualHoursRend / week.totalActualHours : null,
      totalActualHours: week.totalActualHours,
      isValid: isValidWeek(week),
    }));
  }, [row.window]);

  const subtitleParts: string[] = [];
  subtitleParts.push(`${row.validWeeks} de ${row.totalWeeksInWindow} semanas válidas`);
  if (row.mkTau !== null) subtitleParts.push(`τ = ${row.mkTau.toFixed(2)}`);
  if (row.mkZ !== null) subtitleParts.push(`Z = ${row.mkZ.toFixed(2)}`);
  if (row.slopePerWeek !== null) {
    const pp = row.slopePerWeek * 100;
    const sign = pp >= 0 ? "+" : "";
    subtitleParts.push(`${sign}${pp.toFixed(2)} pp/sem`);
  }
  const subtitle = subtitleParts.join(" · ");

  return (
    <Card className="starter-panel border-border/70 bg-card/86">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <LineIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-lg font-semibold">
                Evolución 12 semanas · {row.personName}
              </CardTitle>
              <Badge variant={meta.badgeVariant}>{meta.emoji} {meta.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
            <p className="text-xs text-muted-foreground italic">{meta.description}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar evolución">
            <X className="size-4" aria-hidden="true" />
            Cerrar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin semanas registradas en la ventana.</p>
        ) : (
          <ChartSection>
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartSurface
                title="Cumplimiento y % H rend"
                subtitle={`Punto relleno = semana válida (≥ ${RULES_CONSTANTS.MIN_HOURS_PRESENCIALES}h y H rend > ${(RULES_CONSTANTS.MIN_H_REND_RATIO * 100).toFixed(0)}%).`}
              >
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid {...gridConfig} />
                      <XAxis dataKey="weekLabel" {...axisConfig} tick={axisTickStyleCompact} interval="preserveStartEnd" />
                      <YAxis tickFormatter={pctTickFormatter} {...axisConfig} tick={axisTickStyleCompact} domain={[0, "auto"]} />
                      <ReferenceLine
                        y={RULES_CONSTANTS.CUMPLIMIENTO_TARGET}
                        stroke="var(--color-border)"
                        strokeDasharray="4 4"
                        label={{ value: "Objetivo 100%", position: "insideTopRight", fill: "var(--color-muted-foreground)", fontSize: 10 }}
                      />
                      <ReferenceLine
                        y={RULES_CONSTANTS.CUMPLIMIENTO_LOW}
                        stroke="var(--color-chart-warning)"
                        strokeDasharray="4 4"
                        label={{ value: "Alerta 90%", position: "insideBottomRight", fill: "var(--color-chart-warning)", fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={tooltipCursorStyle}
                        content={(
                          <RechartsTooltipAdapter
                            title={(label) => `Semana ${label}`}
                            mapPayload={(payloadEntries) => {
                              const first = payloadEntries[0];
                              const source = first?.payload as ChartDatum | undefined;
                              return [
                                { label: "Semana válida", value: source?.isValid ? "Sí" : "No" },
                                { label: "Cumplimiento", value: formatRatio(source?.cumplimiento) },
                                { label: "H rend %", value: formatRatio(source?.pctHoursRend) },
                                { label: "Horas presenciales", value: formatDecimal(source?.totalActualHours ?? 0, 1) },
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
                        dot={<ValidityDot stroke={COLOR_CUMPLIMIENTO} />}
                        connectNulls
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pctHoursRend"
                        name="H rend %"
                        stroke={COLOR_HREND}
                        strokeWidth={2}
                        dot={<ValidityDot stroke={COLOR_HREND} />}
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
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full border" style={{ backgroundColor: "transparent", borderColor: COLOR_CUMPLIMIENTO }} aria-hidden="true" />
                    Semana inválida
                  </span>
                </div>
              </ChartSurface>

              <ChartSurface
                title="Horas presenciales por semana"
                subtitle={`Línea de alerta en ${RULES_CONSTANTS.MIN_HOURS_PRESENCIALES} h. Barras tenues = semanas inválidas.`}
              >
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid {...gridConfig} />
                      <XAxis dataKey="weekLabel" {...axisConfig} tick={axisTickStyleCompact} interval="preserveStartEnd" />
                      <YAxis {...axisConfig} tick={axisTickStyleCompact} />
                      <ReferenceLine
                        y={RULES_CONSTANTS.MIN_HOURS_PRESENCIALES}
                        stroke="var(--color-chart-warning)"
                        strokeDasharray="4 4"
                        label={{ value: `${RULES_CONSTANTS.MIN_HOURS_PRESENCIALES} h`, position: "insideTopRight", fill: "var(--color-chart-warning)", fontSize: 10 }}
                      />
                      <Tooltip
                        cursor={tooltipCursorStyle}
                        content={(
                          <RechartsTooltipAdapter
                            title={(label) => `Semana ${label}`}
                            mapPayload={(payloadEntries) => {
                              const first = payloadEntries[0];
                              const source = first?.payload as ChartDatum | undefined;
                              return [
                                { label: "Semana válida", value: source?.isValid ? "Sí" : "No" },
                                { label: "Horas presenciales", value: formatDecimal(source?.totalActualHours ?? 0, 1) },
                              ];
                            }}
                          />
                        )}
                      />
                      <Bar dataKey="totalActualHours" name="Horas presenciales" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.isoWeekId}
                            fill={entry.isValid ? COLOR_HORAS_VALID : COLOR_HORAS_INVALID}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_HORAS_VALID }} aria-hidden="true" />
                    Semana válida
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_HORAS_INVALID }} aria-hidden="true" />
                    Semana inválida (poca presencia o baja H rend %)
                  </span>
                </div>
              </ChartSurface>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Reglas:</strong> {formatInteger(row.validWeeks)} de {formatInteger(row.totalWeeksInWindow)} semanas válidas. Una semana se considera válida cuando hubo más de {(RULES_CONSTANTS.MIN_H_REND_RATIO * 100).toFixed(0)}% de tiempo en actividades con rendimiento y al menos {RULES_CONSTANTS.MIN_HOURS_PRESENCIALES} horas presenciales.
            </p>
          </ChartSection>
        )}
      </CardContent>
    </Card>
  );
}
