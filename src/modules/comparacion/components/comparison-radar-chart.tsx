"use client";

import { memo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { RechartsTooltipAdapter } from "@/shared/charts/chart-tooltip";

type RadarPoint = {
  label: string;
  maxLabel?: string;
  left: number;
  right: number;
  leftDisplay?: string;
  rightDisplay?: string;
};

type ComparisonRadarChartProps = {
  data: RadarPoint[];
  leftLabel: string;
  rightLabel: string;
};

const COLOR_A = "var(--color-chart-info-bold)";
const COLOR_B = "var(--color-chart-warning)";

function AxisTick({
  x,
  y,
  payload,
  data,
}: {
  x: number;
  y: number;
  payload: { value: string };
  data: RadarPoint[];
}) {
  const point = data.find((d) => d.label === payload.value);
  return (
    <g>
      <text
        x={x}
        y={y - 4}
        textAnchor="middle"
        fill="var(--color-muted-foreground)"
        fontFamily="var(--font-app), Inter, sans-serif"
        fontSize={11}
        fontWeight={600}
      >
        {payload.value}
      </text>
      {point?.maxLabel ? (
        <text
          x={x}
          y={y + 10}
          textAnchor="middle"
          fill="var(--color-muted-foreground)"
          fontFamily="var(--font-app), Inter, sans-serif"
          fontSize={9}
          opacity={0.55}
        >
          máx {point.maxLabel}
        </text>
      ) : null}
    </g>
  );
}

export const ComparisonRadarChart = memo(function ComparisonRadarChart({
  data,
  leftLabel,
  rightLabel,
}: ComparisonRadarChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={320} minWidth={320}>
        <RadarChart data={data}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="label"
            tick={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((props: any) => (
                <AxisTick x={props.x} y={props.y} payload={props.payload} data={data} />
              )) as unknown as React.SVGProps<SVGTextElement>
            }
          />
          <Tooltip
            content={
              <RechartsTooltipAdapter
                title={(label) => String(label)}
                mapPayload={(payload) =>
                  payload.map((item) => {
                    const point = item.payload as RadarPoint;
                    const isLeft = item.name === leftLabel || item.name === "left";

                    return {
                      label: isLeft ? leftLabel : rightLabel,
                      value: isLeft
                        ? point.leftDisplay ?? String(item.value ?? "-")
                        : point.rightDisplay ?? String(item.value ?? "-"),
                    };
                  })
                }
              />
            }
          />
          <Radar
            dataKey="left"
            fill={COLOR_A}
            fillOpacity={0.22}
            name={leftLabel}
            stroke={COLOR_A}
            strokeWidth={2.2}
          />
          <Radar
            dataKey="right"
            fill={COLOR_B}
            fillOpacity={0.18}
            name={rightLabel}
            stroke={COLOR_B}
            strokeWidth={2.2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
});
