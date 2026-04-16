import { memo } from "react";

import type { FenogramaWeeklyTotal } from "@/lib/fenograma";
import { formatInteger } from "@/shared/lib/format";

export const FenogramaWeeklyBarsChart = memo(function FenogramaWeeklyBarsChart({
  data,
}: {
  data: FenogramaWeeklyTotal[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/60 text-sm text-muted-foreground">
        No hay acumulado semanal para los filtros actuales.
      </div>
    );
  }

  const width = 960;
  const height = 260;
  const padding = {
    top: 16,
    right: 16,
    bottom: 52,
    left: 72,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map((entry) => entry.stems), 1);
  const barWidth = chartWidth / data.length;
  const labelStep = data.length > 24 ? Math.ceil(data.length / 12) : 1;
  const gridSteps = 4;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, index) => {
    const value = Math.round((maxValue * (gridSteps - index)) / gridSteps);
    const y = padding.top + (chartHeight * index) / gridSteps;

    return { value, y };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[260px] min-w-[720px] w-full"
        role="img"
        aria-label="Acumulado semanal de tallos"
      >
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--color-border)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--color-muted-foreground)"
            >
              {formatInteger(tick.value)}
            </text>
          </g>
        ))}

        {data.map((entry, index) => {
          const barHeight = (entry.stems / maxValue) * chartHeight;
          const x = padding.left + index * barWidth + barWidth * 0.14;
          const y = padding.top + chartHeight - barHeight;
          const renderedBarWidth = Math.max(barWidth * 0.72, 6);
          const showLabel = index % labelStep === 0 || index === data.length - 1;

          return (
            <g key={entry.week}>
              <rect
                x={x}
                y={y}
                width={renderedBarWidth}
                height={Math.max(barHeight, 2)}
                rx="8"
                ry="8"
                fill="var(--color-slate-900)"
              >
                <title>{`${entry.week}: ${formatInteger(entry.stems)} tallos`}</title>
              </rect>
              {showLabel ? (
                <text
                  x={x + renderedBarWidth / 2}
                  y={height - 18}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--color-muted-foreground)"
                >
                  {entry.week}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
