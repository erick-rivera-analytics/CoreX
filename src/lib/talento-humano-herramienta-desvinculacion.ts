import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, matchesMultiSelectValue } from "@/lib/multi-select";
import {
  RULES_CONSTANTS,
  classifyEstado,
  isoWeekSubtract,
  type DesvinculacionEstado,
  type WeekDatum,
} from "@/lib/talento-humano-desvinculacion-rules";

export type DesvinculacionToolFilters = {
  weekId: string;
  area: string;
  jobClassification: string;
  estado: string;
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
  // Métricas de la SEMANA filtrada (la última en `window`).
  actualHoursRend: number;
  actualHoursHn: number;
  totalActualHours: number;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
  // Veredicto + soporte estadístico sobre la ventana de 12 semanas.
  estado: DesvinculacionEstado;
  validWeeks: number;
  totalWeeksInWindow: number;
  lastIsValid: boolean;
  mkTau: number | null;
  mkZ: number | null;
  slopePerWeek: number | null;
  // Serie completa de 12 sem (ordenada ASC) para alimentar el chart sin
  // segundo fetch.
  window: WeekDatum[];
};

export type DesvinculacionToolEstadoCounts = Record<DesvinculacionEstado, number>;

export type DesvinculacionToolSummary = {
  weekId: string;
  weekIdFrom: string;
  totalCollaborators: number;
  estadoCounts: DesvinculacionToolEstadoCounts;
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
      estado: normalizeMulti(raw.estado ?? null),
      q: (raw.q ?? "").trim(),
    },
    weeks,
  };
}

type RawWindowRow = {
  person_id: string;
  iso_week_id: string;
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

type PersonAccumulator = {
  personId: string;
  personName: string;
  nationalId: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  jobTitle: string | null;
  jobClassificationCode: string | null;
  weeksByIsoId: Map<string, RawWindowRow>;
};

async function loadDesvinculacionWindow(
  weekIdFrom: string,
  weekIdTo: string,
): Promise<Map<string, PersonAccumulator>> {
  if (!weekIdFrom || !weekIdTo) return new Map();

  const result = await query<RawWindowRow>(
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
    rend_window AS (
      SELECT
        trim(r.person_id::text)                  AS person_id,
        r.iso_week_id::text                      AS iso_week_id,
        SUM(r.actual_hours_rend)                 AS actual_hours_rend,
        SUM(r.actual_hours_hn)                   AS actual_hours_hn,
        SUM(r.total_actual_hours)                AS total_actual_hours,
        SUM(r.rend * r.actual_hours_rend)        AS rend_weighted_num,
        SUM(r.rend_min * r.actual_hours_rend)    AS rend_min_weighted_num
      FROM gld.prod_rend_adj_cur r
      WHERE r.iso_week_id::text BETWEEN $1 AND $2
        AND r.iso_week_id IS NOT NULL
      GROUP BY trim(r.person_id::text), r.iso_week_id
    )
    SELECT
      ap.person_id,
      rw.iso_week_id,
      COALESCE(p.person_name, ap.person_id) AS person_name,
      p.national_id,
      ap.area_id,
      ar.area_name,
      ar.area_general,
      p.job_title,
      p.job_classification_code,
      COALESCE(rw.actual_hours_rend, 0)::numeric  AS actual_hours_rend,
      COALESCE(rw.actual_hours_hn, 0)::numeric    AS actual_hours_hn,
      COALESCE(rw.total_actual_hours, 0)::numeric AS total_actual_hours,
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
    INNER JOIN rend_window rw ON rw.person_id = ap.person_id
    ORDER BY COALESCE(p.person_name, ap.person_id), rw.iso_week_id ASC
    `,
    [weekIdFrom, weekIdTo],
  );

  const acc = new Map<string, PersonAccumulator>();
  for (const row of result.rows) {
    const existing = acc.get(row.person_id);
    if (existing) {
      existing.weeksByIsoId.set(row.iso_week_id, row);
    } else {
      const weeksByIsoId = new Map<string, RawWindowRow>();
      weeksByIsoId.set(row.iso_week_id, row);
      acc.set(row.person_id, {
        personId: row.person_id,
        personName: toText(row.person_name) ?? row.person_id,
        nationalId: toText(row.national_id),
        areaId: toText(row.area_id),
        areaName: toText(row.area_name),
        areaGeneral: toText(row.area_general),
        jobTitle: toText(row.job_title),
        jobClassificationCode: toText(row.job_classification_code),
        weeksByIsoId,
      });
    }
  }
  return acc;
}

function rawWindowToWeekData(rows: RawWindowRow[]): WeekDatum[] {
  return rows.map((row) => {
    const actualHoursRend = toNumber(row.actual_hours_rend);
    const totalActualHours = toNumber(row.total_actual_hours);
    const rendimiento = row.rend == null ? null : toNumber(row.rend);
    const rendimientoMin = row.rend_min == null ? null : toNumber(row.rend_min);
    const cumplimiento = rendimiento !== null && rendimientoMin !== null && rendimientoMin > 0
      ? rendimiento / rendimientoMin
      : null;
    return {
      isoWeekId: row.iso_week_id,
      cumplimiento,
      actualHoursRend,
      totalActualHours,
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

function rowMatchesEstado(row: DesvinculacionToolRow, encoded: string): boolean {
  if (!encoded || encoded === "all") return true;
  const selected = decodeMultiSelectValue(encoded);
  if (selected.length === 0) return true;
  return selected.includes(row.estado);
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

const EMPTY_ESTADO_COUNTS: DesvinculacionToolEstadoCounts = {
  salida: 0,
  advertencia: 0,
  bajo_sin_tendencia: 0,
  advertencia_nuevo: 0,
  cumple_con_caida: 0,
  en_observacion_nuevo: 0,
  ok: 0,
  sin_senal_actual: 0,
  sin_datos: 0,
};

function buildSummary(
  rows: DesvinculacionToolRow[],
  weekId: string,
  weekIdFrom: string,
): DesvinculacionToolSummary {
  const estadoCounts: DesvinculacionToolEstadoCounts = { ...EMPTY_ESTADO_COUNTS };
  for (const row of rows) {
    estadoCounts[row.estado] += 1;
  }
  return {
    weekId,
    weekIdFrom,
    totalCollaborators: rows.length,
    estadoCounts,
  };
}

export async function getDesvinculacionToolData(
  filters: DesvinculacionToolFilters,
  weeksOverride?: string[],
): Promise<DesvinculacionToolData> {
  const weeks = weeksOverride ?? await loadAvailableWeeks();
  const fallbackWeek = weeks[0] ?? "";
  const weekId = normalizeWeek(filters.weekId) ?? fallbackWeek;
  const weekIdFrom = weekId ? isoWeekSubtract(weekId, RULES_CONSTANTS.WINDOW_WEEKS - 1) : "";

  const normalized: DesvinculacionToolFilters = {
    weekId,
    area: normalizeMulti(filters.area),
    jobClassification: normalizeMulti(filters.jobClassification),
    estado: normalizeMulti(filters.estado),
    q: filters.q?.trim() ?? "",
  };

  const accumulator = await loadDesvinculacionWindow(weekIdFrom, weekId);

  const allRows: DesvinculacionToolRow[] = [];
  for (const person of accumulator.values()) {
    const sortedRawRows = Array.from(person.weeksByIsoId.values())
      .sort((a, b) => a.iso_week_id.localeCompare(b.iso_week_id));
    const windowData = rawWindowToWeekData(sortedRawRows);

    const lastRaw = person.weeksByIsoId.get(weekId);
    const actualHoursRend = lastRaw ? toNumber(lastRaw.actual_hours_rend) : 0;
    const actualHoursHn = lastRaw ? toNumber(lastRaw.actual_hours_hn) : 0;
    const totalActualHours = lastRaw ? toNumber(lastRaw.total_actual_hours) : 0;
    const rendimiento = lastRaw && lastRaw.rend != null ? toNumber(lastRaw.rend) : null;
    const rendimientoMin = lastRaw && lastRaw.rend_min != null ? toNumber(lastRaw.rend_min) : null;
    const cumplimiento = rendimiento !== null && rendimientoMin !== null && rendimientoMin > 0
      ? rendimiento / rendimientoMin
      : null;

    const classification = classifyEstado(windowData, weekId);

    allRows.push({
      personId: person.personId,
      personName: person.personName,
      nationalId: person.nationalId,
      areaId: person.areaId,
      areaName: person.areaName,
      areaGeneral: person.areaGeneral,
      jobTitle: person.jobTitle,
      jobClassificationCode: person.jobClassificationCode,
      actualHoursRend,
      actualHoursHn,
      totalActualHours,
      rendimiento,
      rendimientoMin,
      cumplimiento,
      estado: classification.estado,
      validWeeks: classification.validWeeks,
      totalWeeksInWindow: classification.totalWeeks,
      lastIsValid: classification.lastIsValid,
      mkTau: classification.mannKendall?.tau ?? null,
      mkZ: classification.mannKendall?.z ?? null,
      slopePerWeek: classification.theilSenSlope,
      window: windowData,
    });
  }

  // Filtro canon: excluimos "sin_datos" — sin base de análisis no aporta
  // señal. Las demás categorías (incluso `sin_senal_actual`) sí entran.
  const visibleRows = allRows.filter((row) => row.estado !== "sin_datos");
  const options = buildOptions(visibleRows, weeks);
  const tokens = searchTokens(normalized.q);

  const filteredRows = visibleRows.filter((row) =>
    rowMatchesArea(row, normalized.area)
      && matchesMultiSelectValue(normalized.jobClassification, row.jobClassificationCode)
      && rowMatchesEstado(row, normalized.estado)
      && rowMatchesSearch(row, tokens),
  );

  return {
    generatedAt: new Date().toISOString(),
    filters: normalized,
    options,
    summary: buildSummary(filteredRows, weekId, weekIdFrom),
    rows: filteredRows,
  };
}
