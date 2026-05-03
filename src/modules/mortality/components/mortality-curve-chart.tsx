"use client";

import { memo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPercent, formatFlexibleNumber } from "@/shared/lib/format";
import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";
import { axisConfig, axisTickStyle, gridConfig } from "@/shared/charts/chart-axis-config";
import type { MortalityCurvePoint } from "@/lib/mortality";

type MortalityCurveChartProps = {
  data: MortalityCurvePoint[];
};

export const MortalityCurveChart = memo(function MortalityCurveChart({ data }: MortalityCurveChartProps) {
  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={420}>
        <ComposedChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="mortalityCumulativeFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-line-primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-line-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridConfig} />
          <XAxis
            {...axisConfig}
            dataKey="eventDay"
            tick={axisTickStyle}
          />
          <YAxis
            {...axisConfig}
            tick={axisTickStyle}
            tickFormatter={(value) => formatPercent(Number(value))}
          />
          <Tooltip
            content={
              <RechartsTooltipAdapter
                title={(label, payload) => {
                  const point = payload?.[0]?.payload as MortalityCurvePoint | undefined;
                  return point ? `Día ${label} / ${point.calendarDate}` : `Día ${label}`;
                }}
                mapPayload={(payload) => {
                  const seen = new Set<unknown>();
                  const out: Array<{ label: string; value: string }> = [];
                  for (const entry of payload) {
                    if (seen.has(entry.name)) continue;
                    seen.add(entry.name);
                    out.push({
                      label: String(entry.name ?? ""),
                      value:
                        entry.name === "Mortandad diaria" || entry.name === "Mortandad acumulada"
                          ? formatPercent(Number(entry.value))
                          : formatFlexibleNumber(Number(entry.value)),
                    });
                  }
                  return out;
                }}
              />
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            dataKey="cumulativeMortalityPct"
            fill="url(#mortalityCumulativeFill)"
            name="Mortandad acumulada"
            stroke="transparent"
            type="monotone"
          />
          <Line
            activeDot={{ fill: "var(--chart-line-primary)", r: 4.5, strokeWidth: 0 }}
            dataKey="cumulativeMortalityPct"
            dot={false}
            name="Mortandad acumulada"
            stroke="var(--chart-line-primary)"
            strokeLinecap="round"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            activeDot={{ fill: "var(--chart-line-secondary)", r: 4, strokeWidth: 0 }}
            dataKey="dailyMortalityPct"
            dot={false}
            name="Mortandad diaria"
            stroke="var(--chart-line-secondary)"
            strokeDasharray="7 5"
            strokeLinecap="round"
            strokeWidth={2.4}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});
