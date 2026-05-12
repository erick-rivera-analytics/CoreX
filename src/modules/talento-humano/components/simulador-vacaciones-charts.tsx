"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VacationSimulatorSummary } from "@/lib/talento-humano-vacaciones";
import {
  RechartsTooltipAdapter,
  axisConfig,
  axisTickStyle,
  axisTickStyleCompact,
  gridConfig,
  tooltipCursorStyle,
} from "@/shared/charts";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { ChartSection } from "@/shared/layout/filter-panel";
import { formatInteger } from "@/shared/lib/format";

const COLOR_AREA = "var(--color-chart-info-bold)";
const COLOR_DONUT = [
  "var(--color-chart-info-bold)",
  "var(--color-chart-success-bold)",
  "var(--color-chart-warning)",
  "var(--color-chart-danger)",
  "var(--color-chart-neutral)",
];

export function VacationCharts({ summary }: { summary: VacationSimulatorSummary }) {
  const chartAreaData = summary.byArea.slice(0, 10).map((entry) => ({
    areaName: entry.areaName,
    disponibles: entry.disponibles,
    total: entry.total,
  }));

  const chartClassificationData = summary.byJobClassification.slice(0, 5).map((entry, index) => ({
    label: entry.label,
    value: Math.max(0, entry.disponibles),
    total: entry.total,
    fill: COLOR_DONUT[index % COLOR_DONUT.length] ?? COLOR_AREA,
  }));

  const totalDonut = chartClassificationData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <ChartSection>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSurface title="Días disponibles por área" subtitle="Top 10 áreas con mayor provisión disponible.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartAreaData}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
              >
                <CartesianGrid {...gridConfig} horizontal vertical={false} />
                <XAxis type="number" {...axisConfig} tick={axisTickStyle} />
                <YAxis
                  type="category"
                  dataKey="areaName"
                  width={140}
                  {...axisConfig}
                  tick={axisTickStyleCompact}
                />
                <Tooltip
                  cursor={tooltipCursorStyle}
                  content={(
                    <RechartsTooltipAdapter
                      title={(label) => String(label)}
                      mapPayload={(payloadEntries) => {
                        const first = payloadEntries[0];
                        const source = first?.payload as { disponibles?: number; total?: number } | undefined;
                        return [
                          { label: "Disponibles", value: formatInteger(source?.disponibles ?? 0) },
                          { label: "Colaboradores", value: formatInteger(source?.total ?? 0) },
                        ];
                      }}
                    />
                  )}
                />
                <Bar dataKey="disponibles" fill={COLOR_AREA} radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartSurface>

        <ChartSurface title="Días disponibles por clasificación" subtitle="Top 5 clasificaciones laborales.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={(
                    <RechartsTooltipAdapter
                      mapPayload={(payloadEntries) => {
                        const first = payloadEntries[0];
                        const source = first?.payload as { label?: string; value?: number; total?: number } | undefined;
                        return [
                          { label: "Clasificación", value: source?.label ?? "—" },
                          { label: "Disponibles", value: formatInteger(source?.value ?? 0) },
                          { label: "Colaboradores", value: formatInteger(source?.total ?? 0) },
                        ];
                      }}
                    />
                  )}
                />
                <Pie
                  data={chartClassificationData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={1}
                >
                  {chartClassificationData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {totalDonut > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {chartClassificationData.map((entry) => (
                <span
                  key={entry.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                    aria-hidden="true"
                  />
                  {entry.label}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatInteger(entry.value)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </ChartSurface>
      </div>
    </ChartSection>
  );
}
