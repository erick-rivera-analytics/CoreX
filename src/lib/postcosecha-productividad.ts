import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { toNumber } from "@/shared/lib/number-utils";

const POSTHARVEST_PRODUCTIVITY_SOURCE = "gld.mv_prod_postharvest_hours_box_cur";
const POSTHARVEST_PRODUCTIVITY_TTL_MS = 60 * 1000;

type PostharvestProductivityQueryRow = {
  post_date: string;
  path_post: string;
  final_destination: string;
  variety_canon?: string | null;
  area_id: string;
  weight_kg: number | string | null;
  boxes10: number | string | null;
  effective_hours_assigned: number | string | null;
  effective_hours_upstream: number | string | null;
  effective_hours_downstream: number | string | null;
  effective_hours_specific: number | string | null;
  effective_hours_specific_period: number | string | null;
  effective_hours_fallback_macro: number | string | null;
  effective_hours_fallback_day: number | string | null;
  hours_per_box: number | string | null;
  hours_per_box_upstream: number | string | null;
  hours_per_box_downstream: number | string | null;
};

type PostharvestProductivityOptionsRow = {
  years: string[] | null;
  months: string[] | null;
  areas: string[] | null;
  paths: string[] | null;
  destinations: string[] | null;
  varieties: string[] | null;
};

type PostharvestProductivityCapabilities = {
  hasVarietyCanon: boolean;
};

export type PostharvestProductivityFilters = {
  year: string;
  month: string;
  area: string;
  pathPost: string;
  finalDestination: string;
  variety: string;
  dateFrom: string;
  dateTo: string;
};

export type PostharvestProductivityRow = {
  postDate: string;
  pathPost: string;
  finalDestination: string;
  varietyCanon: string;
  areaId: string;
  weightKg: number;
  boxes10: number;
  effectiveHoursAssigned: number;
  effectiveHoursUpstream: number;
  effectiveHoursDownstream: number;
  effectiveHoursSpecific: number;
  effectiveHoursSpecificPeriod: number;
  effectiveHoursFallbackMacro: number;
  effectiveHoursFallbackDay: number;
  hoursPerBox: number | null;
  hoursPerBoxUpstream: number | null;
  hoursPerBoxDownstream: number | null;
};

export type PostharvestProductivityFilterOptions = {
  years: string[];
  months: string[];
  areas: string[];
  paths: string[];
  finalDestinations: string[];
  varieties: string[];
};

export type PostharvestProductivityDashboardData = {
  generatedAt: string;
  filters: PostharvestProductivityFilters;
  options: PostharvestProductivityFilterOptions;
  rows: PostharvestProductivityRow[];
  summary: {
    rowCount: number;
    postDateCount: number;
    totalWeightKg: number;
    totalBoxes10: number;
    totalHours: number;
    totalHoursUpstream: number;
    totalHoursDownstream: number;
    weightedHoursPerBox: number | null;
    weightedHoursPerBoxUpstream: number | null;
    weightedHoursPerBoxDownstream: number | null;
  };
};

export const defaultPostharvestProductivityFilters: PostharvestProductivityFilters = {
  year: "all",
  month: "all",
  area: "all",
  pathPost: "all",
  finalDestination: "all",
  variety: "all",
  dateFrom: "",
  dateTo: "",
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
  const cleaned = value?.trim() || "all";
  if (cleaned === "all") return cleaned;
  const numericValue = Number(cleaned);
  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 12) {
    return "all";
  }
  return String(numericValue).padStart(2, "0");
}

function normalizeDateValue(value: string | undefined) {
  const cleaned = value?.trim() || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : "";
}

function buildCacheKey(filters: PostharvestProductivityFilters) {
  return JSON.stringify(filters);
}

async function ensureMaterializedViewExists() {
  const result = await query<{ relation_name: string | null }>(
    `select to_regclass($1) as relation_name`,
    [POSTHARVEST_PRODUCTIVITY_SOURCE],
  );

  if (result.rows[0]?.relation_name) {
    return;
  }

  const activeRebuild = await query<{ active_count: number | string }>(
    `
      select count(*)::int as active_count
      from pg_stat_activity
      where datname = current_database()
        and state <> 'idle'
        and query like '%Postharvest productivity blueprint for datalakehouse%'
    `,
  );

  const activeCount = toNumber(activeRebuild.rows[0]?.active_count) ?? 0;
  if (activeCount > 0) {
    throw new Error(
      "La materialización de productividad de postcosecha sigue ejecutándose en datalakehouse. CoreX solo usará PostgreSQL; espera a que termine el rebuild y vuelve a abrir el módulo.",
    );
  }

  throw new Error(
    "La capa analítica de productividad de postcosecha aún no existe en datalakehouse. CoreX solo usa PostgreSQL en este módulo; primero debe completarse la materialización.",
  );
}

async function detectCapabilities(): Promise<PostharvestProductivityCapabilities> {
  const result = await query<{ has_variety_canon: boolean }>(
    `
      select exists (
        select 1
        from pg_attribute
        where attrelid = $1::regclass
          and attname = 'variety_canon'
          and attnum > 0
          and not attisdropped
      ) as has_variety_canon
    `,
    [POSTHARVEST_PRODUCTIVITY_SOURCE],
  );

  return {
    hasVarietyCanon: Boolean(result.rows[0]?.has_variety_canon),
  };
}

function pushArrayFilter(
  clauses: string[],
  values: unknown[],
  columnSql: string,
  encodedValue: string,
) {
  const selected = decodeMultiSelectValue(encodedValue);
  if (!selected.length) return;
  values.push(selected);
  clauses.push(`${columnSql} = any($${values.length}::text[])`);
}

function pushScalarFilter(
  clauses: string[],
  values: unknown[],
  sqlFragment: string,
  value: string,
) {
  values.push(value);
  clauses.push(sqlFragment.replace("?", `$${values.length}`));
}

function toSafeNumber(value: number | string | null | undefined) {
  return toNumber(value) ?? 0;
}

function normalizePostDateOutput(value: string) {
  return value.slice(0, 10);
}

async function loadOptions(capabilities: PostharvestProductivityCapabilities): Promise<PostharvestProductivityFilterOptions> {
  const result = await query<PostharvestProductivityOptionsRow>(`
    select
      array(
        select distinct extract(year from post_date)::int::text
        from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
        order by 1 desc
      ) as years,
      array(
        select distinct lpad(extract(month from post_date)::int::text, 2, '0')
        from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
        order by 1 desc
      ) as months,
      array(
        select distinct area_id
        from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
        order by 1
      ) as areas,
      array(
        select distinct path_post
        from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
        order by 1
      ) as paths,
      array(
        select distinct final_destination
        from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
        order by 1
      ) as destinations,
      ${
        capabilities.hasVarietyCanon
          ? `array(
        select distinct variety_canon
        from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
        order by 1
      )`
          : "null::text[]"
      } as varieties
  `);

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

async function loadRows(
  filters: PostharvestProductivityFilters,
  capabilities: PostharvestProductivityCapabilities,
): Promise<PostharvestProductivityRow[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.dateFrom) {
    pushScalarFilter(clauses, values, `post_date >= ?::date`, filters.dateFrom);
  }

  if (filters.dateTo) {
    pushScalarFilter(clauses, values, `post_date <= ?::date`, filters.dateTo);
  }

  if (filters.year !== "all") {
    pushScalarFilter(clauses, values, `extract(year from post_date)::int = ?::int`, filters.year);
  }

  if (filters.month !== "all") {
    pushScalarFilter(clauses, values, `extract(month from post_date)::int = ?::int`, String(Number(filters.month)));
  }

  pushArrayFilter(clauses, values, "area_id", filters.area);
  pushArrayFilter(clauses, values, "path_post", filters.pathPost);
  pushArrayFilter(clauses, values, "final_destination", filters.finalDestination);
  if (capabilities.hasVarietyCanon) {
    pushArrayFilter(clauses, values, "variety_canon", filters.variety);
  }

  const whereClause = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const result = await query<PostharvestProductivityQueryRow>(
    `
      select
        post_date,
        path_post,
        final_destination,
        ${capabilities.hasVarietyCanon ? "variety_canon," : "null::text as variety_canon,"}
        area_id,
        weight_kg,
        boxes10,
        effective_hours_assigned,
        effective_hours_upstream,
        effective_hours_downstream,
        effective_hours_specific,
        effective_hours_specific_period,
        effective_hours_fallback_macro,
        effective_hours_fallback_day,
        hours_per_box,
        hours_per_box_upstream,
        hours_per_box_downstream
      from ${POSTHARVEST_PRODUCTIVITY_SOURCE}
      ${whereClause}
      order by post_date desc, path_post asc, final_destination asc, area_id asc
    `,
    values,
  );

  return result.rows.map((row) => ({
    postDate: normalizePostDateOutput(row.post_date),
    pathPost: row.path_post,
    finalDestination: row.final_destination,
    varietyCanon: row.variety_canon ?? "ALL",
    areaId: row.area_id,
    weightKg: toSafeNumber(row.weight_kg),
    boxes10: toSafeNumber(row.boxes10),
    effectiveHoursAssigned: toSafeNumber(row.effective_hours_assigned),
    effectiveHoursUpstream: toSafeNumber(row.effective_hours_upstream),
    effectiveHoursDownstream: toSafeNumber(row.effective_hours_downstream),
    effectiveHoursSpecific: toSafeNumber(row.effective_hours_specific),
    effectiveHoursSpecificPeriod: toSafeNumber(row.effective_hours_specific_period),
    effectiveHoursFallbackMacro: toSafeNumber(row.effective_hours_fallback_macro),
    effectiveHoursFallbackDay: toSafeNumber(row.effective_hours_fallback_day),
    hoursPerBox: toNumber(row.hours_per_box),
    hoursPerBoxUpstream: toNumber(row.hours_per_box_upstream),
    hoursPerBoxDownstream: toNumber(row.hours_per_box_downstream),
  }));
}

export async function getPostharvestProductivityDashboardData(
  rawFilters: Partial<PostharvestProductivityFilters> = defaultPostharvestProductivityFilters,
): Promise<PostharvestProductivityDashboardData> {
  const filters = normalizePostharvestProductivityFilters(rawFilters);

  return cachedAsync(
    `postharvest-productivity:${buildCacheKey(filters)}`,
    POSTHARVEST_PRODUCTIVITY_TTL_MS,
    async () => {
      await ensureMaterializedViewExists();
      const capabilities = await detectCapabilities();
      const [options, rows] = await Promise.all([
        loadOptions(capabilities),
        loadRows(filters, capabilities),
      ]);

      const summary = rows.reduce(
        (acc, row) => {
          acc.rowCount += 1;
          acc.totalWeightKg += row.weightKg;
          acc.totalBoxes10 += row.boxes10;
          acc.totalHours += row.effectiveHoursAssigned;
          acc.totalHoursUpstream += row.effectiveHoursUpstream;
          acc.totalHoursDownstream += row.effectiveHoursDownstream;
          acc.postDates.add(row.postDate);
          return acc;
        },
        {
          rowCount: 0,
          totalWeightKg: 0,
          totalBoxes10: 0,
          totalHours: 0,
          totalHoursUpstream: 0,
          totalHoursDownstream: 0,
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
          totalHoursUpstream: summary.totalHoursUpstream,
          totalHoursDownstream: summary.totalHoursDownstream,
          weightedHoursPerBox: summary.totalBoxes10 > 0 ? summary.totalHours / summary.totalBoxes10 : null,
          weightedHoursPerBoxUpstream: summary.totalBoxes10 > 0 ? summary.totalHoursUpstream / summary.totalBoxes10 : null,
          weightedHoursPerBoxDownstream: summary.totalBoxes10 > 0 ? summary.totalHoursDownstream / summary.totalBoxes10 : null,
        },
      };
    },
  );
}
