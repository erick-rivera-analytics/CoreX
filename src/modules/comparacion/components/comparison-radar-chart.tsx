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
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
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
            fill="var(--color-primary)"
            fillOpacity={0.18}
            name={leftLabel}
            stroke="var(--color-primary)"
            strokeWidth={2}
          />
          <Radar
            dataKey="right"
            fill="var(--color-accent)"
            fillOpacity={0.12}
            name={rightLabel}
            stroke="var(--color-accent)"
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
});
