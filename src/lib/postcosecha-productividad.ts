import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue } from "@/lib/multi-select";
import {
  defaultPostharvestProductivityFilters,
  type PostharvestProductivityActivityDetailData,
  type PostharvestProductivityActivityDetailFilters,
  type PostharvestProductivityDashboardData,
  type PostharvestProductivityFilterOptions,
  type PostharvestProductivityFilters,
  type PostharvestProductivityRow,
} from "@/lib/postcosecha-productividad-contract";
import { cachedAsync } from "@/lib/server-cache";
import { toNumber } from "@/shared/lib/number-utils";

const POSTHARVEST_PRODUCTIVITY_DETAIL_SOURCE = "gld.mv_prod_postharvest_hours_box_detail_cur";
const POSTHARVEST_PRODUCTIVITY_LOT_SOURCE = "gld.mv_prod_postharvest_lot_final_output_cur";
const POSTHARVEST_PRODUCTIVITY_FINAL_SOURCE = "gld.mv_prod_postharvest_hours_box_cur";
const CALENDAR_SOURCE = "slv.common_dim_calendar_date_scd0";
const POSTHARVEST_PRODUCTIVITY_TTL_MS = 5 * 1000;
const POSTHARVEST_PRODUCTIVITY_START_DATE = "2025-04-29";
const SUPPORTED_POSTHARVEST_VARIETIES = ["XLE", "CLO", "ZIN", "DIANTHUS", "LYSE"] as const;

type PostharvestProductivityOptionsRow = {
  years: string[] | null;
  months: string[] | null;
  areas: string[] | null;
  paths: string[] | null;
  destinations: string[] | null;
  varieties: string[] | null;
};

type PostharvestProductivityAggregateRow = {
  post_date: string;
  calendar_year: number | string | null;
  calendar_month: number | string | null;
  iso_week_id: string | null;
  path_post: string;
  final_destination: string;
  variety_canon: string | null;
  weight_kg: number | string | null;
  boxes10: number | string | null;
  hours_cls: number | string | null;
  hours_sb: number | string | null;
  hours_emp: number | string | null;
  total_hours: number | string | null;
};

export function normalizePostharvestProductivityFilters(
  raw: Partial<PostharvestProductivityFilters> = {},
): PostharvestProductivityFilters {
  return {
    year: normalizeSelectValue(raw.year),
    month: normalizeMonthValue(raw.month),
    area: normalizeSelectValue(raw.area),
    pathPost: normalizeSelectValue(raw.pathPost),
    finalDestination: normalizeSelectValue(raw.finalDestination),
    variety: normalizeSelectValue(raw.variety),
    dateFrom: normalizeDateValue(raw.dateFrom),
    dateTo: normalizeDateValue(raw.dateTo),
  };
}

function normalizeSelectValue(value: string | undefined) {
  return encodeMultiSelectValue(decodeMultiSelectValue(value?.trim() || "all"));
}

function normalizeMonthValue(value: string | undefined) {
  const selected = decodeMultiSelectValue(value?.trim() || "all")
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12)
    .map((item) => String(item).padStart(2, "0"));

  return encodeMultiSelectValue(selected);
}

function normalizeDateValue(value: string | undefined) {
  const cleaned = value?.trim() || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : "";
}

function normalizeIsoWeekValue(value: string | undefined) {
  const cleaned = value?.trim() || "";
  return cleaned || "";
}

function buildCacheKey(filters: PostharvestProductivityFilters) {
  return JSON.stringify(filters);
}

async function ensureMaterializedSourcesExist() {
  const activeRebuild = await query<{ active_count: number | string }>(
    `
      select count(*)::int as active_count
      from pg_stat_activity
      where datname = current_database()
        and pid <> pg_backend_pid()
        and state <> 'idle'
        and query like '%Postharvest productivity blueprint for datalakehouse%'
    `,
  );

  const activeCount = toNumber(activeRebuild.rows[0]?.active_count) ?? 0;
  if (activeCount > 0) {
    throw new Error(
      "La materializacion de productividad de postcosecha sigue ejecutandose en datalakehouse. Espera a que termine el rebuild y vuelve a abrir el modulo.",
    );
  }

  const result = await query<{ detail_relation: string | null; lot_relation: string | null; final_relation: string | null }>(
    `
      select
        to_regclass($1) as detail_relation,
        to_regclass($2) as lot_relation,
        to_regclass($3) as final_relation
    `,
    [
      POSTHARVEST_PRODUCTIVITY_DETAIL_SOURCE,
      POSTHARVEST_PRODUCTIVITY_LOT_SOURCE,
      POSTHARVEST_PRODUCTIVITY_FINAL_SOURCE,
    ],
  );

  if (!result.rows[0]?.detail_relation || !result.rows[0]?.lot_relation || !result.rows[0]?.final_relation) {
    throw new Error(
      "La capa analitica de productividad de postcosecha aun no esta lista en datalakehouse. Primero debe completarse la materializacion.",
    );
  }

  const finalColumns = await query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'gld'
        and table_name = 'mv_prod_postharvest_hours_box_cur'
    `,
  );

  const columnSet = new Set(finalColumns.rows.map((row) => row.column_name));
  if (!columnSet.has("variety_canon")) {
    throw new Error(
      "La materializada final de productividad de postcosecha sigue en una version anterior. Debe republicarse gld.mv_prod_postharvest_hours_box_cur antes de usar el modulo.",
    );
  }
}

function pushArrayFilter(
  clauses: string[],
  values: unknown[],
  columnSql: string,
  encodedValue: string,
  parameterOffset = 0,
) {
  const selected = decodeMultiSelectValue(encodedValue);
  if (!selected.length) return;
  values.push(selected);
  clauses.push(`${columnSql} = any($${parameterOffset + values.length}::text[])`);
}

function pushScalarFilter(
  clauses: string[],
  values: unknown[],
  sqlFragment: string,
  value: string,
  parameterOffset = 0,
) {
  values.push(value);
  clauses.push(sqlFragment.replace("?", `$${parameterOffset + values.length}`));
}

function toSafeNumber(value: number | string | null | undefined) {
  return toNumber(value) ?? 0;
}

function normalizePostDateOutput(value: string) {
  return value.slice(0, 10);
}

function aggregateRowsForView(rows: PostharvestProductivityRow[]): PostharvestProductivityRow[] {
  const grouped = new Map<string, PostharvestProductivityRow>();

  for (const row of rows) {
    const key = [
      row.year ?? "null",
      row.month ?? "null",
      row.isoWeekId,
      row.postDate,
      row.pathPost,
      row.finalDestination,
    ].join("|");

    const current = grouped.get(key);
    if (current) {
      current.weightKg += row.weightKg;
      current.boxes10 += row.boxes10;
      current.hoursCls += row.hoursCls;
      current.hoursSb += row.hoursSb;
      current.hoursEmp += row.hoursEmp;
      current.totalHours += row.totalHours;
      current.hoursPerBoxTotal = current.boxes10 > 0 ? current.totalHours / current.boxes10 : null;
      current.hoursPerBoxCls = current.boxes10 > 0 ? current.hoursCls / current.boxes10 : null;
      current.hoursPerBoxSb = current.boxes10 > 0 ? current.hoursSb / current.boxes10 : null;
      current.hoursPerBoxEmp = current.boxes10 > 0 ? current.hoursEmp / current.boxes10 : null;
      continue;
    }

    grouped.set(key, { ...row });
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.postDate !== right.postDate) return right.postDate.localeCompare(left.postDate);
    if (left.pathPost !== right.pathPost) return left.pathPost.localeCompare(right.pathPost, "es-EC");
    return left.finalDestination.localeCompare(right.finalDestination, "es-EC");
  });
}

async function loadOptions(): Promise<PostharvestProductivityFilterOptions> {
  const result = await query<PostharvestProductivityOptionsRow>(`
    with lot_dates as (
      select distinct
        l.post_date::date as post_date,
        l.path_post,
        l.final_destination,
        l.variety_canon
      from ${POSTHARVEST_PRODUCTIVITY_LOT_SOURCE} l
      where l.post_date::date >= $2::date
        and upper(coalesce(l.variety_canon, '')) = any($1::text[])
    )
    select
      array(
        select distinct c.calendar_year::int::text
        from lot_dates d
        left join ${CALENDAR_SOURCE} c on c.calendar_date = d.post_date
        where c.calendar_year is not null
        order by 1 desc
      ) as years,
      array(
        select distinct lpad(c.calendar_month::int::text, 2, '0')
        from lot_dates d
        left join ${CALENDAR_SOURCE} c on c.calendar_date = d.post_date
        where c.calendar_month is not null
        order by 1 desc
      ) as months,
      array['CLS','SB','EMP']::text[] as areas,
      array(
        select distinct path_post
        from lot_dates
        order by 1
      ) as paths,
      array(
        select distinct final_destination
        from lot_dates
        order by 1
      ) as destinations,
      array(
        select distinct variety_canon
        from lot_dates
        where variety_canon is not null
        order by 1
      ) as varieties
  `, [SUPPORTED_POSTHARVEST_VARIETIES, POSTHARVEST_PRODUCTIVITY_START_DATE]);

  const row = result.rows[0];

  return {
    years: row?.years ?? [],
    months: row?.months ?? [],
    areas: row?.areas ?? [],
    paths: row?.paths ?? [],
    finalDestinations: row?.destinations ?? [],
    varieties: row?.varieties ?? [],
  };
}

async function loadRowsForSlice(filters: PostharvestProductivityFilters): Promise<PostharvestProductivityRow[]> {
  if (decodeMultiSelectValue(filters.variety).length > 0) {
    throw new Error(
      "La agregada canonica de productividad de postcosecha aun no soporta segmentacion confiable por variedad. Usa el filtro de variedad en 'Todos' mientras cerramos esa metodologia.",
    );
  }

  const clauses: string[] = [];
  const values: unknown[] = [];

  pushScalarFilter(clauses, values, `v.post_date >= ?::date`, filters.dateFrom || POSTHARVEST_PRODUCTIVITY_START_DATE);

  if (filters.dateTo) {
    pushScalarFilter(clauses, values, `v.post_date <= ?::date`, filters.dateTo);
  }

  pushArrayFilter(clauses, values, "c.calendar_year::int::text", filters.year);
  pushArrayFilter(clauses, values, "lpad(c.calendar_month::int::text, 2, '0')", filters.month);
  pushArrayFilter(clauses, values, "v.path_post", filters.pathPost);
  pushArrayFilter(clauses, values, "v.final_destination", filters.finalDestination);
  pushArrayFilter(clauses, values, "v.area_id", filters.area);

  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";

  const result = await query<PostharvestProductivityAggregateRow>(
    `
      select
        v.post_date::text as post_date,
        c.calendar_year,
        c.calendar_month,
        coalesce(c.iso_week_id, concat(c.iso_year::text, '-', lpad(c.iso_week::text, 2, '0'))) as iso_week_id,
        v.path_post,
        v.final_destination,
        null::text as variety_canon,
        sum(v.weight_kg)::double precision as weight_kg,
        sum(v.boxes10)::double precision as boxes10,
        sum(case when v.area_id = 'CLS' then v.effective_hours_assigned else 0 end)::double precision as hours_cls,
        sum(case when v.area_id = 'SB' then v.effective_hours_assigned else 0 end)::double precision as hours_sb,
        sum(case when v.area_id = 'EMP' then v.effective_hours_assigned else 0 end)::double precision as hours_emp,
        sum(v.effective_hours_assigned)::double precision as total_hours
      from ${POSTHARVEST_PRODUCTIVITY_FINAL_SOURCE} v
      left join ${CALENDAR_SOURCE} c on c.calendar_date = v.post_date::date
      ${whereClause}
      group by
        v.post_date::date,
        c.calendar_year,
        c.calendar_month,
        c.iso_week_id,
        c.iso_year,
        c.iso_week,
        v.path_post,
        v.final_destination
      order by
        v.post_date::date desc,
        v.path_post asc,
        v.final_destination asc
    `,
    values,
  );

  const rows = result.rows.map((row) => {
    const boxes10 = toSafeNumber(row.boxes10);
    const hoursCls = toSafeNumber(row.hours_cls);
    const hoursSb = toSafeNumber(row.hours_sb);
    const hoursEmp = toSafeNumber(row.hours_emp);
    const totalHours = toSafeNumber(row.total_hours);

    return {
      year: toNumber(row.calendar_year),
      month: toNumber(row.calendar_month),
      isoWeekId: row.iso_week_id?.trim() || "Sin semana",
      postDate: normalizePostDateOutput(row.post_date),
      pathPost: row.path_post,
      finalDestination: row.final_destination,
      weightKg: toSafeNumber(row.weight_kg),
      boxes10,
      hoursCls,
      hoursSb,
      hoursEmp,
      totalHours,
      hoursPerBoxTotal: boxes10 > 0 ? totalHours / boxes10 : null,
      hoursPerBoxCls: boxes10 > 0 ? hoursCls / boxes10 : null,
      hoursPerBoxSb: boxes10 > 0 ? hoursSb / boxes10 : null,
      hoursPerBoxEmp: boxes10 > 0 ? hoursEmp / boxes10 : null,
    };
  });

  return aggregateRowsForView(rows);
}

async function loadRows(
  filters: PostharvestProductivityFilters,
  availableYears: string[],
): Promise<PostharvestProductivityRow[]> {
  const selectedYears = decodeMultiSelectValue(filters.year);
  const yearsToResolve = selectedYears.length ? selectedYears : availableYears;

  if (yearsToResolve.length <= 1) {
    const yearValue = yearsToResolve.length ? encodeMultiSelectValue(yearsToResolve) : filters.year;
    return loadRowsForSlice({ ...filters, year: yearValue });
  }

  const slices = await Promise.all(
    yearsToResolve.map((year) =>
      loadRowsForSlice({
        ...filters,
        year: encodeMultiSelectValue([year]),
      }),
    ),
  );

  return slices.flat();
}

export async function getPostharvestProductivityDashboardData(
  rawFilters: Partial<PostharvestProductivityFilters> = defaultPostharvestProductivityFilters,
): Promise<PostharvestProductivityDashboardData> {
  const filters = normalizePostharvestProductivityFilters(rawFilters);

  return cachedAsync(
    `postharvest-productivity:${buildCacheKey(filters)}`,
    POSTHARVEST_PRODUCTIVITY_TTL_MS,
    async () => {
      await ensureMaterializedSourcesExist();
      const options = await loadOptions();
      const rows = await loadRows(filters, options.years);

      const summary = rows.reduce(
        (acc, row) => {
          acc.rowCount += 1;
          acc.totalWeightKg += row.weightKg;
          acc.totalBoxes10 += row.boxes10;
          acc.totalHours += row.totalHours;
          acc.totalHoursCls += row.hoursCls;
          acc.totalHoursSb += row.hoursSb;
          acc.totalHoursEmp += row.hoursEmp;
          acc.postDates.add(row.postDate);
          return acc;
        },
        {
          rowCount: 0,
          totalWeightKg: 0,
          totalBoxes10: 0,
          totalHours: 0,
          totalHoursCls: 0,
          totalHoursSb: 0,
          totalHoursEmp: 0,
          postDates: new Set<string>(),
        },
      );

      return {
        generatedAt: new Date().toISOString(),
        filters,
        options,
        rows,
        summary: {
          rowCount: summary.rowCount,
          postDateCount: summary.postDates.size,
          totalWeightKg: summary.totalWeightKg,
          totalBoxes10: summary.totalBoxes10,
          totalHours: summary.totalHours,
          totalHoursCls: summary.totalHoursCls,
          totalHoursSb: summary.totalHoursSb,
          totalHoursEmp: summary.totalHoursEmp,
          weightedHoursPerBox: summary.totalBoxes10 > 0 ? summary.totalHours / summary.totalBoxes10 : null,
        },
      };
    },
  );
}

export function normalizePostharvestProductivityActivityDetailFilters(
  raw: Partial<PostharvestProductivityActivityDetailFilters>,
): PostharvestProductivityActivityDetailFilters {
  return {
    ...normalizePostharvestProductivityFilters(raw),
    isoWeekId: normalizeIsoWeekValue(raw.isoWeekId),
    pathPostScope: (raw.pathPostScope ?? "").trim(),
    finalDestinationScope: (raw.finalDestinationScope ?? "").trim(),
  };
}

export async function getPostharvestProductivityActivityDetailData(
  rawFilters: Partial<PostharvestProductivityActivityDetailFilters>,
): Promise<PostharvestProductivityActivityDetailData> {
  const filters = normalizePostharvestProductivityActivityDetailFilters(rawFilters);

  if (decodeMultiSelectValue(filters.variety).length > 0) {
    throw new Error(
      "El detalle canonico de productividad de postcosecha aun no soporta segmentacion confiable por variedad. Usa el filtro de variedad en 'Todos' mientras cerramos esa metodologia.",
    );
  }

  if (!filters.pathPostScope || !filters.finalDestinationScope) {
    throw new Error("Faltan camino o destino para consultar el detalle de actividades.");
  }

  const lotClauses: string[] = [];
  const lotValues: unknown[] = [];
  const hourClauses: string[] = [];
  const hourValues: unknown[] = [];

  lotValues.push(SUPPORTED_POSTHARVEST_VARIETIES);
  lotClauses.push(`upper(coalesce(l.variety_canon, '')) = any($${lotValues.length}::text[])`);
  pushScalarFilter(lotClauses, lotValues, `l.path_post = ?`, filters.pathPostScope);
  pushScalarFilter(lotClauses, lotValues, `l.final_destination = ?`, filters.finalDestinationScope);

  pushScalarFilter(lotClauses, lotValues, `l.post_date >= ?::date`, filters.dateFrom || POSTHARVEST_PRODUCTIVITY_START_DATE);

  if (filters.dateTo) {
    pushScalarFilter(lotClauses, lotValues, `l.post_date <= ?::date`, filters.dateTo);
  }

  pushArrayFilter(lotClauses, lotValues, "c.calendar_year::int::text", filters.year);
  pushArrayFilter(lotClauses, lotValues, "lpad(c.calendar_month::int::text, 2, '0')", filters.month);
  pushArrayFilter(lotClauses, lotValues, "l.variety_canon", filters.variety);

  if (filters.isoWeekId) {
    pushScalarFilter(
      lotClauses,
      lotValues,
      `coalesce(c.iso_week_id, concat(c.iso_year::text, '-', lpad(c.iso_week::text, 2, '0'))) = ?`,
      filters.isoWeekId,
    );
  }

  const hourOffset = lotValues.length;
  pushScalarFilter(hourClauses, hourValues, `d.path_post = ?`, filters.pathPostScope, hourOffset);
  pushScalarFilter(hourClauses, hourValues, `d.final_destination = ?`, filters.finalDestinationScope, hourOffset);

  pushScalarFilter(hourClauses, hourValues, `d.post_date >= ?::date`, filters.dateFrom || POSTHARVEST_PRODUCTIVITY_START_DATE, hourOffset);

  if (filters.dateTo) {
    pushScalarFilter(hourClauses, hourValues, `d.post_date <= ?::date`, filters.dateTo, hourOffset);
  }

  pushArrayFilter(hourClauses, hourValues, "c.calendar_year::int::text", filters.year, hourOffset);
  pushArrayFilter(hourClauses, hourValues, "lpad(c.calendar_month::int::text, 2, '0')", filters.month, hourOffset);
  pushArrayFilter(hourClauses, hourValues, "d.area_id", filters.area, hourOffset);

  if (filters.isoWeekId) {
    pushScalarFilter(
      hourClauses,
      hourValues,
      `coalesce(c.iso_week_id, concat(c.iso_year::text, '-', lpad(c.iso_week::text, 2, '0'))) = ?`,
      filters.isoWeekId,
      hourOffset,
    );
  }

  const lotWhereClause = lotClauses.length ? `where ${lotClauses.join(" and ")}` : "";
  const hourWhereClause = hourClauses.length ? `where ${hourClauses.join(" and ")}` : "";

  const result = await query<{
    cost_area: string | null;
    sub_cost_center: string | null;
    activity_name: string | null;
    hours_cls: number | string | null;
    hours_sb: number | string | null;
    hours_emp: number | string | null;
    total_hours: number | string | null;
  }>(
    `
      with lots as (
        select
          l.post_date::date as post_date,
          l.path_post,
          l.final_destination,
          l.variety_canon,
          sum(l.weight_kg)::double precision as weight_kg
        from ${POSTHARVEST_PRODUCTIVITY_LOT_SOURCE} l
        left join ${CALENDAR_SOURCE} c on c.calendar_date = l.post_date::date
        ${lotWhereClause}
        group by
          l.post_date::date,
          l.path_post,
          l.final_destination,
          l.variety_canon
      ),
      lot_totals_by_variety as (
        select
          path_post,
          final_destination,
          variety_canon,
          sum(weight_kg)::double precision as total_weight_kg
        from lots
        group by path_post, final_destination, variety_canon
      ),
      lot_totals_all as (
        select
          path_post,
          final_destination,
          sum(weight_kg)::double precision as total_weight_kg
        from lots
        group by path_post, final_destination
      ),
      lot_distribution as (
        select
          l.post_date,
          l.path_post,
          l.final_destination,
          l.variety_canon,
          case
            when coalesce(tv.total_weight_kg, 0) > 0 then l.weight_kg / tv.total_weight_kg
            else 0::double precision
          end as share_variety,
          case
            when coalesce(ta.total_weight_kg, 0) > 0 then l.weight_kg / ta.total_weight_kg
            else 0::double precision
          end as share_all
        from lots l
        left join lot_totals_by_variety tv
          on tv.path_post = l.path_post
         and tv.final_destination = l.final_destination
         and tv.variety_canon = l.variety_canon
        left join lot_totals_all ta
          on ta.path_post = l.path_post
         and ta.final_destination = l.final_destination
      ),
      lot_keys as (
        select distinct
          post_date,
          path_post,
          final_destination,
          variety_canon
        from lots
      ),
      detail_regular as (
        select
          coalesce(nullif(trim(d.cost_area), ''), 'Sin Ã¡rea') as cost_area,
          coalesce(nullif(trim(d.sub_cost_center), ''), 'General') as sub_cost_center,
          coalesce(nullif(trim(d.activity_name), ''), nullif(trim(d.activity_id), ''), 'Sin actividad') as activity_name,
          d.area_id,
          sum(d.effective_hours_assigned)::double precision as effective_hours_assigned
        from ${POSTHARVEST_PRODUCTIVITY_DETAIL_SOURCE} d
        join lot_keys lk
          on lk.post_date = d.post_date::date
         and lk.path_post = d.path_post
         and lk.final_destination = d.final_destination
         and lk.variety_canon = d.variety_canon
        left join ${CALENDAR_SOURCE} c on c.calendar_date = d.post_date::date
        ${hourWhereClause}
          ${hourWhereClause ? "and" : "where"} d.match_kind not in ('SPECIFIC_PERIOD', 'FALLBACK_MACRO')
        group by 1, 2, 3, d.area_id
      ),
      detail_placeholder as (
        select
          coalesce(nullif(trim(d.cost_area), ''), 'Sin Ã¡rea') as cost_area,
          coalesce(nullif(trim(d.sub_cost_center), ''), 'General') as sub_cost_center,
          coalesce(nullif(trim(d.activity_name), ''), nullif(trim(d.activity_id), ''), 'Sin actividad') as activity_name,
          d.area_id,
          d.path_post,
          d.final_destination,
          d.variety_canon,
          sum(d.effective_hours_assigned)::double precision as effective_hours_assigned
        from ${POSTHARVEST_PRODUCTIVITY_DETAIL_SOURCE} d
        left join ${CALENDAR_SOURCE} c on c.calendar_date = d.post_date::date
        ${hourWhereClause}
          ${hourWhereClause ? "and" : "where"} d.match_kind in ('SPECIFIC_PERIOD', 'FALLBACK_MACRO')
        group by 1, 2, 3, d.area_id, d.path_post, d.final_destination, d.variety_canon
      ),
      detail_redistributed as (
        select
          p.cost_area,
          p.sub_cost_center,
          p.activity_name,
          p.area_id,
          (
            p.effective_hours_assigned
            * case
                when p.variety_canon = 'ALL' then dist.share_all
                else dist.share_variety
              end
          )::double precision as effective_hours_assigned
        from detail_placeholder p
        join lot_distribution dist
          on dist.path_post = p.path_post
         and dist.final_destination = p.final_destination
         and (p.variety_canon = 'ALL' or dist.variety_canon = p.variety_canon)
      ),
      detail_all as (
        select * from detail_regular
        union all
        select * from detail_redistributed
      )
      select
        cost_area,
        sub_cost_center,
        activity_name,
        sum(case when area_id = 'CLS' then effective_hours_assigned else 0 end)::double precision as hours_cls,
        sum(case when area_id = 'SB' then effective_hours_assigned else 0 end)::double precision as hours_sb,
        sum(case when area_id = 'EMP' then effective_hours_assigned else 0 end)::double precision as hours_emp,
        sum(effective_hours_assigned)::double precision as total_hours
      from detail_all
      group by cost_area, sub_cost_center, activity_name
      order by cost_area asc, sub_cost_center asc, activity_name asc
    `,
    [...lotValues, ...hourValues],
  );

  return {
    filters,
    rows: result.rows.map((row) => ({
      costArea: row.cost_area?.trim() || "Sin Ã¡rea",
      subCostCenter: row.sub_cost_center?.trim() || "General",
      activityName: row.activity_name?.trim() || "Sin actividad",
      hoursCls: toSafeNumber(row.hours_cls),
      hoursSb: toSafeNumber(row.hours_sb),
      hoursEmp: toSafeNumber(row.hours_emp),
      totalHours: toSafeNumber(row.total_hours),
      hoursPerBoxCls: null,
      hoursPerBoxSb: null,
      hoursPerBoxEmp: null,
      hoursPerBoxTotal: null,
    })),
  };
}




