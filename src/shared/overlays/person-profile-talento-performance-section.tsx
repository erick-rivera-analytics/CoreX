"use client";

import { LoaderCircle } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { fetchJson } from "@/lib/fetch-json";
import type { TalentoPersonRendimientoPayload } from "@/lib/talento-humano";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatFlexibleNumber as formatNumber, formatPercent } from "@/shared/lib/format";

/**
 * Tab "Rendimiento" de PersonProfileDialog cuando `sourceContext.module === "talento"`.
 *
 * Muestra el rendimiento histórico de la persona SIN requerir cycleKey.
 * Agrega los últimos N ciclos con registros productivos.
 *
 * Endpoint: `GET /api/talento-humano/persona/[personId]/rendimiento`
 */
export function PersonProfileTalentoPerformanceSection({ personId }: { personId: string }) {
  const url = personId
    ? `/api/talento-humano/persona/${encodeURIComponent(personId)}/rendimiento`
    : null;

  const { data, isLoading, error } = useSWRImmutable<TalentoPersonRendimientoPayload>(
    url,
    (target: string) => fetchJson<TalentoPersonRendimientoPayload>(target, "No se pudo cargar el rendimiento del personal."),
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Cargando rendimiento del personal.
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "No se pudo cargar el rendimiento del personal.";
    return <div className="py-8 text-sm text-destructive">{errorMessage}</div>;
  }

  if (!data || data.cycles.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Sin registros de rendimiento para este personal.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Horas presenciales"
          value={formatNumber(data.totals.totalActualHours)}
          hint="Suma de horas presenciales en los ciclos visibles"
        />
        <MetricTile
          label="Horas trabajadas"
          value={formatNumber(data.totals.totalEffectiveHours)}
          hint="Suma de horas trabajadas en los ciclos visibles"
        />
        <MetricTile
          label="Rendimiento"
          value={data.totals.rendimientoPct === null ? "—" : formatPercent(data.totals.rendimientoPct, { input: "percent" })}
          hint="Horas trabajadas / horas presenciales"
        />
        <MetricTile
          label="Ciclos"
          value={String(data.totals.cycleCount)}
          hint={`${data.totals.activityCount} actividades registradas`}
        />
      </div>

      <div className="space-y-4">
        {data.cycles.map((cycle) => (
          <CycleSection key={cycle.cycleKey} cycle={cycle} />
        ))}
      </div>
    </div>
  );
}

function CycleSection({ cycle }: { cycle: TalentoPersonRendimientoPayload["cycles"][number] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-tight">{cycle.cycleKey}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{formatNumber(cycle.totalActualHours)}</span> h presenciales
          </span>
          <span>
            <span className="font-semibold text-foreground">{formatNumber(cycle.totalEffectiveHours)}</span> h trabajadas
          </span>
          <span>
            Rendimiento{" "}
            <span className="font-semibold text-foreground">
              {cycle.rendimientoPct === null ? "—" : formatPercent(cycle.rendimientoPct, { input: "percent" })}
            </span>
          </span>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground/80">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Actividad</th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-right font-semibold">H. presenciales</th>
              <th className="px-3 py-2 text-right font-semibold">H. trabajadas</th>
              <th className="px-3 py-2 text-right font-semibold">Unidades</th>
              <th className="px-3 py-2 text-right font-semibold">Rendimiento</th>
            </tr>
          </thead>
          <tbody>
            {cycle.activities.map((activity) => (
              <tr key={`${activity.activityId}-${activity.activityType}`} className="border-t border-border/40">
                <td className="px-3 py-2 font-medium">{activity.activityName}</td>
                <td className="px-3 py-2 text-muted-foreground">{activity.activityType}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(activity.actualHours)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(activity.effectiveHours)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(activity.unitsProduced)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {activity.rendimientoPct === null ? "—" : formatPercent(activity.rendimientoPct, { input: "percent" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
