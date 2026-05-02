import { query } from "@/lib/db";
import { queryHumanTalent } from "@/lib/human-talent-db";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { deriveFollowupRoute } from "@/lib/talento-humano-seguimientos-person";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FollowupIndicatorFilters = {
  year: string;
  month: string;
  area: string;
  worker: string;
  route: string;
  dateFrom: string;
  dateTo: string;
};

export type FollowupWorkerStat = {
  workerName: string;
  scheduled: number;
  registered: number;
  pending: number;
  complianceRate: number;
};

export type FollowupAreaStat = {
  areaName: string;
  scheduled: number;
  registered: number;
  pending: number;
  complianceRate: number;
};

export type FollowupMonthStat = {
  yearMonth: string;
  label: string;
  scheduled: number;
  registered: number;
  complianceRate: number;
};

export type FollowupIndicatorData = {
  summary: {
    totalScheduled: number;
    totalRegistered: number;
    totalPending: number;
    complianceRate: number;
    goal: number;
    prevPeriod: { label: string; complianceRate: number } | null;
  };
  byWorker: FollowupWorkerStat[];
  byArea: FollowupAreaStat[];
  byMonth: FollowupMonthStat[];
  options: {
    years: string[];
    months: string[];
    areas: string[];
    workers: string[];
  };
  filters: FollowupIndicatorFilters;
};

// ── Internal row types ─────────────────────────────────────────────────────────

type DwRow = {
  unique_follow_up_code: string;
  follow_up_type: string | null;
  job_classification_code: string | null;
  associated_worker_name: string | null;
  area_name: string | null;
  year_str: string;
  month_num: number;
};

type OptionsRow = {
  years: string[] | null;
  months: string[] | null;
  areas: string[] | null;
  workers: string[] | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;

function monthLabel(year: string, monthNum: number) {
  return `${MONTHS_ES[monthNum - 1] ?? monthNum} ${year}`;
}

function prevMonthKey(year: string, month: string): { year: string; month: string } {
  const m = Number(month);
  const y = Number(year);
  if (m === 1) return { year: String(y - 1), month: "12" };
  return { year, month: String(m - 1) };
}

// ── Options loader ─────────────────────────────────────────────────────────────

async function loadOptions(): Promise<{ years: string[]; months: string[]; areas: string[]; workers: string[] }> {
  const asOfDate = new Date().toISOString().slice(0, 10);
  const result = await query<OptionsRow>(`
    WITH base AS (
      SELECT
        EXTRACT(YEAR FROM f.follow_up_date::date)::int::text AS year_str,
        EXTRACT(MONTH FROM f.follow_up_date::date)::int::text AS month_str,
        a.area_name,
        p.associated_worker_name
      FROM gld.mv_tthh_asgn_followup_scd2 f
      JOIN slv.tthh_dim_person_profile_scd2 p
        ON p.person_id = f.person_id AND p.is_current = true AND p.is_valid = true
      LEFT JOIN LATERAL (
        SELECT ap.area_name
        FROM slv.tthh_asgn_person_area_event_scd2 e
        LEFT JOIN slv.camp_dim_area_profile_scd2 ap
          ON ap.area_id = e.area_id AND ap.is_current = true AND ap.is_valid = true
        WHERE e.person_id = f.person_id AND e.event_type = 'CA' AND e.is_valid = true
          AND $1::date >= e.valid_from::date
          AND $1::date < COALESCE(e.valid_to::date, DATE '9999-12-31')
        ORDER BY e.valid_from DESC
        LIMIT 1
      ) a ON true
      WHERE f.follow_up_date IS NOT NULL
        AND EXTRACT(YEAR FROM f.follow_up_date::date)::int <= EXTRACT(YEAR FROM CURRENT_DATE)::int
    )
    SELECT
      (SELECT ARRAY_AGG(y ORDER BY y::int DESC) FROM (SELECT DISTINCT year_str AS y FROM base) _y) AS years,
      (SELECT ARRAY_AGG(m ORDER BY m::int ASC)  FROM (SELECT DISTINCT month_str AS m FROM base) _m) AS months,
      (SELECT ARRAY_AGG(a ORDER BY a ASC)        FROM (SELECT DISTINCT area_name AS a FROM base WHERE area_name IS NOT NULL) _a) AS areas,
      (SELECT ARRAY_AGG(w ORDER BY w ASC)        FROM (SELECT DISTINCT associated_worker_name AS w FROM base WHERE associated_worker_name IS NOT NULL) _w) AS workers
  `, [asOfDate]);

  const row = result.rows[0];
  return {
    years: row?.years ?? [],
    months: row?.months ?? [],
    areas: row?.areas ?? [],
    workers: row?.workers ?? [],
  };
}

// ── Core query ─────────────────────────────────────────────────────────────────

async function queryDwRows(filters: FollowupIndicatorFilters, overrides?: { year?: string; month?: string }): Promise<DwRow[]> {
  const asOfDate = new Date().toISOString().slice(0, 10);
  const params: unknown[] = [asOfDate];
  const conditions: string[] = [];
  let pIdx = 2;

  const effectiveYears = overrides?.year ? [overrides.year] : decodeMultiSelectValue(filters.year);
  const effectiveMonths = overrides?.month ? [overrides.month] : decodeMultiSelectValue(filters.month);

  if (effectiveYears.length > 0) {
    conditions.push(`EXTRACT(YEAR FROM f.follow_up_date::date)::int::text = ANY($${pIdx}::text[])`);
    params.push(effectiveYears);
    pIdx++;
  }

  if (effectiveMonths.length > 0) {
    conditions.push(`EXTRACT(MONTH FROM f.follow_up_date::date)::int::text = ANY($${pIdx}::text[])`);
    params.push(effectiveMonths);
    pIdx++;
  }

  const areas = decodeMultiSelectValue(filters.area);
  if (areas.length > 0) {
    conditions.push(`a.area_name = ANY($${pIdx}::text[])`);
    params.push(areas);
    pIdx++;
  }

  const workers = decodeMultiSelectValue(filters.worker);
  if (workers.length > 0) {
    conditions.push(`p.associated_worker_name = ANY($${pIdx}::text[])`);
    params.push(workers);
    pIdx++;
  }

  if (filters.dateFrom && !overrides) {
    conditions.push(`f.follow_up_date::date >= $${pIdx}::date`);
    params.push(filters.dateFrom);
    pIdx++;
  }

  if (filters.dateTo && !overrides) {
    conditions.push(`f.follow_up_date::date <= $${pIdx}::date`);
    params.push(filters.dateTo);
    pIdx++;
  }

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

  const result = await query<DwRow>(`
    SELECT
      f.unique_follow_up_code,
      f.follow_up_type,
      p.job_classification_code,
      p.associated_worker_name,
      a.area_name,
      EXTRACT(YEAR FROM f.follow_up_date::date)::int::text AS year_str,
      EXTRACT(MONTH FROM f.follow_up_date::date)::int AS month_num
    FROM gld.mv_tthh_asgn_followup_scd2 f
    JOIN slv.tthh_dim_person_profile_scd2 p
      ON p.person_id = f.person_id AND p.is_current = true AND p.is_valid = true
    LEFT JOIN LATERAL (
      SELECT ap.area_name
      FROM slv.tthh_asgn_person_area_event_scd2 e
      LEFT JOIN slv.camp_dim_area_profile_scd2 ap
        ON ap.area_id = e.area_id AND ap.is_current = true AND ap.is_valid = true
      WHERE e.person_id = f.person_id AND e.event_type = 'CA' AND e.is_valid = true
        AND $1::date >= e.valid_from::date
        AND $1::date < COALESCE(e.valid_to::date, DATE '9999-12-31')
      ORDER BY e.valid_from DESC
      LIMIT 1
    ) a ON true
    WHERE f.follow_up_date IS NOT NULL
      AND EXTRACT(YEAR FROM f.follow_up_date::date)::int <= EXTRACT(YEAR FROM CURRENT_DATE)::int
    ${whereClause}
    ORDER BY f.follow_up_date DESC
  `, params);

  return result.rows;
}

async function queryRegisteredCodes(uniqueCodes: string[]): Promise<Set<string>> {
  const registered = new Set<string>();
  if (uniqueCodes.length === 0) return registered;

  try {
    const placeholders = uniqueCodes.map((_, i) => `$${i + 1}`).join(", ");
    const result = await queryHumanTalent<{ unique_follow_up_code: string }>(`
      SELECT DISTINCT unique_follow_up_code
      FROM public.tthh_fact_employee_followup_response_cur
      WHERE is_latest_valid_version = true
        AND is_valid = true
        AND unique_follow_up_code IN (${placeholders})
    `, uniqueCodes);

    for (const row of result.rows) {
      registered.add(row.unique_follow_up_code);
    }
  } catch (error) {
    console.warn("[TTHH-INDICADOR] No se pudo consultar db_human_talent.", error);
  }

  return registered;
}

// ── Aggregation ────────────────────────────────────────────────────────────────

function aggregateRows(rows: DwRow[], registeredCodes: Set<string>, routeFilter: string) {
  const routeValues = decodeMultiSelectValue(routeFilter);
  const byWorkerMap = new Map<string, { scheduled: number; registered: number }>();
  const byAreaMap = new Map<string, { scheduled: number; registered: number }>();
  const byMonthMap = new Map<string, { year: string; monthNum: number; scheduled: number; registered: number }>();

  let totalScheduled = 0;
  let totalRegistered = 0;

  for (const row of rows) {
    const derivedRoute = deriveFollowupRoute(row.follow_up_type, row.job_classification_code);
    if (routeValues.length > 0 && !routeValues.includes(derivedRoute ?? "")) continue;

    const isRegistered = registeredCodes.has(row.unique_follow_up_code);
    totalScheduled++;
    if (isRegistered) totalRegistered++;

    const worker = row.associated_worker_name ?? "Sin asignar";
    const workerEntry = byWorkerMap.get(worker) ?? { scheduled: 0, registered: 0 };
    workerEntry.scheduled++;
    if (isRegistered) workerEntry.registered++;
    byWorkerMap.set(worker, workerEntry);

    const area = row.area_name ?? "Sin área";
    const areaEntry = byAreaMap.get(area) ?? { scheduled: 0, registered: 0 };
    areaEntry.scheduled++;
    if (isRegistered) areaEntry.registered++;
    byAreaMap.set(area, areaEntry);

    const yearMonth = `${row.year_str}-${String(row.month_num).padStart(2, "0")}`;
    const monthEntry = byMonthMap.get(yearMonth) ?? { year: row.year_str, monthNum: row.month_num, scheduled: 0, registered: 0 };
    monthEntry.scheduled++;
    if (isRegistered) monthEntry.registered++;
    byMonthMap.set(yearMonth, monthEntry);
  }

  const byWorker: FollowupWorkerStat[] = [...byWorkerMap.entries()]
    .map(([workerName, s]) => ({
      workerName,
      scheduled: s.scheduled,
      registered: s.registered,
      pending: s.scheduled - s.registered,
      complianceRate: s.scheduled > 0 ? (s.registered / s.scheduled) * 100 : 0,
    }))
    .sort((a, b) => b.scheduled - a.scheduled);

  const byArea: FollowupAreaStat[] = [...byAreaMap.entries()]
    .map(([areaName, s]) => ({
      areaName,
      scheduled: s.scheduled,
      registered: s.registered,
      pending: s.scheduled - s.registered,
      complianceRate: s.scheduled > 0 ? (s.registered / s.scheduled) * 100 : 0,
    }))
    .sort((a, b) => b.complianceRate - a.complianceRate);

  const byMonth: FollowupMonthStat[] = [...byMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, s]) => ({
      yearMonth,
      label: monthLabel(s.year, s.monthNum),
      scheduled: s.scheduled,
      registered: s.registered,
      complianceRate: s.scheduled > 0 ? (s.registered / s.scheduled) * 100 : 0,
    }));

  return { totalScheduled, totalRegistered, byWorker, byArea, byMonth };
}

// ── Public loader ──────────────────────────────────────────────────────────────

export const defaultFollowupIndicatorFilters: FollowupIndicatorFilters = {
  year: "",
  month: "",
  area: "",
  worker: "",
  route: "",
  dateFrom: "",
  dateTo: "",
};

export async function loadFollowupIndicatorData(
  filters: FollowupIndicatorFilters,
): Promise<FollowupIndicatorData> {
  const [dwRows, options] = await Promise.all([
    queryDwRows(filters),
    loadOptions(),
  ]);

  const uniqueCodes = [...new Set(dwRows.map((r) => r.unique_follow_up_code).filter(Boolean))];
  const registeredCodes = await queryRegisteredCodes(uniqueCodes);

  const { totalScheduled, totalRegistered, byWorker, byArea, byMonth } =
    aggregateRows(dwRows, registeredCodes, filters.route);

  const totalPending = totalScheduled - totalRegistered;
  const complianceRate = totalScheduled > 0 ? (totalRegistered / totalScheduled) * 100 : 0;

  // Previous period comparison (only when exactly one year+month are selected)
  const selectedYears = decodeMultiSelectValue(filters.year);
  const selectedMonths = decodeMultiSelectValue(filters.month);
  let prevPeriod: { label: string; complianceRate: number } | null = null;
  if (selectedYears.length === 1 && selectedMonths.length === 1) {
    const prev = prevMonthKey(selectedYears[0]!, selectedMonths[0]!);
    try {
      const prevRows = await queryDwRows(filters, prev);
      if (prevRows.length > 0) {
        const prevCodes = [...new Set(prevRows.map((r) => r.unique_follow_up_code).filter(Boolean))];
        const prevRegistered = await queryRegisteredCodes(prevCodes);
        const { totalScheduled: ps, totalRegistered: pr } = aggregateRows(prevRows, prevRegistered, filters.route);
        prevPeriod = {
          label: monthLabel(prev.year, Number(prev.month)),
          complianceRate: ps > 0 ? (pr / ps) * 100 : 0,
        };
      }
    } catch {
      // Non-critical — comparison is supplementary
    }
  }

  return {
    summary: {
      totalScheduled,
      totalRegistered,
      totalPending,
      complianceRate,
      goal: 90,
      prevPeriod,
    },
    byWorker,
    byArea,
    byMonth,
    options,
    filters,
  };
}
