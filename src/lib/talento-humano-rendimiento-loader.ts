import "server-only";

import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";
import type {
  TalentoPersonRendimientoPayload,
  TalentoPersonRendimientoWeek,
} from "@/lib/talento-humano";

const PERSON_RENDIMIENTO_DEFAULT_WEEK_LIMIT = 26;
const PERSON_RENDIMIENTO_TTL_MS = 5 * 60 * 1000;
const TALENTO_RENDIMIENTO_SOURCE = "gld.prod_rend_adj_cur";

type PersonRendimientoQueryRow = {
  iso_week_id: string | number | null;
  rendimiento: string | number | null;
  rendimiento_min: string | number | null;
  actual_hours_hn: string | number | null;
  actual_hours_rend: string | number | null;
  total_actual_hours: string | number | null;
};

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function ratioOrNull(numer: number | null, denom: number | null): number | null {
  if (numer === null || denom === null || !Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return numer / denom;
}

function round(value: number | null, digits = 6): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Rendimiento semanal de la persona para la ficha abierta desde Talento Humano.
 *
 * Fuente canónica: `gld.prod_rend_adj_cur`.
 * La tabla ya viene al grano persona/semana; el loader agrega por semana por
 * seguridad y calcula ponderados con `actual_hours_rend` como peso.
 */
export async function getPersonRendimiento(
  personId: string,
  weekLimit: number = PERSON_RENDIMIENTO_DEFAULT_WEEK_LIMIT,
): Promise<TalentoPersonRendimientoPayload> {
  const normalizedPersonId = personId.trim();
  const cap = Math.max(1, Math.min(weekLimit, 104));
  const cacheKey = `talento:rendimiento:v3:${normalizedPersonId}:${cap}`;

  return cachedAsync(cacheKey, PERSON_RENDIMIENTO_TTL_MS, async () => {
    const result = await query<PersonRendimientoQueryRow>(
      `
        with weekly as (
          select
            iso_week_id::text as iso_week_id,
            sum(coalesce(rend, 0)::numeric * coalesce(actual_hours_rend, 0)::numeric)
              / nullif(sum(case when rend is not null then coalesce(actual_hours_rend, 0)::numeric else 0 end), 0) as rendimiento,
            sum(coalesce(rend_min, 0)::numeric * coalesce(actual_hours_rend, 0)::numeric)
              / nullif(sum(case when rend_min is not null then coalesce(actual_hours_rend, 0)::numeric else 0 end), 0) as rendimiento_min,
            sum(coalesce(actual_hours_hn, 0)::numeric) as actual_hours_hn,
            sum(coalesce(actual_hours_rend, 0)::numeric) as actual_hours_rend,
            sum(coalesce(total_actual_hours, 0)::numeric) as total_actual_hours
          from ${TALENTO_RENDIMIENTO_SOURCE}
          where trim(person_id::text) = $1
            and iso_week_id is not null
          group by iso_week_id
        )
        select
          iso_week_id,
          rendimiento,
          rendimiento_min,
          actual_hours_hn,
          actual_hours_rend,
          total_actual_hours
        from weekly
        order by iso_week_id::int desc
        limit $2
      `,
      [normalizedPersonId, cap],
    );

    const weeklyRows: TalentoPersonRendimientoWeek[] = result.rows.map((row) => {
      const rendimiento = round(toNum(row.rendimiento));
      const rendimientoMin = round(toNum(row.rendimiento_min));
      return {
        isoWeekId: String(row.iso_week_id ?? ""),
        rendimiento,
        rendimientoMin,
        cumplimiento: round(ratioOrNull(rendimiento, rendimientoMin)),
        actualHoursHn: round(toNum(row.actual_hours_hn)) ?? 0,
        actualHoursRend: round(toNum(row.actual_hours_rend)) ?? 0,
        totalActualHours: round(toNum(row.total_actual_hours)) ?? 0,
      };
    });

    const weightedRendNumerator = weeklyRows.reduce((sum, row) => sum + (row.rendimiento ?? 0) * row.actualHoursRend, 0);
    const weightedMinNumerator = weeklyRows.reduce((sum, row) => sum + (row.rendimientoMin ?? 0) * row.actualHoursRend, 0);
    const totalHoursRend = weeklyRows.reduce((sum, row) => sum + row.actualHoursRend, 0);
    const rendimiento = round(ratioOrNull(weightedRendNumerator, totalHoursRend));
    const rendimientoMin = round(ratioOrNull(weightedMinNumerator, totalHoursRend));

    return {
      personId: normalizedPersonId,
      generatedAt: new Date().toISOString(),
      totals: {
        rendimiento,
        rendimientoMin,
        cumplimiento: round(ratioOrNull(rendimiento, rendimientoMin)),
        actualHoursHn: round(weeklyRows.reduce((sum, row) => sum + row.actualHoursHn, 0)) ?? 0,
        actualHoursRend: round(totalHoursRend) ?? 0,
        totalActualHours: round(weeklyRows.reduce((sum, row) => sum + row.totalActualHours, 0)) ?? 0,
        weekCount: weeklyRows.length,
      },
      weeklyRows,
    };
  });
}
