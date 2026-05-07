import "server-only";

import { query } from "@/lib/db";
import { loadFollowupCatalogs } from "@/lib/talento-humano-seguimientos-catalogs";
import { getFollowupResponseDetail, listFollowupResponses } from "@/lib/talento-humano-seguimientos-responses";
import type { EmployeeFollowupResponseDetail } from "@/modules/talento-humano/seguimientos/server/types";

type DbDate = string | Date | null;

export type CollaboratorSearchFilters = {
  q: string;
  area: string;
  status: "active" | "all";
};

export type CollaboratorSearchRow = {
  personId: string;
  personName: string;
  nationalId: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  jobTitle: string | null;
  jobClassificationCode: string | null;
  employerName: string | null;
  associatedWorkerName: string | null;
  lastEntryDate: string | null;
  lastExitDate: string | null;
  isActive: boolean;
};

export type CollaboratorProfile = CollaboratorSearchRow & {
  gender: string | null;
  maritalStatus: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  employeeType: string | null;
  contractType: string | null;
  farmCode: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  parish: string | null;
  nationality: string | null;
  educationTitle: string | null;
  childrenCount: number | null;
  dependentsCount: number | null;
  entryCount: number;
  performancePayApplicable: boolean | null;
  disabledFlag: boolean | null;
};

export type CollaboratorAreaEvent = {
  eventType: string;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
};

export type CollaboratorPerformanceWeek = {
  isoWeekId: string;
  actualHoursHn: number;
  actualHoursRend: number;
  totalActualHours: number;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
};

export type CollaboratorPerformanceDetail = {
  isoWeekId: string;
  eventDate: string | null;
  activityName: string;
  activityType: string | null;
  unitOfMeasure: string | null;
  actualHours: number;
  effectiveHours: number;
  unitsProduced: number;
  rendimiento: number | null;
};

export type CollaboratorAbsenteeismRow = {
  eventDate: string | null;
  workDate: string | null;
  activityId: string | null;
  activityName: string | null;
  absenceHours: number;
};

export type CollaboratorAbsenteeismMetrics = {
  pctActualHoursRend: number | null;
  pctActualHoursHn: number | null;
  pctAbsTotal: number | null;
};


export type CollaboratorExitRow = {
  entryDate: string | null;
  exitDate: string | null;
  activeDays: number | null;
  activeMonths: number | null;
  exitReason: string | null;
  resignationReason: string | null;
  resignationCategory: string | null;
  resignationClassification: string | null;
  rendimiento: number | null;
  rendimientoMin: number | null;
  cumplimiento: number | null;
  observations: string | null;
};

export type CollaboratorFollowup = EmployeeFollowupResponseDetail & {
  sections: Array<{ title: string; items: Array<{ label: string; value: string | null }> }>;
};

export type CollaboratorDetailPayload = {
  generatedAt: string;
  profile: CollaboratorProfile;
  areaEvents: CollaboratorAreaEvent[];
  performance: {
    totals: CollaboratorPerformanceWeek;
    weekly: CollaboratorPerformanceWeek[];
    detail: CollaboratorPerformanceDetail[];
  } | null;
  absenteeism: {
    /** Total de horas de ausentismo (solo F + P + ATR). */
    totalHours: number;
    /**
     * Total de horas reales registradas en `slv.prod_fact_hours_cur`,
     * usado como denominador canon del % Ausentismo.
     */
    totalActualHours: number;
    metrics: CollaboratorAbsenteeismMetrics | null;
    rows: CollaboratorAbsenteeismRow[];
  } | null;
  exits: CollaboratorExitRow[] | null;
  followups: CollaboratorFollowup[] | null;
};

function toDate(value: DbDate): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text && text !== "UNKNOWN" ? text : null;
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function percentToRatio(value: unknown): number | null {
  if (value == null) return null;
  const numeric = toNumber(value);
  return numeric / 100;
}

function weightedRatio(rows: Array<{ value: number | null; weight: number }>) {
  const denominator = rows.reduce((sum, row) => sum + (row.value === null ? 0 : row.weight), 0);
  if (denominator <= 0) return null;
  return rows.reduce((sum, row) => sum + (row.value === null ? 0 : row.value * row.weight), 0) / denominator;
}

function searchTokens(q: string) {
  return q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
}

export async function searchCollaborators(filters: CollaboratorSearchFilters): Promise<CollaboratorSearchRow[]> {
  const tokens = searchTokens(filters.q);
  if (tokens.length === 0) return [];

  const values: unknown[] = [filters.status, filters.area || "all"];
  const tokenWhere = tokens.map((_, index) => {
    const param = values.length + 1;
    values.push(`%${tokens[index]!.replace(/[%_\\]/g, "\\$&")}%`);
    return `(p.person_id ILIKE $${param} ESCAPE '\\' OR p.person_name ILIKE $${param} ESCAPE '\\' OR p.national_id ILIKE $${param} ESCAPE '\\')`;
  });

  type Row = CollaboratorSearchRow & {
    person_id: string;
    person_name: string | null;
    national_id: string | null;
    area_id: string | null;
    area_name: string | null;
    area_general: string | null;
    job_title: string | null;
    job_classification_code: string | null;
    employer_name: string | null;
    associated_worker_name: string | null;
    last_entry_date: DbDate;
    last_exit_date: DbDate;
    is_active: boolean;
  };

  const result = await query<Row>(
    `
    WITH latest_profile AS (
      SELECT DISTINCT ON (person_id)
        person_id, person_name, national_id, job_title, job_classification_code,
        employer_name, associated_worker_name, last_entry_date, last_exit_date,
        is_current, is_valid
      FROM slv.tthh_dim_person_profile_scd2
      WHERE is_current = true AND is_valid = true
      ORDER BY person_id, valid_from DESC NULLS LAST
    ),
    current_area AS (
      SELECT DISTINCT ON (e.person_id)
        e.person_id, e.area_id, ar.area_name, ar.area_general
      FROM slv.tthh_asgn_person_area_event_scd2 e
      LEFT JOIN slv.camp_dim_area_profile_scd2 ar
        ON ar.area_id = e.area_id AND ar.is_current = true AND ar.is_valid = true
      WHERE e.is_current = true
        AND e.is_valid = true
        AND e.event_type IN ('CA', 'IS')
        AND e.area_id <> 'UNKNOWN'
      ORDER BY e.person_id, CASE WHEN e.event_type = 'CA' THEN 0 ELSE 1 END, e.valid_from DESC
    )
    SELECT
      p.person_id,
      COALESCE(p.person_name, p.person_id) AS person_name,
      p.national_id,
      ca.area_id,
      ca.area_name,
      ca.area_general,
      p.job_title,
      p.job_classification_code,
      p.employer_name,
      p.associated_worker_name,
      to_char(p.last_entry_date, 'YYYY-MM-DD') AS last_entry_date,
      to_char(p.last_exit_date, 'YYYY-MM-DD') AS last_exit_date,
      EXISTS (
        SELECT 1
        FROM slv.tthh_asgn_person_area_event_scd2 active
        WHERE active.person_id = p.person_id
          AND active.event_type = 'IS'
          AND active.is_current = true
          AND active.is_valid = true
          AND active.area_id <> 'UNKNOWN'
          AND CURRENT_DATE >= active.valid_from::date
          AND CURRENT_DATE < COALESCE(active.valid_to::date, DATE '9999-12-31')
      ) AS is_active
    FROM latest_profile p
    LEFT JOIN current_area ca ON ca.person_id = p.person_id
    WHERE ${tokenWhere.join(" AND ")}
      AND ($1::text <> 'active' OR EXISTS (
        SELECT 1
        FROM slv.tthh_asgn_person_area_event_scd2 active
        WHERE active.person_id = p.person_id
          AND active.event_type = 'IS'
          AND active.is_current = true
          AND active.is_valid = true
          AND active.area_id <> 'UNKNOWN'
          AND CURRENT_DATE >= active.valid_from::date
          AND CURRENT_DATE < COALESCE(active.valid_to::date, DATE '9999-12-31')
      ))
      AND ($2::text = 'all' OR ca.area_id = $2 OR ca.area_name = $2 OR ca.area_general = $2)
    ORDER BY p.person_name
    LIMIT 30
    `,
    values,
  );

  return result.rows.map((row) => ({
    personId: row.person_id,
    personName: toText(row.person_name) ?? row.person_id,
    nationalId: toText(row.national_id),
    areaId: toText(row.area_id),
    areaName: toText(row.area_name),
    areaGeneral: toText(row.area_general),
    jobTitle: toText(row.job_title),
    jobClassificationCode: toText(row.job_classification_code),
    employerName: toText(row.employer_name),
    associatedWorkerName: toText(row.associated_worker_name),
    lastEntryDate: toDate(row.last_entry_date),
    lastExitDate: toDate(row.last_exit_date),
    isActive: row.is_active,
  }));
}

async function loadProfile(personId: string): Promise<CollaboratorProfile | null> {
  type Row = {
    person_id: string; person_name: string | null; national_id: string | null; gender: string | null;
    marital_status: string | null; birth_date: DbDate; birth_place: string | null; job_title: string | null;
    employee_type: string | null; contract_type: string | null; farm_code: string | null;
    associated_worker_name: string | null; email: string | null; phone_number: string | null; address: string | null;
    city: string | null; parish: string | null; nationality: string | null; education_title: string | null;
    job_classification_code: string | null; children_count: string | number | null; dependents_count: string | number | null;
    last_entry_date: DbDate; last_exit_date: DbDate; employer_name: string | null;
    performance_pay_applicable: boolean | null; disabled_flag: boolean | null;
    area_id: string | null; area_name: string | null; area_general: string | null; entry_count: string | number | null; is_active: boolean;
  };

  const result = await query<Row>(
    `
    WITH p AS (
      SELECT DISTINCT ON (person_id) *
      FROM slv.tthh_dim_person_profile_scd2
      WHERE person_id = $1 AND is_current = true AND is_valid = true
      ORDER BY person_id, valid_from DESC NULLS LAST
    ),
    current_area AS (
      SELECT DISTINCT ON (e.person_id)
        e.person_id, e.area_id, ar.area_name, ar.area_general
      FROM slv.tthh_asgn_person_area_event_scd2 e
      LEFT JOIN slv.camp_dim_area_profile_scd2 ar
        ON ar.area_id = e.area_id AND ar.is_current = true AND ar.is_valid = true
      WHERE e.person_id = $1
        AND e.is_current = true
        AND e.is_valid = true
        AND e.event_type IN ('CA', 'IS')
        AND e.area_id <> 'UNKNOWN'
      ORDER BY e.person_id, CASE WHEN e.event_type = 'CA' THEN 0 ELSE 1 END, e.valid_from DESC
    ),
    entries AS (
      SELECT COUNT(*) AS entry_count
      FROM slv.tthh_asgn_person_area_event_scd2
      WHERE person_id = $1 AND event_type = 'IS' AND area_id <> 'UNKNOWN' AND is_valid = true
    )
    SELECT
      p.person_id, p.person_name, p.national_id, p.gender, p.marital_status,
      to_char(p.birth_date, 'YYYY-MM-DD') AS birth_date,
      p.birth_place, p.job_title, p.employee_type, p.contract_type, p.farm_code,
      p.associated_worker_name, p.email, p.phone_number, p.address, p.city, p.parish,
      p.nationality, p.education_title, p.job_classification_code, p.children_count,
      p.dependents_count, to_char(p.last_entry_date, 'YYYY-MM-DD') AS last_entry_date,
      to_char(p.last_exit_date, 'YYYY-MM-DD') AS last_exit_date, p.employer_name,
      p.performance_pay_applicable, p.disabled_flag,
      ca.area_id, ca.area_name, ca.area_general, entries.entry_count,
      EXISTS (
        SELECT 1 FROM slv.tthh_asgn_person_area_event_scd2 active
        WHERE active.person_id = p.person_id AND active.event_type = 'IS'
          AND active.is_current = true AND active.is_valid = true AND active.area_id <> 'UNKNOWN'
          AND CURRENT_DATE >= active.valid_from::date
          AND CURRENT_DATE < COALESCE(active.valid_to::date, DATE '9999-12-31')
      ) AS is_active
    FROM p
    LEFT JOIN current_area ca ON ca.person_id = p.person_id
    CROSS JOIN entries
    LIMIT 1
    `,
    [personId],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    personId: row.person_id,
    personName: toText(row.person_name) ?? row.person_id,
    nationalId: toText(row.national_id),
    areaId: toText(row.area_id),
    areaName: toText(row.area_name),
    areaGeneral: toText(row.area_general),
    jobTitle: toText(row.job_title),
    jobClassificationCode: toText(row.job_classification_code),
    employerName: toText(row.employer_name),
    associatedWorkerName: toText(row.associated_worker_name),
    lastEntryDate: toDate(row.last_entry_date),
    lastExitDate: toDate(row.last_exit_date),
    isActive: row.is_active,
    gender: toText(row.gender),
    maritalStatus: toText(row.marital_status),
    birthDate: toDate(row.birth_date),
    birthPlace: toText(row.birth_place),
    employeeType: toText(row.employee_type),
    contractType: toText(row.contract_type),
    farmCode: toText(row.farm_code),
    email: toText(row.email),
    phoneNumber: toText(row.phone_number),
    address: toText(row.address),
    city: toText(row.city),
    parish: toText(row.parish),
    nationality: toText(row.nationality),
    educationTitle: toText(row.education_title),
    childrenCount: row.children_count == null ? null : toNumber(row.children_count),
    dependentsCount: row.dependents_count == null ? null : toNumber(row.dependents_count),
    entryCount: toNumber(row.entry_count),
    performancePayApplicable: row.performance_pay_applicable,
    disabledFlag: row.disabled_flag,
  };
}

async function loadAreaEvents(personId: string): Promise<CollaboratorAreaEvent[]> {
  const result = await query<{
    event_type: string; area_id: string | null; area_name: string | null; area_general: string | null;
    valid_from: DbDate; valid_to: DbDate; is_current: boolean;
  }>(
    `
    SELECT e.event_type, e.area_id, ar.area_name, ar.area_general,
      to_char(e.valid_from, 'YYYY-MM-DD') AS valid_from,
      to_char(e.valid_to, 'YYYY-MM-DD') AS valid_to,
      e.is_current
    FROM slv.tthh_asgn_person_area_event_scd2 e
    LEFT JOIN slv.camp_dim_area_profile_scd2 ar
      ON ar.area_id = e.area_id AND ar.is_current = true AND ar.is_valid = true
    WHERE e.person_id = $1
      AND e.is_valid = true
      AND e.area_id <> 'UNKNOWN'
    ORDER BY e.valid_from DESC NULLS LAST
    LIMIT 60
    `,
    [personId],
  );
  return result.rows.map((row) => ({
    eventType: row.event_type,
    areaId: toText(row.area_id),
    areaName: toText(row.area_name),
    areaGeneral: toText(row.area_general),
    validFrom: toDate(row.valid_from),
    validTo: toDate(row.valid_to),
    isCurrent: row.is_current,
  }));
}

async function loadPerformance(personId: string) {
  const [weeklyResult, detailResult] = await Promise.all([
    query<{ iso_week_id: string | number; rend: unknown; rend_min: unknown; actual_hours_rend: unknown; actual_hours_hn: unknown; total_actual_hours: unknown }>(
      `
      SELECT iso_week_id::text, rend, rend_min, actual_hours_rend, actual_hours_hn, total_actual_hours
      FROM gld.prod_rend_adj_cur
      WHERE person_id = $1
      ORDER BY iso_week_id DESC
      LIMIT 52
      `,
      [personId],
    ),
    query<{
      iso_week_id: string | null; event_date: DbDate; activity_name: string | null; activity_type: string | null;
      unit_of_measure: string | null; actual_hours: unknown; effective_hours: unknown; units_produced: unknown;
    }>(
      `
      SELECT
        c.iso_week_id::text,
        h.event_date,
        h.activity_name,
        h.activity_type,
        h.unit_of_measure,
        SUM(h.actual_hours)::numeric AS actual_hours,
        SUM(h.effective_hours)::numeric AS effective_hours,
        SUM(h.units_produced)::numeric AS units_produced
      FROM gld.mv_prod_hours_cycle_person_cur h
      LEFT JOIN slv.common_dim_calendar_date_scd0 c ON c.calendar_date = h.event_date
      WHERE h.person_id = $1
      GROUP BY c.iso_week_id, h.event_date, h.activity_name, h.activity_type, h.unit_of_measure
      ORDER BY c.iso_week_id DESC NULLS LAST, h.event_date DESC NULLS LAST, h.activity_name
      LIMIT 800
      `,
      [personId],
    ),
  ]);

  const weekly = weeklyResult.rows.map((row) => {
    const actualHoursRend = toNumber(row.actual_hours_rend);
    const actualHoursHn = toNumber(row.actual_hours_hn);
    const totalActualHours = toNumber(row.total_actual_hours);
    const rendimiento = row.rend == null ? null : toNumber(row.rend);
    const rendimientoMin = row.rend_min == null ? null : toNumber(row.rend_min);
    return {
      isoWeekId: String(row.iso_week_id),
      actualHoursHn,
      actualHoursRend,
      totalActualHours,
      rendimiento,
      rendimientoMin,
      cumplimiento: rendimiento !== null && rendimientoMin && rendimientoMin > 0 ? rendimiento / rendimientoMin : null,
    };
  });

  const totals: CollaboratorPerformanceWeek = {
    isoWeekId: "TOTAL",
    actualHoursHn: weekly.reduce((sum, row) => sum + row.actualHoursHn, 0),
    actualHoursRend: weekly.reduce((sum, row) => sum + row.actualHoursRend, 0),
    totalActualHours: weekly.reduce((sum, row) => sum + row.totalActualHours, 0),
    rendimiento: weightedRatio(weekly.map((row) => ({ value: row.rendimiento, weight: row.actualHoursRend }))),
    rendimientoMin: weightedRatio(weekly.map((row) => ({ value: row.rendimientoMin, weight: row.actualHoursRend }))),
    cumplimiento: null,
  };
  totals.cumplimiento = totals.rendimiento !== null && totals.rendimientoMin && totals.rendimientoMin > 0
    ? totals.rendimiento / totals.rendimientoMin
    : null;

  const detail = detailResult.rows.map((row) => {
    const actualHours = toNumber(row.actual_hours);
    const effectiveHours = toNumber(row.effective_hours);
    return {
      isoWeekId: row.iso_week_id ?? "Sin semana",
      eventDate: toDate(row.event_date),
      activityName: toText(row.activity_name) ?? "Sin actividad",
      activityType: toText(row.activity_type),
      unitOfMeasure: toText(row.unit_of_measure),
      actualHours,
      effectiveHours,
      unitsProduced: toNumber(row.units_produced),
      rendimiento: ratio(effectiveHours, actualHours),
    };
  });

  return { totals, weekly, detail };
}

/**
 * Códigos de actividad considerados ausentismo según el canon de RR.HH.:
 * - F   = Faltas
 * - P   = Permisos (con descuento)
 * - ATR = Atrasos
 *
 * El % Ausentismo se calcula como:
 *   absence_rate = SUM(absence_hours) / SUM(actual_hours de prod_fact_hours_cur)
 *
 * Nota: el resto de códigos en `slv.prod_fact_absenteeism_cur` (ej. AJH, L,
 * PTH) NO cuentan como ausentismo a efectos del KPI; quedan filtrados de
 * la tabla detalle también.
 */
const ABSENCE_ACTIVITY_CODES = ["F", "P", "ATR"] as const;

async function loadAbsenteeism(personId: string) {
  const [result, metricsResult, factHoursResult] = await Promise.all([
    query<{ event_date: DbDate; work_date: DbDate; activity_id: string | null; activity_name: string | null; absence_hours: unknown }>(
    `
    SELECT
      a.event_date,
      a.work_date,
      a.activity_id,
      MAX(act.activity_name) AS activity_name,
      SUM(a.absence_hours)::numeric AS absence_hours
    FROM slv.prod_fact_absenteeism_cur a
    LEFT JOIN slv.prod_dim_activity_profile_scd2 act
      ON act.activity_id = a.activity_id
      AND act.is_current = true
      AND act.is_valid = true
    WHERE a.person_id = $1
      AND a.activity_id = ANY($2::text[])
    GROUP BY a.event_date, a.work_date, a.activity_id
    ORDER BY COALESCE(a.work_date, a.event_date) DESC NULLS LAST
    LIMIT 500
    `,
    [personId, [...ABSENCE_ACTIVITY_CODES]],
    ),
    query<{ pct_actual_hours_rend: unknown; pct_actual_hours_hn: unknown; pct_abs_total: unknown }>(
      `
      SELECT pct_actual_hours_rend, pct_actual_hours_hn, pct_abs_total
      FROM gld.mv_tthh_exit_rend_abs_cur
      WHERE person_id = $1
      ORDER BY COALESCE(exit_date, last_exit_date, entry_date) DESC NULLS LAST
      LIMIT 1
      `,
      [personId],
    ),
    // Denominador canon del % ausentismo: total de horas registradas en
    // prod_fact_hours_cur (incluye presenciales productivas y H Normales).
    query<{ actual_hours: unknown }>(
      `
      SELECT SUM(actual_hours)::numeric AS actual_hours
      FROM slv.prod_fact_hours_cur
      WHERE person_id = $1
      `,
      [personId],
    ),
  ]);
  const rows = result.rows.map((row) => ({
    eventDate: toDate(row.event_date),
    workDate: toDate(row.work_date),
    activityId: toText(row.activity_id),
    activityName: toText(row.activity_name),
    absenceHours: toNumber(row.absence_hours),
  }));
  const totalAbsenceHours = rows.reduce((sum, row) => sum + row.absenceHours, 0);
  const totalActualHoursFromFact = toNumber(factHoursResult.rows[0]?.actual_hours);

  // % Ausentismo canon = SUM(absence) / SUM(actual_hours fact). Si la MV de
  // exits tiene un valor pre-calculado para personas que ya salieron, se
  // prefiere ese; caso contrario calculamos en app desde el fact.
  const pctAbsFromFact = totalActualHoursFromFact > 0
    ? totalAbsenceHours / totalActualHoursFromFact
    : null;

  return {
    totalHours: totalAbsenceHours,
    totalActualHours: totalActualHoursFromFact,
    metrics: metricsResult.rows[0]
      ? {
        pctActualHoursRend: percentToRatio(metricsResult.rows[0].pct_actual_hours_rend),
        pctActualHoursHn: percentToRatio(metricsResult.rows[0].pct_actual_hours_hn),
        pctAbsTotal: percentToRatio(metricsResult.rows[0].pct_abs_total) ?? pctAbsFromFact,
      }
      : {
        pctActualHoursRend: null,
        pctActualHoursHn: null,
        pctAbsTotal: pctAbsFromFact,
      },
    rows,
  };
}

async function loadExits(personId: string): Promise<CollaboratorExitRow[]> {
  const result = await query<{
    entry_date: DbDate; exit_date: DbDate; active_days: unknown; active_months: unknown; exit_reason: string | null;
    resignation_reason: string | null; resignation_category: string | null; resignation_classification: string | null;
    rend: unknown; rend_min: unknown; cumpl: unknown; observations: string | null;
  }>(
    `
    SELECT entry_date, exit_date, active_days, active_months, exit_reason,
      resignation_reason, resignation_category, resignation_classification,
      rend, rend_min, cumpl, observations
    FROM gld.mv_tthh_exit_rend_abs_cur
    WHERE person_id = $1
    ORDER BY exit_date DESC NULLS LAST
    LIMIT 50
    `,
    [personId],
  );
  return result.rows.map((row) => ({
    entryDate: toDate(row.entry_date),
    exitDate: toDate(row.exit_date),
    activeDays: row.active_days == null ? null : toNumber(row.active_days),
    activeMonths: row.active_months == null ? null : toNumber(row.active_months),
    exitReason: toText(row.exit_reason),
    resignationReason: toText(row.resignation_reason),
    resignationCategory: toText(row.resignation_category),
    resignationClassification: toText(row.resignation_classification),
    rendimiento: row.rend == null ? null : toNumber(row.rend),
    rendimientoMin: row.rend_min == null ? null : toNumber(row.rend_min),
    cumplimiento: row.cumpl == null ? null : toNumber(row.cumpl),
    observations: toText(row.observations),
  }));
}

function labelFrom(catalogs: Awaited<ReturnType<typeof loadFollowupCatalogs>>, catalogCode: string, itemCode: string | null | undefined) {
  if (!itemCode) return null;
  return catalogs[catalogCode]?.find((item) => item.itemCode === itemCode)?.itemLabelEs ?? itemCode;
}

function followupSections(detail: EmployeeFollowupResponseDetail, catalogs: Awaited<ReturnType<typeof loadFollowupCatalogs>>) {
  const item = (catalog: string, code: string | null | undefined) => labelFrom(catalogs, catalog, code);
  const select = (group: string, catalog: string) => detail.selections
    .filter((selection) => selection.selectionGroupCode === group)
    .map((selection) => {
      const base = item(catalog, selection.itemCode) ?? selection.itemCode;
      return selection.otherDetail ? `${base}: ${selection.otherDetail}` : base;
    })
    .join(", ") || null;

  if (detail.followupRouteCode === "AGR") {
    return [
      { title: "Dificultades laborales", items: [
        { label: "Dificultades", value: select("work_difficulty", "work_difficulty") },
        { label: "Observacion", value: detail.workDifficultyObservation },
      ] },
      { title: "Relaciones laborales", items: [
        { label: "Trato companeros", value: item("treatment_rating", detail.coworkerTreatmentRatingCode) },
        { label: "Trato supervisor", value: item("treatment_rating", detail.supervisorTreatmentRatingCode) },
        { label: "Trato jefe area", value: item("treatment_rating", detail.areaManagerTreatmentRatingCode) },
        { label: "Persona conflicto", value: detail.conflictPersonId },
        { label: "Situacion", value: detail.conflictSituationDetail },
      ] },
      { title: "Permanencia y apoyo", items: [
        { label: "Le gusta", value: select("work_like_most", "work_like_most") },
        { label: "Oportunidades", value: select("improvement_opportunity", "improvement_opportunity") },
        { label: "Permanencia", value: item("retention_intention", detail.retentionIntentionCode) },
        { label: "Apoyo RRHH", value: item("hr_support_need", detail.hrSupportNeedCode) },
      ] },
      { title: "Actividades e inconvenientes", items: [
        { label: "Actividades", value: detail.developedActivitiesDescription },
        { label: "Hubo inconveniente", value: item("yes_no", detail.hasInconvenienceCode) },
        { label: "Fecha inconveniente", value: detail.inconvenienceDate },
        { label: "Actividad", value: item("inconvenience_activity", detail.inconvenienceActivityCode) },
        { label: "Inconveniente", value: item("inconvenience_type", detail.inconvenienceTypeCode) },
      ] },
    ];
  }

  return [
    { title: "Adaptacion inicial", items: [
      { label: "Induccion suficiente", value: item("adaptation_response", detail.inductionSufficientCode) },
      { label: "Transporte", value: item("adaptation_response", detail.transportProblemCode) },
      { label: "Bienvenida equipo", value: item("adaptation_response", detail.teamWelcomeCode) },
      { label: "Observacion", value: detail.adaptationNegativeObservation },
    ] },
    { title: "Satisfaccion", items: [
      { label: "Claridad funciones", value: item("satisfaction_level", detail.roleClaritySatisfactionCode) },
      { label: "Ambiente", value: item("satisfaction_level", detail.workEnvironmentSatisfactionCode) },
      { label: "Equipos", value: item("satisfaction_level", detail.equipmentSatisfactionCode) },
      { label: "Satisfaccion reciente", value: item("satisfaction_level", detail.recentWorkSatisfactionCode) },
    ] },
    { title: "Mejora y permanencia", items: [
      { label: "Aspecto a mejorar", value: item("work_aspect_to_improve", detail.workAspectToImproveCode) },
      { label: "Detalle", value: detail.dissatisfactionDetail },
      { label: "Permanencia final", value: item("retention_intention", detail.finalRetentionIntentionCode) },
      { label: "Sugerencia final", value: detail.finalStaySuggestion },
    ] },
  ];
}

async function loadFollowups(personId: string): Promise<CollaboratorFollowup[]> {
  try {
    const [summaries, catalogs] = await Promise.all([
      listFollowupResponses({ personId, includeAll: false, limit: 30 }),
      loadFollowupCatalogs(),
    ]);

    const details = await Promise.all(
      summaries.map((summary) => getFollowupResponseDetail(summary.eventId, true)),
    );

    return details
      .filter((detail): detail is EmployeeFollowupResponseDetail => Boolean(detail))
      .map((detail) => ({ ...detail, sections: followupSections(detail, catalogs) }));
  } catch {
    return [];
  }
}

/**
 * Construye `CollaboratorAbsenteeismMetrics` con fallback calculado.
 *
 * `gld.mv_tthh_exit_rend_abs_cur` solo cubre personas con salida registrada,
 * por lo que para colaboradores activos los porcentajes vienen como `null`.
 * Cuando la MV no tiene métricas, las derivamos en app desde:
 *
 * - `performance.totals.actualHoursRend` (horas en actividades dif. "H Normales")
 * - `performance.totals.actualHoursHn`   (horas presenciales en "H Normales")
 * - `absenteeism.totalHours`             (F + P + ATR — solo categorías canon)
 * - `absenteeism.totalActualHours`       (denominador canon: SUM de actual_hours
 *                                         desde slv.prod_fact_hours_cur)
 *
 * Fórmulas:
 *
 * - `% H Rendimiento` = `actualHoursRend / (actualHoursRend + actualHoursHn)`
 * - `% H Normales`    = `actualHoursHn / (actualHoursRend + actualHoursHn)`  (= 1 − %HR)
 * - `% Ausentismo`    = `absenceHours / totalActualHours` (canon RR.HH.)
 */
function buildMetricsWithFallback(
  fromMv: CollaboratorAbsenteeismMetrics | null,
  performance: { totals: CollaboratorPerformanceWeek } | null,
  absenceHours: number,
  totalActualHours: number,
): CollaboratorAbsenteeismMetrics | null {
  const rendHours = performance?.totals.actualHoursRend ?? 0;
  const hnHours = performance?.totals.actualHoursHn ?? 0;
  const workedHours = rendHours + hnHours;

  const fallback: CollaboratorAbsenteeismMetrics = {
    pctActualHoursRend: workedHours > 0 ? rendHours / workedHours : null,
    pctActualHoursHn: workedHours > 0 ? hnHours / workedHours : null,
    // Canon: ausentismo / total de horas registradas en el fact de horas.
    pctAbsTotal: totalActualHours > 0 ? absenceHours / totalActualHours : null,
  };

  if (!fromMv) {
    if (
      fallback.pctActualHoursRend == null
      && fallback.pctActualHoursHn == null
      && fallback.pctAbsTotal == null
    ) {
      return null;
    }
    return fallback;
  }

  return {
    pctActualHoursRend: fromMv.pctActualHoursRend ?? fallback.pctActualHoursRend,
    pctActualHoursHn: fromMv.pctActualHoursHn ?? fallback.pctActualHoursHn,
    pctAbsTotal: fromMv.pctAbsTotal ?? fallback.pctAbsTotal,
  };
}

export async function getCollaboratorDetail(
  personId: string,
  sections: {
    performance: boolean;
    absenteeism: boolean;
    exits: boolean;
    followups: boolean;
  },
): Promise<CollaboratorDetailPayload | null> {
  const profile = await loadProfile(personId);
  if (!profile) return null;

  const [areaEvents, performance, absenteeism, exits, followups] = await Promise.all([
    loadAreaEvents(personId),
    sections.performance ? loadPerformance(personId) : Promise.resolve(null),
    sections.absenteeism ? loadAbsenteeism(personId) : Promise.resolve(null),
    sections.exits ? loadExits(personId) : Promise.resolve(null),
    sections.followups ? loadFollowups(personId) : Promise.resolve(null),
  ]);

  // Fallback de métricas para colaboradores activos (sin registro en MV de exits).
  const enrichedAbsenteeism = absenteeism
    ? {
        ...absenteeism,
        metrics: buildMetricsWithFallback(
          absenteeism.metrics,
          performance,
          absenteeism.totalHours,
          absenteeism.totalActualHours,
        ),
      }
    : null;

  return {
    generatedAt: new Date().toISOString(),
    profile,
    areaEvents,
    performance,
    absenteeism: enrichedAbsenteeism,
    exits,
    followups,
  };
}

