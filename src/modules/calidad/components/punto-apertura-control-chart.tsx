"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { EmptyState } from "@/shared/data-display/empty-state";
import { formatPercent } from "@/shared/lib/format";
import { CALIDAD_CHART_COLORS } from "@/lib/calidad-chart-colors";
import type { PuntoAperturaRecord } from "@/lib/calidad-punto-apertura";

type ChartPoint = PuntoAperturaRecord & {
  chartIndex: number;
};

export function PuntoAperturaControlChart({
  records,
  meanPct,
  lowerLimitPct,
  onRecordClick,
}: {
  records: PuntoAperturaRecord[];
  meanPct: number;
  lowerLimitPct: number;
  onRecordClick: (record: PuntoAperturaRecord) => void;
}) {
  const chartData = records.map((record, index) => ({
    ...record,
    chartIndex: index + 1,
  }));

  if (!chartData.length) {
    return <EmptyState label="No hay registros de punto de apertura para los filtros seleccionados." />;
  }

  return (
    <div className="h-[430px] min-w-0 rounded-[28px] border border-border/70 bg-background/80 p-3">
      <ResponsiveContainer width="100%" height="100%" minHeight={400}>
        <ScatterChart margin={{ top: 24, right: 24, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.45} />
          <XAxis
            type="number"
            dataKey="chartIndex"
            name="Registro"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            domain={["dataMin", "dataMax"]}
          />
          <YAxis
            type="number"
            dataKey="dominantePct"
            name="Participación"
            unit="%"
            domain={[0, 105]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <ZAxis range={[54, 54]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as ChartPoint | undefined;
              if (!point) return null;
              return (
                <div className="rounded-2xl border border-border/80 bg-popover px-3 py-2 text-xs shadow-xl">
                  <p className="font-semibold">{point.fecha} · Bloque {point.bloque}</p>
                  <p className="text-muted-foreground">{point.ciclo}</p>
                  <p className="mt-1">Dominante: <span className="font-medium">{point.dominanteClase}</span></p>
                  <p>Participación: <span className="font-medium">{formatPercent(point.dominantePct)}</span></p>
                  <p className={point.estado === "Homogeneo" ? "text-emerald-600" : "text-amber-600"}>{point.estado}</p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={meanPct}
            stroke={CALIDAD_CHART_COLORS.referenceLine.mean}
            strokeDasharray="6 4"
            label={{ value: `Media ${meanPct.toFixed(1)}%`, position: "insideTopRight", fill: CALIDAD_CHART_COLORS.referenceLine.mean, fontSize: 12 }}
          />
          <ReferenceLine
            y={lowerLimitPct}
            stroke={CALIDAD_CHART_COLORS.referenceLine.limit}
            strokeDasharray="6 4"
            label={{ value: `Límite ${lowerLimitPct.toFixed(1)}%`, position: "insideBottomRight", fill: CALIDAD_CHART_COLORS.referenceLine.limit, fontSize: 12 }}
          />
          <Scatter
            data={chartData}
            dataKey="dominantePct"
            shape={(props: unknown) => <ControlDot {...(props as DotProps)} onRecordClick={onRecordClick} />}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  onRecordClick: (record: PuntoAperturaRecord) => void;
};

function ControlDot({ cx = 0, cy = 0, payload, onRecordClick }: DotProps) {
  if (!payload) return null;

  const isOk = payload.estado === "Homogeneo";
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Ver registro ${payload.fecha} ${payload.ciclo}`}
      onClick={() => onRecordClick(payload)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onRecordClick(payload);
        }
      }}
      className="cursor-pointer outline-none"
    >
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill={isOk ? CALIDAD_CHART_COLORS.status.homogeneous : CALIDAD_CHART_COLORS.status.nonHomogeneous}
        stroke={isOk ? CALIDAD_CHART_COLORS.status.homogeneousStroke : CALIDAD_CHART_COLORS.status.nonHomogeneousStroke}
        strokeWidth={1.5}
      />
    </g>
  );
}
