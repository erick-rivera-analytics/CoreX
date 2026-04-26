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

import { ChartSurface } from "@/shared/data-display/chart-surface";
import { EmptyState } from "@/shared/data-display/empty-state";
import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";
import { axisConfig, axisTickStyleCompact, gridConfig, tooltipCursorStyle } from "@/shared/charts/chart-axis-config";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import type { TalentoPersonRecord } from "@/lib/talento-humano";

import {
  BAR_COLORS,
  type TalentoGroup,
} from "@/modules/talento-humano/components/talento-view-utils";

export function DistributionChart<T extends TalentoPersonRecord>({
  title,
  data,
  onSelect,
  colorOffset = 0,
}: {
  title: string;
  data: TalentoGroup<T>[];
  onSelect: (group: TalentoGroup<T>) => void;
  colorOffset?: number;
}) {
  const height = Math.max(220, Math.min(data.length * 34 + 70, 430));

  return (
    <ChartSurface title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridConfig} horizontal={false} />
            <XAxis {...axisConfig} type="number" tick={axisTickStyleCompact} />
            <YAxis
              {...axisConfig}
              type="category"
              dataKey="label"
              width={132}
              tick={axisTickStyleCompact}
              tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}...` : value)}
            />
            <Tooltip
              cursor={tooltipCursorStyle}
              content={(
                <RechartsTooltipAdapter
                  title={(label) => String(label)}
                  mapPayload={(payload) =>
                    payload.map((entry) => ({
                      label: "Personas",
                      value: typeof entry.value === "number" ? formatInteger(entry.value) : "0",
                    }))
                  }
                />
              )}
            />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              cursor="pointer"
              onClick={(entry: unknown) => {
                const group = (entry as { payload?: TalentoGroup<T> }).payload;
                if (group) onSelect(group);
              }}
            >
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={BAR_COLORS[(colorOffset + index) % BAR_COLORS.length]} fillOpacity={0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState label="Sin datos para graficar." />
      )}
    </ChartSurface>
  );
}

export function DistributionSummaryCard<T extends TalentoPersonRecord>({
  title,
  data,
  onSelect,
}: {
  title: string;
  data: TalentoGroup<T>[];
  onSelect: (group: TalentoGroup<T>) => void;
}) {
  const total = data.reduce((sum, group) => sum + group.count, 0);
  const top = data.slice(0, 6);
  const dominant = top[0];

  return (
    <ChartSurface title={title}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{dominant ? formatInteger(dominant.count) : "0"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Mayor concentracion</p>
        </div>
        <div className="grid size-16 place-items-center rounded-full border-4 border-slate-400 bg-background text-center text-[10px] font-semibold dark:border-slate-500">
          {dominant ? formatPercent(total ? dominant.count / total : 0, { input: "ratio" }) : "-"}
        </div>
      </div>
      {dominant ? (
        <button type="button" className="mt-3 max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => onSelect(dominant)}>
          {dominant.label}
        </button>
      ) : null}
      <div className="mt-4 grid gap-2">
        {top.map((group, index) => (
          <button
            type="button"
            key={group.label}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-border/60 bg-background/60 px-3 py-2 text-left hover:bg-muted/35"
            onClick={() => onSelect(group)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} />
              <span className="truncate text-xs font-medium">{group.label}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatInteger(group.count)} · {formatPercent(total ? group.count / total : 0, { input: "ratio" })}
            </span>
          </button>
        ))}
      </div>
    </ChartSurface>
  );
}

export function DonutChart<T extends TalentoPersonRecord>({
  title,
  data,
  onSelect,
}: {
  title: string;
  data: TalentoGroup<T>[];
  onSelect: (group: TalentoGroup<T>) => void;
}) {
  const top = data.slice(0, 6);
  const total = data.reduce((sum, group) => sum + group.count, 0);

  return (
    <ChartSurface title={title}>
      {top.length ? (
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <PieChart width={160} height={160}>
              <Pie
                data={top}
                dataKey="count"
                nameKey="label"
                innerRadius={48}
                outerRadius={76}
                paddingAngle={2}
                onClick={(entry: unknown) => {
                  const group = (entry as { payload?: TalentoGroup<T> }).payload;
                  if (group) onSelect(group);
                }}
                cursor="pointer"
              >
                {top.map((entry, index) => (
                  <Cell key={entry.label} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={(
                  <RechartsTooltipAdapter
                    title={(label) => String(label)}
                    mapPayload={(payload) =>
                      payload.map((entry) => ({
                        label: "Personas",
                        value: typeof entry.value === "number" ? formatInteger(entry.value) : "0",
                      }))
                    }
                  />
                )}
              />
            </PieChart>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {top.map((entry, index) => (
              <button key={entry.label} type="button" className="flex items-center justify-between gap-2 text-left hover:opacity-75" onClick={() => onSelect(entry)}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} />
                  <span className="truncate text-xs">{entry.label}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{formatPercent(total ? entry.count / total : 0, { input: "ratio", minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState label="Sin datos." />
      )}
    </ChartSurface>
  );
}
