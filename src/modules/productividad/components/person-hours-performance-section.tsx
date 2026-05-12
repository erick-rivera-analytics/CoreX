"use client";

import { Badge } from "@/shared/ui/badge";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatFlexibleNumber as formatNumber, formatPercent } from "@/shared/lib/format";
import { cn } from "@/lib/utils";
import type { CycleLaborPersonDetailPayload } from "@/lib/fenograma";

function formatProductivity(value: number | null, fallback = "-") {
  if (value === null) {
    return fallback;
  }

  return formatNumber(value);
}

function computeHorasCama(effectiveHours: number | null, camas30: number | null) {
  if (effectiveHours === null || camas30 === null || camas30 <= 0) {
    return null;
  }

  return Math.round((effectiveHours / camas30) * 100) / 100;
}

function DetailBadges({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="rounded-full px-3 py-1">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function HoursPerformanceDonut({ percentage }: { percentage: number | null }) {
  const hasPercentage = percentage !== null;
  const normalizedPercentage = Math.max(0, Math.min(percentage ?? 0, 100));
  const chartStyle = {
    background: `conic-gradient(var(--color-chart-success-bold) 0 ${normalizedPercentage}%, var(--color-muted) ${normalizedPercentage}% 100%)`,
  } as const;

  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4">
        <div
          className="relative size-28 shrink-0 rounded-full shadow-inner"
          style={chartStyle}
          aria-hidden="true"
        >
          <div className="absolute inset-[16px] flex items-center justify-center rounded-full border border-border/50 bg-card text-center text-xs font-semibold tabular-nums text-foreground">
            {hasPercentage ? formatPercent(percentage) : "Sin dato"}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
            % Horas rendimiento
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPercent(percentage)}
          </p>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            Horas presenciales con medida distinta de H. Normales sobre el total de horas presenciales.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PersonHoursPerformanceSection({
  data,
  camas30,
}: {
  data: CycleLaborPersonDetailPayload;
  camas30: number | null;
}) {
  const totalEffectiveHours = data.summary.totalEffectiveHours ?? 0;
  const totalActualHours = data.summary.totalActualHours ?? 0;
  const horasCama = computeHorasCama(totalEffectiveHours, camas30);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Horas presenciales"
            value={formatNumber(totalActualHours)}
            hint="Actual hours del personal"
          />
          <MetricTile
            label="Horas trabajadas"
            value={formatNumber(totalEffectiveHours)}
            hint="Effective hours del personal"
          />
          <MetricTile
            label="Horas cama"
            value={formatNumber(horasCama)}
            hint="Horas trabajadas / camas 30 m2 del ciclo"
          />
          <MetricTile
            label="Rendimiento"
            value={formatPercent(data.summary.rendimientoPct)}
            hint="Horas trabajadas / horas presenciales"
          />
        </div>

        <HoursPerformanceDonut percentage={data.summary.nonNormalActualHoursPct} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DetailBadges
          items={[
            `${data.summary.activityCount} actividades`,
            `${formatNumber(totalActualHours)} horas presenciales`,
            `${formatNumber(totalEffectiveHours)} horas trabajadas`,
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Productividad = unidades / horas presenciales. Rendimiento = horas trabajadas / horas presenciales.
        </p>
      </div>

      <div className="max-h-[min(40dvh,460px)] overflow-auto rounded-[24px] border border-border/70">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur">
            <tr>
              {[
                "Actividad",
                "Horas presenciales",
                "Horas trabajadas",
                "Horas cama",
                "Rendimiento",
                "Unidades producidas",
                "Productividad",
                "Productividad historica",
                "Productividad ciclo",
              ].map((label) => (
                <th
                  key={label}
                  className="border-b border-r border-border/70 bg-card px-3 py-3 text-left font-semibold text-foreground last:border-r-0"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.activities.length ? data.activities.map((activity, index) => (
              <tr key={`${activity.activityId}|${activity.activityName}|${activity.unitOfMeasure}`} className={cn(index % 2 === 0 ? "bg-background/84" : "bg-muted/20")}>
                <td className="border-b border-r border-border/50 px-3 py-2.5 font-medium text-foreground">
                  <div className="min-w-[16rem]">
                    <p>{activity.activityName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activity.unitOfMeasure || "Sin medida"}
                    </p>
                  </div>
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(activity.actualHours)}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(activity.effectiveHours)}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(computeHorasCama(activity.effectiveHours, camas30))}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatPercent(activity.rendimientoPct)}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatNumber(activity.unitsProduced)}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatProductivity(activity.productivity)}
                </td>
                <td className="border-b border-r border-border/50 px-3 py-2.5 text-right tabular-nums">
                  {formatProductivity(activity.historicalProductivity, "Sin historico")}
                </td>
                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                  {formatProductivity(activity.cycleProductivity)}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay horas registradas para este personal en el ciclo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
