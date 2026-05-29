import "server-only";

import { query } from "@/lib/db";
import { FUMIGATION_ACTIVITY_IDS } from "@/lib/fumigation-activity-family";
import { cachedAsync } from "@/lib/server-cache";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROG_TTL_MS = 5 * 60 * 1000; // 5 min

export const ACTIVITY_CODES = ["SPMC", "ILUMINACION", ...FUMIGATION_ACTIVITY_IDS, "FM11", "FM13"] as const;
export type ActivityCode = (typeof ACTIVITY_CODES)[number];

const FUMIGATION_ACTIVITY_CODES_SQL = FUMIGATION_ACTIVITY_IDS.map((code) => `'${code}'`).join(", ");

// ── Types ─────────────────────────────────────────────────────────────────────

type ProgramacionQueryRow = {
  block_id: string | null;
  cycle_key: string | null;
  event_date: string | null;
  activity_code: string | null;
  ilum_label: string | null;  // "Inicio" | "Fin" | null
  variety: string | null;
  sp_type: string | null;
  fase: string | null;
  area_id: string | null;
};

export type ProgramacionRecord = {
  blockId: string;
  cycleKey: string;
  eventDate: string;         // "YYYY-MM-DD"
  activityCode: ActivityCode;
  ilumLabel: string | null;  // "Inicio" | "Fin" para ILUMINACION, null para SPMC
  variety: string | null;
  spType: string | null;
  fase: string | null;       // "Planificado" | "Activo" | "Historia"
  areaId: string | null;
};

// ── Query ─────────────────────────────────────────────────────────────────────

export async function getProgramaciones(
  dateFrom: string,
  dateTo: string,
): Promise<ProgramacionRecord[]> {
  const cacheKey = `programaciones:${dateFrom}:${dateTo}`;

  return cachedAsync(cacheKey, PROG_TTL_MS, async () => {
    const result = await query<ProgramacionQueryRow>(
      `
        with ilum_bounds as (
          -- Para ILUMINACION: solo primer y ultimo event_date por ciclo
          select
            cycle_key,
            min(event_date) as start_date,
            max(event_date) as end_date
          from mdl.prod_ref_vegetativo_subset_scd2
          where activity_code = 'ILUMINACION'
          group by cycle_key
        ),
        events as (
          -- SPMC: todos los eventos en rango
          select cycle_key, activity_code, event_date, null::text as ilum_label
          from mdl.prod_ref_vegetativo_subset_scd2
          where activity_code = 'SPMC'
            and event_date >= $1::date
            and event_date <= $2::date

          union all

          -- ILUMINACION: primer dia del ciclo si cae en rango
          select ib.cycle_key, 'ILUMINACION', ib.start_date, 'Inicio'
          from ilum_bounds ib
          where ib.start_date >= $1::date
            and ib.start_date <= $2::date

          union all

          -- ILUMINACION: ultimo dia del ciclo si cae en rango (y distinto al inicio)
          select ib.cycle_key, 'ILUMINACION', ib.end_date, 'Fin'
          from ilum_bounds ib
          where ib.end_date >= $1::date
            and ib.end_date <= $2::date
            and ib.end_date != ib.start_date

          union all

          -- FUMIGACION: todos los eventos en rango para la familia completa
          select cycle_key, activity_code, event_date, null::text as ilum_label
          from mdl.prod_ref_vegetativo_subset_scd2
          where activity_code IN (${FUMIGATION_ACTIVITY_CODES_SQL})
            and event_date >= $1::date
            and event_date <= $2::date

          union all

          -- DRENCH: todos los eventos en rango
          select cycle_key, activity_code, event_date, null::text as ilum_label
          from mdl.prod_ref_vegetativo_subset_scd2
          where activity_code = 'FM11'
            and event_date >= $1::date
            and event_date <= $2::date

          union all

          -- APLICACION GA3: todos los eventos en rango
          select cycle_key, activity_code, event_date, null::text as ilum_label
          from mdl.prod_ref_vegetativo_subset_scd2
          where activity_code = 'FM13'
            and event_date >= $1::date
            and event_date <= $2::date
        )
        select
          nullif(trim(cp.block_id), '')  as block_id,
          nullif(trim(ev.cycle_key), '') as cycle_key,
          to_char(ev.event_date, 'YYYY-MM-DD') as event_date,
          ev.activity_code,
          ev.ilum_label,
          nullif(trim(cp.variety), '')   as variety,
          nullif(trim(cp.sp_type), '')   as sp_type,
          case
            when current_date < cp.sp_date
              then 'Planificado'
            when current_date >= cp.harvest_end_date
              then 'Historia'
            when current_date >= cp.harvest_start_date and current_date < cp.harvest_end_date
              then 'Cosecha'
            when current_date >= cp.sp_date and current_date < cp.harvest_start_date
              then 'Vegetativo'
            else 'Historia'
          end as fase,
          area_info.area_id
        from events ev
        left join lateral (
          select
            cp2.block_id,
            cp2.variety,
            cp2.sp_type,
            cp2.parent_block,
            cp2.sp_date,
            cp2.harvest_start_date,
            cp2.harvest_end_date
          from slv.camp_dim_cycle_profile_scd2 cp2
          where cp2.cycle_key = ev.cycle_key
          order by cp2.valid_from desc nulls last
          limit 1
        ) cp on true
        left join lateral (
          select nullif(trim(bp.area_id), '') as area_id
          from slv.camp_dim_block_profile_scd2 bp
          where bp.parent_block = cp.parent_block
            and bp.is_current = true
          order by bp.valid_from desc nulls last
          limit 1
        ) area_info on true
        order by ev.event_date asc, cp.block_id asc
      `,
      [dateFrom, dateTo],
    );

    return result.rows
      .filter(
        (row): row is ProgramacionQueryRow & { block_id: string; cycle_key: string; event_date: string } =>
          Boolean(row.block_id && row.cycle_key && row.event_date),
      )
      .map((row) => ({
        blockId: row.block_id,
        cycleKey: row.cycle_key,
        eventDate: row.event_date,
        activityCode: (row.activity_code ?? "SPMC") as ActivityCode,
        ilumLabel: row.ilum_label ?? null,
        variety: row.variety ?? null,
        spType: row.sp_type ?? null,
        fase: row.fase ?? null,
        areaId: row.area_id ?? null,
      }));
  });
}
