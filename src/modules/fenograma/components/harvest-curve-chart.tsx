"use client";

import { memo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";
import { axisConfig, axisTickStyle, gridConfig } from "@/shared/charts/chart-axis-config";
import { formatFlexibleNumber } from "@/shared/lib/format";
import type { HarvestCurvePoint, HarvestCurvePayload } from "@/lib/fenograma";

type HarvestCurveSummary = HarvestCurvePayload["summary"];

type HarvestCurveChartProps = {
  data: HarvestCurvePoint[];
  projectionStartDay: number | null;
  summary?: HarvestCurveSummary | null;
};

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

export const HarvestCurveChart = memo(function HarvestCurveChart({
  data,
  projectionStartDay,
  summary,
}: HarvestCurveChartProps) {
  const projectionEndDay = data[data.length - 1]?.eventDay ?? null;
  const showWeightBar = summary && (summary.totalGreenWeightKg > 0 || summary.totalPostWeightKg > 0);

  return (
    <div className="w-full space-y-3">
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={420}>
          <ComposedChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="harvestCurveFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="harvestProjectionFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.18} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridConfig} />
            <XAxis {...axisConfig} dataKey="eventDay" tick={axisTickStyle} />
            <YAxis
              {...axisConfig}
              tick={axisTickStyle}
              tickFormatter={(value) => formatFlexibleNumber(Number(value))}
            />
            <Tooltip
              content={
                <RechartsTooltipAdapter
                  title={(label, payload) => {
                    const point = payload?.[0]?.payload as HarvestCurvePoint | undefined;
                    return `Dia ${label}${point?.eventDate ? ` · ${point.eventDate}` : ""}`;
                  }}
                  mapPayload={(payload) => {
                    const point = payload[0]?.payload as HarvestCurvePoint | undefined;
                    if (!point) return [];

                    const accumulated = point.observedCumulativeStems ?? point.projectedCumulativeStems ?? null;
                    const hasWeight = point.dailyGreenKg > 0;

                    return [
                      { label: "Tallos acumulados", value: accumulated !== null ? formatFlexibleNumber(accumulated) : "-" },
                      { label: "Tallos dia", value: formatFlexibleNumber(point.dailyStems) },
                      ...(hasWeight
                        ? [
                            { label: "Kg acumulado", value: formatFlexibleNumber(point.cumulativeGreenKg) },
                            { label: "Kg dia", value: formatFlexibleNumber(point.dailyGreenKg) },
                            {
                              label: "Peso / tallo acum.",
                              value: point.cumulativeWeightPerStemG !== null ? `${formatFlexibleNumber(point.cumulativeWeightPerStemG)} g` : "-",
                            },
                            {
                              label: "Peso / tallo dia",
                              value: point.dailyWeightPerStemG !== null ? `${formatFlexibleNumber(point.dailyWeightPerStemG)} g` : "-",
                            },
                          ]
                        : []),
                    ];
                  }}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {projectionStartDay && projectionEndDay ? (
              <ReferenceArea
                fill="url(#harvestProjectionFill)"
                fillOpacity={1}
                ifOverflow="extendDomain"
                x1={projectionStartDay}
                x2={projectionEndDay}
              />
            ) : null}
            <Area
              dataKey="dailyStems"
              fill="url(#harvestCurveFill)"
              name="Corte diario"
              stroke="transparent"
              type="monotone"
              yAxisId={0}
            />
            <Line
              activeDot={{ fill: "var(--color-primary)", r: 4.5, strokeWidth: 0 }}
              dataKey="observedCumulativeStems"
              dot={false}
              name="Acumulado real"
              stroke="var(--color-primary)"
              strokeLinecap="round"
              strokeWidth={3}
              type="monotone"
              yAxisId={0}
            />
            <Line
              activeDot={{ fill: "var(--color-accent)", r: 4.5, strokeWidth: 0 }}
              dataKey="projectedCumulativeStems"
              dot={false}
              name="Acumulado proyectado"
              stroke="color-mix(in oklab, var(--color-accent) 68%, var(--color-foreground) 32%)"
              strokeDasharray="8 6"
              strokeLinecap="round"
              strokeWidth={3}
              type="monotone"
              yAxisId={0}
            />
            {projectionStartDay ? (
              <ReferenceLine
                ifOverflow="extendDomain"
                label={{
                  fill: "var(--color-muted-foreground)",
                  fontSize: 11,
                  position: "top",
                  value: "Inicio proyeccion",
                }}
                stroke="color-mix(in oklab, var(--color-foreground) 58%, var(--color-accent) 42%)"
                strokeDasharray="6 4"
                strokeWidth={2}
                x={projectionStartDay}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {showWeightBar ? (
        <div className="flex flex-wrap gap-2 px-1">
          <MetricBadge label="Cajas verde:" value={formatFlexibleNumber(summary.greenBoxes)} />
          <MetricBadge label="Cajas blanco:" value={formatFlexibleNumber(summary.postBoxes)} />
          {summary.weightPerStemG !== null ? (
            <MetricBadge label="Peso/tallo:" value={`${formatFlexibleNumber(summary.weightPerStemG)} g`} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
