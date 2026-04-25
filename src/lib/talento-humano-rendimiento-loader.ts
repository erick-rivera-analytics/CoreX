import "server-only";

import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";
import type {
  TalentoPersonRendimientoActivity,
  TalentoPersonRendimientoCycle,
  TalentoPersonRendimientoPayload,
} from "@/lib/talento-humano";

const PROD_HOURS_SOURCE = "gld.mv_prod_hours_cycle_person_cur";
const PERSON_RENDIMIENTO_DEFAULT_CYCLE_LIMIT = 8;
const PERSON_RENDIMIENTO_TTL_MS = 5 * 60 * 1000;

type PersonRendimientoQueryRow = {
  cycle_key: string | null;
  activity_id: string | null;
  activity_name: string | null;
  activity_type: string | null;
  unit_of_measure: string | null;
  actual_hours: string | number | null;
  effective_hours: string | number | null;
  units_produced: string | number | null;
};

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" || text === "UNKNOWN" ? null : text;
}

function ratioPct(numer: number, denom: number): number | null {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return (numer / denom) * 100;
}

function ratioOrNull(numer: number, denom: number): number | null {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return numer / denom;
}

/**
 * Rendimiento histórico de la persona SIN requerir cycleKey.
 *
 * Agrega los últimos `cycleLimit` ciclos donde la persona tuvo registros
 * productivos, agrupado por (cycle_key, activity).
 *
 * Usado por la tab "Rendimiento" de `PersonProfileDialog` cuando
 * `sourceContext.module === "talento"`.
 */
export async function getPersonRendimiento(
  personId: string,
  cycleLimit: number = PERSON_RENDIMIENTO_DEFAULT_CYCLE_LIMIT,
): Promise<TalentoPersonRendimientoPayload> {
  const normalizedPersonId = personId.trim();
  const cap = Math.max(1, Math.min(cycleLimit, 50));
  const cacheKey = `talento:rendimiento:v1:${normalizedPersonId}:${cap}`;

  return cachedAsync(cacheKey, PERSON_RENDIMIENTO_TTL_MS, async () => {
    const result = await query<PersonRendimientoQueryRow>(
      `
        with person_hours as (
          select
            cycle_key,
            coalesce(nullif(trim(activity_id::text), ''), 'Sin actividad') as activity_id,
            coalesce(
              nullif(trim(activity_name), ''),
              coalesce(nullif(trim(activity_id::text), ''), 'Sin actividad')
            ) as activity_name,
            coalesce(nullif(trim(activity_type), ''), 'Sin tipo') as activity_type,
            coalesce(nullif(trim(unit_of_measure), ''), '') as unit_of_measure,
            coalesce(actual_hours, 0) as actual_hours,
            coalesce(effective_hours, 0) as effective_hours,
            coalesce(units_produced, 0) as units_produced
          from ${PROD_HOURS_SOURCE}
          where trim(person_id::text) = $1
            and cycle_key is not null
        ),
        recent_cycles as (
          select cycle_key
          from person_hours
          group by cycle_key
          order by max(cycle_key) desc
          limit $2
        )
        select
          ph.cycle_key,
          ph.activity_id,
          ph.activity_name,
          ph.activity_type,
          nullif(ph.unit_of_measure, '') as unit_of_measure,
          sum(ph.actual_hours) as actual_hours,
          sum(ph.effective_hours) as effective_hours,
          sum(ph.units_produced) as units_produced
        from person_hours ph
        join recent_cycles rc on rc.cycle_key = ph.cycle_key
        group by 1, 2, 3, 4, 5
        order by ph.cycle_key desc, ph.activity_name asc
      `,
      [normalizedPersonId, cap],
    );

    const cyclesMap = new Map<string, TalentoPersonRendimientoCycle>();
    let totalActual = 0;
    let totalEffective = 0;
    let totalUnits = 0;
    let activityCount = 0;

    for (const row of result.rows) {
      const cycleKey = toStr(row.cycle_key);
      if (!cycleKey) continue;

      const actualHours = toNum(row.actual_hours) ?? 0;
      const effectiveHours = toNum(row.effective_hours) ?? 0;
      const unitsProduced = toNum(row.units_produced) ?? 0;

      const activity: TalentoPersonRendimientoActivity = {
        activityId: toStr(row.activity_id) ?? "Sin actividad",
        activityName: toStr(row.activity_name) ?? "Sin actividad",
        activityType: toStr(row.activity_type) ?? "Sin tipo",
        unitOfMeasure: toStr(row.unit_of_measure) ?? "",
        actualHours,
        effectiveHours,
        unitsProduced,
        productivity: ratioOrNull(unitsProduced, actualHours),
        rendimientoPct: ratioPct(effectiveHours, actualHours),
      };

      let cycle = cyclesMap.get(cycleKey);
      if (!cycle) {
        cycle = {
          cycleKey,
          totalActualHours: 0,
          totalEffectiveHours: 0,
          totalUnitsProduced: 0,
          rendimientoPct: null,
          activities: [],
        };
        cyclesMap.set(cycleKey, cycle);
      }

      cycle.activities.push(activity);
      cycle.totalActualHours += actualHours;
      cycle.totalEffectiveHours += effectiveHours;
      cycle.totalUnitsProduced += unitsProduced;

      totalActual += actualHours;
      totalEffective += effectiveHours;
      totalUnits += unitsProduced;
      activityCount += 1;
    }

    const cycles = Array.from(cyclesMap.values()).map((cycle) => ({
      ...cycle,
      rendimientoPct: ratioPct(cycle.totalEffectiveHours, cycle.totalActualHours),
    }));

    cycles.sort((a, b) => (a.cycleKey < b.cycleKey ? 1 : a.cycleKey > b.cycleKey ? -1 : 0));

    return {
      personId: normalizedPersonId,
      generatedAt: new Date().toISOString(),
      totals: {
        totalActualHours: totalActual,
        totalEffectiveHours: totalEffective,
        totalUnitsProduced: totalUnits,
        rendimientoPct: ratioPct(totalEffective, totalActual),
        cycleCount: cycles.length,
        activityCount,
      },
      cycles,
    };
  });
}
