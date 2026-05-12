import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, matchesMultiSelectValue } from "@/lib/multi-select";

export type DesvinculacionToolFilters = {
  weekId: string;
  area: string;
  jobClassification: string;
  q: string;
};

export type DesvinculacionToolRow = {
  personId: string;
  personName: string;
  nationalId: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  jobTitle: string | null;
  jobClassificationCode: string | null;
  actualHoursRend: number;
  actualHoursHn: number;
  totalActualHours: number;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
};

export type DesvinculacionToolSummary = {
  weekId: string;
  totalCollaborators: number;
  totalCollaboratorsWithRend: number;
  avgRendimiento: number | null;
  avgRendimientoMin: number | null;
  avgCumplimiento: number | null;
  totalActualHoursRend: number;
  totalActualHoursHn: number;
  totalActualHours: number;
};

export type DesvinculacionToolOptions = {
  areas: Array<{ id: string; name: string }>;
  jobClassifications: string[];
  weeks: string[];
};

export type DesvinculacionToolData = {
  generatedAt: string;
  filters: DesvinculacionToolFilters;
  options: DesvinculacionToolOptions;
  summary: DesvinculacionToolSummary;
  rows: DesvinculacionToolRow[];
};

export type DesvinculacionPersonWeek = {
  isoWeekId: string;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
  actualHoursRend: number;
  actualHoursHn: number;
  totalActualHours: number;
  pctHoursRend: number | null;
};

export type DesvinculacionPersonHistory = {
  personId: string;
  personName: string;
  weeks: DesvinculacionPersonWeek[];
};

const WEEK_PATTERN = /^\d{6}$/;

function toText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text && text !== "UNKNOWN" ? text : null;
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeMulti(value: string | undefined | null): string {
  if (!value) return "all";
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "all") return "all";
  return trimmed;
}

function normalizeWeek(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (WEEK_PATTERN.test(trimmed)) return trimmed;
  const dashed = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (dashed) {
    const year = dashed[1];
    const week = String(Number(dashed[2])).padStart(2, "0");
    return `${year}${week}`;
  }
  return null;
}

async function loadAvailableWeeks(): Promise<string[]> {
  const result = await query<{ iso_week_id: string | number }>(
    `
    SELECT DISTINCT iso_week_id::text AS iso_week_id
    FROM gld.prod_rend_adj_cur
    WHERE iso_week_id IS NOT NULL
    ORDER BY iso_week_id::text DESC
    LIMIT 60
    `,
  );
  return result.rows.map((row) => String(row.iso_week_id));
}

export async function normalizeDesvinculacionFilters(
  raw: Record<string, string | undefined | null> = {},
): Promise<{ filters: DesvinculacionToolFilters; weeks: string[] }> {
  const weeks = await loadAvailableWeeks();
  const fallbackWeek = weeks[0] ?? "";

  const weekId = normalizeWeek(raw.weekId) ?? fallbackWeek;

  return {
    filters: {
      weekId,
      area: normalizeMulti(raw.area ?? null),
      jobClassification: normalizeMulti(raw.jobClassification ?? null),
      q: (raw.q ?? "").trim(),
    },
    weeks,
  };
}

type RawRow = {
  person_id: string;
  person_name: string | null;
  national_id: string | null;
  area_id: string | null;
  area_name: string | null;
  area_general: string | null;
  job_title: string | null;
  job_classification_code: string | null;
  actual_hours_rend: number | string | null;
  actual_hours_hn: number | string | null;
  total_actual_hours: number | string | null;
  rend: number | string | null;
  rend_min: number | string | null;
};

async function loadDesvinculacionRows(weekId: string): Promise<DesvinculacionToolRow[]> {
  if (!weekId) return [];

  const result = await query<RawRow>(
    `
    WITH active_persons AS (
      SELECT DISTINCT ON (e.person_id)
        e.person_id, e.area_id
      FROM slv.tthh_asgn_person_area_event_scd2 e
      WHERE e.event_type = 'IS'
        AND e.is_current = true
        AND e.is_valid = true
        AND e.area_id <> 'UNKNOWN'
        AND CURRENT_DATE >= e.valid_from::date
        AND CURRENT_DATE < COALESCE(e.valid_to::date, DATE '9999-12-31')
      ORDER BY e.person_id, e.valid_from DESC
    ),
    profiles AS (
      SELECT DISTINCT ON (person_id)
        person_id, person_name, national_id, job_title,
        contract_type, job_classification_code
      FROM slv.tthh_dim_person_profile_scd2
      WHERE is_current = true AND is_valid = true
      ORDER BY person_id, valid_from DESC NULLS LAST
    ),
    rend_week AS (
      SELECT
        r.person_id,
        SUM(r.actual_hours_rend)              AS actual_hours_rend,
        SUM(r.actual_hours_hn)                AS actual_hours_hn,
        SUM(r.total_actual_hours)             AS total_actual_hours,
        SUM(r.rend * r.actual_hours_rend)     AS rend_weighted_num,
        SUM(r.rend_min * r.actual_hours_rend) AS rend_min_weighted_num
      FROM gld.prod_rend_adj_cur r
      WHERE r.iso_week_id::text = $1
      GROUP BY r.person_id
    )
    SELECT
      ap.person_id,
      COALESCE(p.person_name, ap.person_id)         AS person_name,
      p.national_id,
      ap.area_id,
      ar.area_name,
      ar.area_general,
      p.job_title,
      p.job_classification_code,
      COALESCE(rw.actual_hours_rend, 0)::numeric    AS actual_hours_rend,
      COALESCE(rw.actual_hours_hn, 0)::numeric      AS actual_hours_hn,
      COALESCE(rw.total_actual_hours, 0)::numeric   AS total_actual_hours,
      CASE WHEN COALESCE(rw.actual_hours_rend, 0) > 0
           THEN rw.rend_weighted_num / rw.actual_hours_rend
           ELSE NULL END                            AS rend,
      CASE WHEN COALESCE(rw.actual_hours_rend, 0) > 0
           THEN rw.rend_min_weighted_num / rw.actual_hours_rend
           ELSE NULL END                            AS rend_min
    FROM active_persons ap
    LEFT JOIN profiles p ON p.person_id = ap.person_id
    LEFT JOIN slv.camp_dim_area_profile_scd2 ar
      ON ar.area_id = ap.area_id AND ar.is_current = true AND ar.is_valid = true
    LEFT JOIN rend_week rw ON rw.person_id = ap.person_id
    ORDER BY COALESCE(p.person_name, ap.person_id)
    `,
    [weekId],
  );

  return result.rows.map((row) => {
    const rendimiento = row.rend == null ? null : toNumber(row.rend);
    const rendimientoMin = row.rend_min == null ? null : toNumber(row.rend_min);
    const cumplimiento = rendimiento !== null && rendimientoMin !== null && rendimientoMin > 0
      ? rendimiento / rendimientoMin
      : null;
    return {
      personId: row.person_id,
      personName: toText(row.person_name) ?? row.person_id,
      nationalId: toText(row.national_id),
      areaId: toText(row.area_id),
      areaName: toText(row.area_name),
      areaGeneral: toText(row.area_general),
      jobTitle: toText(row.job_title),
      jobClassificationCode: toText(row.job_classification_code),
      actualHoursRend: toNumber(row.actual_hours_rend),
      actualHoursHn: toNumber(row.actual_hours_hn),
      totalActualHours: toNumber(row.total_actual_hours),
      rendimiento,
      rendimientoMin,
      cumplimiento,
    };
  });
}

function searchTokens(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean).slice(0, 6).map((token) => token.toLocaleLowerCase("es-EC"));
}

function rowMatchesSearch(row: DesvinculacionToolRow, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = [row.personId, row.personName, row.nationalId, row.areaId, row.areaName]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLocaleLowerCase("es-EC"))
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function rowMatchesArea(row: DesvinculacionToolRow, encoded: string): boolean {
  if (!encoded || encoded === "all") return true;
  const selected = decodeMultiSelectValue(encoded);
  if (selected.length === 0) return true;
  const candidates = [row.areaId, row.areaName, row.areaGeneral].filter((part): part is string => Boolean(part));
  return candidates.some((candidate) => selected.includes(candidate));
}

function buildOptions(
  rows: DesvinculacionToolRow[],
  weeks: string[],
): DesvinculacionToolOptions {
  const areas = new Map<string, string>();
  const classifications = new Set<string>();
  for (const row of rows) {
    if (row.areaId) areas.set(row.areaId, row.areaName ?? row.areaId);
    if (row.jobClassificationCode) classifications.add(row.jobClassificationCode);
  }
  return {
    areas: Array.from(areas.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es-EC")),
    jobClassifications: Array.from(classifications).sort((a, b) => a.localeCompare(b, "es-EC")),
    weeks,
  };
}

function buildSummary(rows: DesvinculacionToolRow[], weekId: string): DesvinculacionToolSummary {
  let totalRendNum = 0;
  let totalRendMinNum = 0;
  let totalActualHoursRend = 0;
  let totalActualHoursHn = 0;
  let totalActualHours = 0;
  let withRend = 0;

  for (const row of rows) {
    if (row.actualHoursRend > 0 && row.rendimiento !== null) {
      totalRendNum += row.rendimiento * row.actualHoursRend;
      withRend += 1;
    }
    if (row.actualHoursRend > 0 && row.rendimientoMin !== null) {
      totalRendMinNum += row.rendimientoMin * row.actualHoursRend;
    }
    totalActualHoursRend += row.actualHoursRend;
    totalActualHoursHn += row.actualHoursHn;
    totalActualHours += row.totalActualHours;
  }

  const avgRendimiento = totalActualHoursRend > 0 ? totalRendNum / totalActualHoursRend : null;
  const avgRendimientoMin = totalActualHoursRend > 0 ? totalRendMinNum / totalActualHoursRend : null;
  const avgCumplimiento = avgRendimiento !== null && avgRendimientoMin !== null && avgRendimientoMin > 0
    ? avgRendimiento / avgRendimientoMin
    : null;

  return {
    weekId,
    totalCollaborators: rows.length,
    totalCollaboratorsWithRend: withRend,
    avgRendimiento,
    avgRendimientoMin,
    avgCumplimiento,
    totalActualHoursRend,
    totalActualHoursHn,
    totalActualHours,
  };
}

export async function getDesvinculacionPersonHistory(
  personId: string,
): Promise<DesvinculacionPersonHistory> {
  type RawWeek = {
    iso_week_id: string | number;
    rend: number | string | null;
    rend_min: number | string | null;
    actual_hours_rend: number | string | null;
    actual_hours_hn: number | string | null;
    total_actual_hours: number | string | null;
  };

  type RawProfile = { person_name: string | null };

  // El canon para `gld.prod_rend_adj_cur` usa `trim(person_id::text) = $1`
  // — la columna puede venir con padding o tipo no-text — y `iso_week_id::int`
  // para ordenar (ver `getPersonRendimiento` en `talento-humano-rendimiento-loader`).
  // `Promise.allSettled` evita que un fallo aislado tumbe toda la respuesta.
  const normalizedPersonId = personId.trim();
  const [historyResult, profileResult] = await Promise.allSettled([
    query<RawWeek>(
      `
      SELECT
        iso_week_id::text AS iso_week_id,
        rend,
        rend_min,
        actual_hours_rend,
        actual_hours_hn,
        total_actual_hours
      FROM gld.prod_rend_adj_cur
      WHERE trim(person_id::text) = $1
        AND iso_week_id IS NOT NULL
      ORDER BY iso_week_id::int ASC
      `,
      [normalizedPersonId],
    ),
    query<RawProfile>(
      `
      SELECT person_name
      FROM slv.tthh_dim_person_profile_scd2
      WHERE trim(person_id::text) = $1
        AND is_current = true
        AND is_valid = true
      ORDER BY valid_from DESC NULLS LAST
      LIMIT 1
      `,
      [normalizedPersonId],
    ),
  ]);

  const historyRows: RawWeek[] = historyResult.status === "fulfilled" ? historyResult.value.rows : [];
  const profileRow: RawProfile | undefined = profileResult.status === "fulfilled"
    ? profileResult.value.rows[0]
    : undefined;

  const weeks: DesvinculacionPersonWeek[] = historyRows.map((row) => {
    const rendimiento = row.rend == null ? null : toNumber(row.rend);
    const rendimientoMin = row.rend_min == null ? null : toNumber(row.rend_min);
    const cumplimiento = rendimiento !== null && rendimientoMin !== null && rendimientoMin > 0
      ? rendimiento / rendimientoMin
      : null;
    const actualHoursRend = toNumber(row.actual_hours_rend);
    const actualHoursHn = toNumber(row.actual_hours_hn);
    const totalActualHours = toNumber(row.total_actual_hours);
    return {
      isoWeekId: String(row.iso_week_id),
      rendimiento,
      rendimientoMin,
      cumplimiento,
      actualHoursRend,
      actualHoursHn,
      totalActualHours,
      pctHoursRend: totalActualHours > 0 ? actualHoursRend / totalActualHours : null,
    };
  });

  return {
    personId: normalizedPersonId,
    personName: toText(profileRow?.person_name) ?? normalizedPersonId,
    weeks,
  };
}

export async function getDesvinculacionToolData(
  filters: DesvinculacionToolFilters,
  weeksOverride?: string[],
): Promise<DesvinculacionToolData> {
  const weeks = weeksOverride ?? await loadAvailableWeeks();
  const fallbackWeek = weeks[0] ?? "";
  const weekId = normalizeWeek(filters.weekId) ?? fallbackWeek;

  const normalized: DesvinculacionToolFilters = {
    weekId,
    area: normalizeMulti(filters.area),
    jobClassification: normalizeMulti(filters.jobClassification),
    q: filters.q?.trim() ?? "",
  };

  const rawRows = await loadDesvinculacionRows(weekId);
  // Filtro canon: solo personas con cumplimiento calculable en la semana.
  // Si la persona no tuvo horas con rendimiento o rendMin = 0, no tiene
  // sentido mostrarla — no aporta señal de desvinculación.
  const allRows = rawRows.filter((row) => row.cumplimiento !== null);
  const options = buildOptions(allRows, weeks);
  const tokens = searchTokens(normalized.q);

  const filteredRows = allRows.filter((row) =>
    rowMatchesArea(row, normalized.area)
      && matchesMultiSelectValue(normalized.jobClassification, row.jobClassificationCode)
      && rowMatchesSearch(row, tokens),
  );

  return {
    generatedAt: new Date().toISOString(),
    filters: normalized,
    options,
    summary: buildSummary(filteredRows, weekId),
    rows: filteredRows,
  };
}
