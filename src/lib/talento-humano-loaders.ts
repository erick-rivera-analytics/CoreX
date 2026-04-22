import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { generateAvailableWeeks } from "@/lib/talento-humano-utils";
import type {
  TalentoActivosData,
  TalentoFilters,
  TalentoFilterOptions,
  TalentoIngresoRecord,
  TalentoPersonProfile,
  TalentoPersonRecord,
  TalentoRotacionData,
  TalentoRotacionWeekRow,
  TalentoSalidaRecord,
} from "@/lib/talento-humano";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TALENTO_TTL_MS = 60 * 1000;
const TALENTO_EMPLOYER = "2 - STARFLOWERS CIA. LTDA.";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type DateValue = string | Date | null;

type ActiveQueryRow = {
  person_id: string;
  person_name: string | null;
  area_id: string;
  area_name: string | null;
  area_general: string | null;
  gender: string | null;
  marital_status: string | null;
  birth_place: string | null;
  job_title: string | null;
  employee_type: string | null;
  contract_type: string | null;
  associated_worker_name: string | null;
  job_classification_code: string | null;
  employer_name: string | null;
  address: string | null;
  city: string | null;
  parish: string | null;
  birth_date: DateValue;
  last_entry_date: DateValue;
  farm_code: string | null;
  nationality: string | null;
  education_title: string | null;
  children_count: string | number | null;
  dependents_count: string | number | null;
  performance_pay_applicable: boolean | null;
  disabled_flag: boolean | null;
};

type RotacionRow = ActiveQueryRow & {
  _type: "weekly" | "salida" | "ingreso";
  iso_week_id: string | null;
  entries: string | number | null;
  exits: string | number | null;
  activos: string | number | null;
  entry_date: DateValue;
  entry_iso_week_id: string | null;
  exit_date: DateValue;
  exit_iso_week_id: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function toIsoDate(value: DateValue): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeDate(value: string | undefined, fallback: string) {
  const cleaned = value?.trim();
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : fallback;
}

function pushCommonFilter(
  filters: TalentoFilters,
  activeAlias: string,
  areaAlias: string,
  profileAlias: string,
  values: unknown[],
  wheres: string[],
) {
  let idx = values.length + 1;
  const addMultiWhere = (expression: string, value: string) => {
    const selectedValues = decodeMultiSelectValue(value);
    if (!selectedValues.length) return;
    wheres.push(`${expression} = ANY($${idx++}::text[])`);
    values.push(selectedValues);
  };

  addMultiWhere(`COALESCE(${areaAlias}.area_general, ${activeAlias}.area_id)`, filters.areaGeneral);
  addMultiWhere(`COALESCE(${areaAlias}.area_name, ${activeAlias}.area_id)`, filters.area);
  addMultiWhere(`${profileAlias}.gender`, filters.gender);
  addMultiWhere(`${profileAlias}.marital_status`, filters.maritalStatus);
  addMultiWhere(`${profileAlias}.city`, filters.city);
  addMultiWhere(`${profileAlias}.job_title`, filters.jobTitle);
  addMultiWhere(`${profileAlias}.job_classification_code`, filters.jobClassification);
  addMultiWhere(`${profileAlias}.associated_worker_name`, filters.associatedWorker);
}

function buildActivosQuery(filters: TalentoFilters): { text: string; values: unknown[] } {
  const values: unknown[] = [filters.snapshotDate, TALENTO_EMPLOYER];
  const wheres: string[] = [];
  pushCommonFilter(filters, "a", "ar", "p", values, wheres);
  const extraWhere = wheres.length ? `AND ${wheres.join(" AND ")}` : "";

  return {
    values,
    text: `
      WITH
      cal AS (
        SELECT LEAST(COALESCE(MAX(calendar_date), $1::date), CURRENT_DATE) AS snapshot_date
        FROM slv.common_dim_calendar_date_scd0
        WHERE calendar_date = $1::date
      ),
      event_candidates AS (
        SELECT DISTINCT ON (a.person_id, a.event_type)
          a.person_id,
          a.area_id,
          a.event_type
        FROM slv.tthh_asgn_person_area_event_scd2 a
        CROSS JOIN cal
        WHERE a.area_id <> 'UNKNOWN'
          AND a.event_type = 'CA'
          AND a.valid_from <= cal.snapshot_date
          AND COALESCE(a.valid_to, CURRENT_DATE) >= cal.snapshot_date
        ORDER BY a.person_id, a.event_type, a.valid_from DESC
      ),
      assignments AS (
        SELECT DISTINCT ON (person_id)
          person_id,
          area_id
        FROM event_candidates
        ORDER BY person_id, CASE WHEN event_type = 'CA' THEN 0 ELSE 1 END
      ),
      profiles AS (
        SELECT DISTINCT ON (person_id)
          person_id, person_name, gender, marital_status, birth_place,
          job_title, employee_type, contract_type, associated_worker_name,
          job_classification_code, employer_name, address, city, parish,
          birth_date, last_entry_date, farm_code, nationality, education_title,
          children_count, dependents_count, performance_pay_applicable, disabled_flag
        FROM slv.tthh_dim_person_profile_scd2
        ORDER BY person_id, valid_from DESC NULLS LAST
      ),
      areas AS (
        SELECT DISTINCT ON (area_id)
          area_id, area_name, area_general
        FROM slv.camp_dim_area_profile_scd2
        ORDER BY area_id, valid_from DESC NULLS LAST
      )
      SELECT
        a.person_id,
        COALESCE(p.person_name, a.person_id) AS person_name,
        a.area_id,
        COALESCE(ar.area_name, a.area_id) AS area_name,
        COALESCE(ar.area_general, a.area_id) AS area_general,
        p.gender, p.marital_status, p.birth_place,
        p.job_title, p.employee_type, p.contract_type,
        p.associated_worker_name, p.job_classification_code,
        p.employer_name, p.address, p.city, p.parish,
        p.birth_date, p.last_entry_date, p.farm_code, p.nationality, p.education_title,
        p.children_count, p.dependents_count, p.performance_pay_applicable, p.disabled_flag
      FROM assignments a
      JOIN profiles p ON p.person_id = a.person_id AND p.employer_name = $2
      LEFT JOIN areas ar ON ar.area_id = a.area_id
      WHERE 1=1 ${extraWhere}
      ORDER BY area_general, area_name, person_name
    `,
  };
}

function mapActiveRow(row: ActiveQueryRow): TalentoPersonRecord {
  return {
    personId: row.person_id,
    personName: toStr(row.person_name) ?? row.person_id,
    areaId: row.area_id,
    areaName: toStr(row.area_name) ?? row.area_id,
    areaGeneral: toStr(row.area_general) ?? row.area_id,
    gender: toStr(row.gender),
    maritalStatus: toStr(row.marital_status),
    birthPlace: toStr(row.birth_place),
    jobTitle: toStr(row.job_title),
    employeeType: toStr(row.employee_type),
    contractType: toStr(row.contract_type),
    associatedWorkerName: toStr(row.associated_worker_name),
    jobClassificationCode: toStr(row.job_classification_code),
    employerName: toStr(row.employer_name),
    address: toStr(row.address),
    city: toStr(row.city),
    parish: toStr(row.parish),
    birthDate: toIsoDate(row.birth_date),
    lastEntryDate: toIsoDate(row.last_entry_date),
    farmCode: toStr(row.farm_code),
    nationality: toStr(row.nationality),
    educationTitle: toStr(row.education_title),
    childrenCount: toNum(row.children_count),
    dependentsCount: toNum(row.dependents_count),
    performancePayApplicable: row.performance_pay_applicable,
    disabledFlag: row.disabled_flag,
  };
}

function uniq(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .map(String)
    .sort((left, right) => left.localeCompare(right, "es-EC"));
}

function buildFilterOptions(rows: TalentoPersonRecord[]): TalentoFilterOptions {
  return {
    weeksAvailable: generateAvailableWeeks(2024),
    areaGenerals: uniq(rows.map((row) => row.areaGeneral)),
    areas: uniq(rows.map((row) => row.areaName)),
    genders: uniq(rows.map((row) => row.gender)),
    maritalStatuses: uniq(rows.map((row) => row.maritalStatus)),
    cities: uniq(rows.map((row) => row.city)),
    jobTitles: uniq(rows.map((row) => row.jobTitle)),
    employerNames: uniq(rows.map((row) => row.employerName)),
    jobClassifications: uniq(rows.map((row) => row.jobClassificationCode)),
    associatedWorkers: uniq(rows.map((row) => row.associatedWorkerName)),
    employeeTypes: uniq(rows.map((row) => row.employeeType)),
    contractTypes: uniq(rows.map((row) => row.contractType)),
    birthPlaces: uniq(rows.map((row) => row.birthPlace)),
    parishes: uniq(rows.map((row) => row.parish)),
  };
}

// ---------------------------------------------------------------------------
// Public loaders
// ---------------------------------------------------------------------------

export async function getActivosPersonas(filters: TalentoFilters): Promise<TalentoActivosData> {
  const cacheKey = `talento:activos:v2:${JSON.stringify(filters)}`;
  return cachedAsync(cacheKey, TALENTO_TTL_MS, async () => {
    const { text, values } = buildActivosQuery(filters);
    const result = await query<ActiveQueryRow>(text, values);
    const rows = result.rows.map(mapActiveRow);

    return {
      generatedAt: new Date().toISOString(),
      filters,
      options: buildFilterOptions(rows),
      rows,
      summary: {
        totalPersonas: rows.length,
        totalAreas: new Set(rows.map((row) => row.areaId)).size,
        totalCargos: new Set(rows.map((row) => row.jobTitle).filter(Boolean)).size,
      },
    };
  });
}

export async function getRotacionData(filters: TalentoFilters): Promise<TalentoRotacionData> {
  const cacheKey = `talento:rotacion:v2:${JSON.stringify(filters)}`;
  return cachedAsync(cacheKey, TALENTO_TTL_MS, async () => {
    const values: unknown[] = [filters.weekFrom, filters.weekTo, TALENTO_EMPLOYER];
    const caWheres: string[] = [];
    const entryWheres: string[] = [];
    const isWheres: string[] = [];
    pushCommonFilter(filters, "a", "ar", "p", values, caWheres);
    pushCommonFilter(filters, "e", "ar", "p", values, entryWheres);
    pushCommonFilter(filters, "s", "ar", "p", values, isWheres);

    const caExtra = caWheres.length ? `AND ${caWheres.join(" AND ")}` : "";
    const entryExtra = entryWheres.length ? `AND ${entryWheres.join(" AND ")}` : "";
    const isExtra = isWheres.length ? `AND ${isWheres.join(" AND ")}` : "";

    const result = await query<RotacionRow>(
      `
      WITH
      week_dates AS (
        SELECT
          iso_week_id,
          MIN(calendar_date) AS week_start,
          MAX(calendar_date) AS week_end
        FROM slv.common_dim_calendar_date_scd0
        WHERE iso_week_id >= $1 AND iso_week_id <= $2
        GROUP BY iso_week_id
      ),
      period AS (
        SELECT MIN(week_start) AS period_start, MAX(week_end) AS period_end
        FROM week_dates
      ),
      profiles AS (
        SELECT DISTINCT ON (person_id)
          person_id, person_name, gender, marital_status, birth_place,
          job_title, employee_type, contract_type, associated_worker_name,
          job_classification_code, employer_name, address, city, parish,
          birth_date, last_entry_date, farm_code, nationality, education_title,
          children_count, dependents_count, performance_pay_applicable, disabled_flag
        FROM slv.tthh_dim_person_profile_scd2
        ORDER BY person_id, valid_from DESC NULLS LAST
      ),
      areas AS (
        SELECT DISTINCT ON (area_id)
          area_id, area_name, area_general
        FROM slv.camp_dim_area_profile_scd2
        ORDER BY area_id, valid_from DESC NULLS LAST
      ),
      active_candidates AS (
        SELECT w.iso_week_id, a.person_id
        FROM week_dates w
        JOIN slv.tthh_asgn_person_area_event_scd2 a
          ON a.event_type = 'IS'
          AND a.area_id <> 'UNKNOWN'
          AND a.valid_from <= w.week_end
          AND COALESCE(a.valid_to, CURRENT_DATE) >= w.week_start
        JOIN profiles p ON p.person_id = a.person_id AND p.employer_name = $3
        LEFT JOIN areas ar ON ar.area_id = a.area_id
        WHERE 1=1 ${caExtra}
      ),
      filtered_entries AS (
        SELECT
          e.person_id,
          COALESCE(p.person_name, e.person_id) AS person_name,
          e.area_id,
          COALESCE(ar.area_name, e.area_id) AS area_name,
          COALESCE(ar.area_general, e.area_id) AS area_general,
          p.gender, p.marital_status, p.birth_place,
          p.job_title, p.employee_type, p.contract_type,
          p.associated_worker_name, p.job_classification_code,
          p.employer_name, p.address, p.city, p.parish,
          p.birth_date, p.last_entry_date, p.farm_code, p.nationality, p.education_title,
          p.children_count, p.dependents_count, p.performance_pay_applicable, p.disabled_flag,
          e.valid_from::date AS entry_date,
          c.iso_week_id::text AS entry_iso_week_id
        FROM slv.tthh_asgn_person_area_event_scd2 e
        CROSS JOIN period pr
        JOIN profiles p ON p.person_id = e.person_id AND p.employer_name = $3
        LEFT JOIN areas ar ON ar.area_id = e.area_id
        LEFT JOIN slv.common_dim_calendar_date_scd0 c ON c.calendar_date = e.valid_from::date
        WHERE e.event_type = 'IS'
          AND e.area_id <> 'UNKNOWN'
          AND e.valid_from >= pr.period_start
          AND e.valid_from <= pr.period_end
          ${entryExtra}
      ),
      filtered_exits AS (
        SELECT
          s.person_id,
          COALESCE(p.person_name, s.person_id) AS person_name,
          s.area_id,
          COALESCE(ar.area_name, s.area_id) AS area_name,
          COALESCE(ar.area_general, s.area_id) AS area_general,
          p.gender, p.marital_status, p.birth_place,
          p.job_title, p.employee_type, p.contract_type,
          p.associated_worker_name, p.job_classification_code,
          p.employer_name, p.address, p.city, p.parish,
          p.birth_date, p.last_entry_date, p.farm_code, p.nationality, p.education_title,
          p.children_count, p.dependents_count, p.performance_pay_applicable, p.disabled_flag,
          s.valid_to::date AS exit_date,
          c.iso_week_id::text AS exit_iso_week_id
        FROM slv.tthh_asgn_person_area_event_scd2 s
        CROSS JOIN period pr
        JOIN profiles p ON p.person_id = s.person_id AND p.employer_name = $3
        LEFT JOIN areas ar ON ar.area_id = s.area_id
        LEFT JOIN slv.common_dim_calendar_date_scd0 c ON c.calendar_date = s.valid_to::date
        WHERE s.event_type = 'IS'
          AND s.area_id <> 'UNKNOWN'
          AND s.valid_to IS NOT NULL
          AND s.valid_to >= pr.period_start
          AND s.valid_to <= pr.period_end
          ${isExtra}
      ),
      weekly_entries AS (
        SELECT w.iso_week_id, COUNT(DISTINCT fe.person_id) AS entries
        FROM week_dates w
        LEFT JOIN filtered_entries fe ON fe.entry_date >= w.week_start AND fe.entry_date <= w.week_end
        GROUP BY w.iso_week_id
      ),
      weekly_exits AS (
        SELECT w.iso_week_id, COUNT(DISTINCT fe.person_id) AS exits
        FROM week_dates w
        LEFT JOIN filtered_exits fe ON fe.exit_date >= w.week_start AND fe.exit_date <= w.week_end
        GROUP BY w.iso_week_id
      ),
      weekly_activos AS (
        SELECT w.iso_week_id, COUNT(DISTINCT ac.person_id) AS activos
        FROM week_dates w
        LEFT JOIN active_candidates ac ON ac.iso_week_id = w.iso_week_id
        GROUP BY w.iso_week_id
      ),
      entry_by_week AS (
        SELECT DISTINCT ON (person_id, entry_iso_week_id)
          person_id, person_name, area_id, area_name, area_general,
          gender, marital_status, birth_place,
          job_title, employee_type, contract_type,
          associated_worker_name, job_classification_code,
          employer_name, address, city, parish,
          birth_date, last_entry_date, farm_code, nationality, education_title,
          children_count, dependents_count, performance_pay_applicable, disabled_flag,
          entry_date, entry_iso_week_id
        FROM filtered_entries
        ORDER BY person_id, entry_iso_week_id, entry_date DESC
      ),
      salida_by_week AS (
        SELECT DISTINCT ON (person_id, exit_iso_week_id)
          person_id, person_name, area_id, area_name, area_general,
          gender, marital_status, birth_place,
          job_title, employee_type, contract_type,
          associated_worker_name, job_classification_code,
          employer_name, address, city, parish,
          birth_date, last_entry_date, farm_code, nationality, education_title,
          children_count, dependents_count, performance_pay_applicable, disabled_flag,
          exit_date, exit_iso_week_id
        FROM filtered_exits
        ORDER BY person_id, exit_iso_week_id, exit_date DESC
      )
      SELECT
        'weekly' AS _type,
        we.iso_week_id::text AS iso_week_id,
        went.entries::text AS entries,
        we.exits::text AS exits,
        wa.activos::text AS activos,
        NULL AS person_id, NULL AS person_name, NULL AS area_id, NULL AS area_name,
        NULL AS area_general, NULL AS gender, NULL AS marital_status, NULL AS birth_place,
        NULL AS job_title, NULL AS employee_type, NULL AS contract_type,
        NULL AS associated_worker_name, NULL AS job_classification_code,
        NULL AS employer_name, NULL AS address, NULL AS city, NULL AS parish,
        NULL AS birth_date, NULL AS last_entry_date, NULL AS farm_code,
        NULL AS nationality, NULL AS education_title,
        NULL AS children_count, NULL AS dependents_count,
        NULL AS performance_pay_applicable, NULL AS disabled_flag,
        NULL AS entry_date, NULL AS entry_iso_week_id,
        NULL AS exit_date, NULL AS exit_iso_week_id
      FROM weekly_exits we
      JOIN weekly_entries went USING (iso_week_id)
      JOIN weekly_activos wa USING (iso_week_id)

      UNION ALL

      SELECT
        'ingreso' AS _type,
        NULL AS iso_week_id, NULL AS entries, NULL AS exits, NULL AS activos,
        person_id, person_name, area_id, area_name, area_general,
        gender, marital_status, birth_place, job_title, employee_type, contract_type,
        associated_worker_name, job_classification_code,
        employer_name, address, city, parish,
        birth_date, last_entry_date, farm_code, nationality, education_title,
        children_count, dependents_count, performance_pay_applicable, disabled_flag,
        entry_date::text AS entry_date, entry_iso_week_id,
        NULL AS exit_date, NULL AS exit_iso_week_id
      FROM entry_by_week

      UNION ALL

      SELECT
        'salida' AS _type,
        NULL AS iso_week_id, NULL AS entries, NULL AS exits, NULL AS activos,
        person_id, person_name, area_id, area_name, area_general,
        gender, marital_status, birth_place, job_title, employee_type, contract_type,
        associated_worker_name, job_classification_code,
        employer_name, address, city, parish,
        birth_date, last_entry_date, farm_code, nationality, education_title,
        children_count, dependents_count, performance_pay_applicable, disabled_flag,
        NULL AS entry_date, NULL AS entry_iso_week_id,
        exit_date::text AS exit_date, exit_iso_week_id
      FROM salida_by_week
      ORDER BY _type, iso_week_id
      `,
      values,
    );

    const weeklyEvolution: TalentoRotacionWeekRow[] = [];
    const ingresos: TalentoIngresoRecord[] = [];
    const salidas: TalentoSalidaRecord[] = [];

    for (const row of result.rows) {
      if (row._type === "weekly" && row.iso_week_id) {
        const entries = toNum(row.entries) ?? 0;
        const exits = toNum(row.exits) ?? 0;
        const activos = toNum(row.activos) ?? 0;
        weeklyEvolution.push({
          isoWeekId: row.iso_week_id,
          entries,
          exits,
          activos,
          rate: activos > 0 ? (exits / activos) * 100 : null,
        });
        continue;
      }

      if (row._type === "ingreso" && row.person_id) {
        ingresos.push({
          ...mapActiveRow(row),
          entryDate: toIsoDate(row.entry_date),
          isoWeekId: toStr(row.entry_iso_week_id),
        });
        continue;
      }

      if (row._type === "salida" && row.person_id) {
        salidas.push({
          ...mapActiveRow(row),
          exitDate: toIsoDate(row.exit_date),
          isoWeekId: toStr(row.exit_iso_week_id),
        });
      }
    }

    const avgActivos = weeklyEvolution.length
      ? weeklyEvolution.reduce((sum, row) => sum + row.activos, 0) / weeklyEvolution.length
      : 0;
    const totalIngresos = ingresos.length;
    const totalSalidas = salidas.length;

    return {
      generatedAt: new Date().toISOString(),
      filters,
      options: buildFilterOptions([...ingresos, ...salidas]),
      summary: {
        totalIngresos,
        totalSalidas,
        avgActivos: Math.round(avgActivos),
        rotationRate: avgActivos > 0 ? (totalSalidas / avgActivos) * 100 : null,
      },
      weeklyEvolution,
      ingresos,
      salidas,
    };
  });
}

export async function getPersonProfile(personId: string): Promise<TalentoPersonProfile | null> {
  const cacheKey = `talento:person:v2:${personId}`;
  return cachedAsync(cacheKey, 5 * 60 * 1000, async () => {
    type ProfileRow = {
      person_id: string;
      person_name: string | null;
      national_id: string | null;
      gender: string | null;
      marital_status: string | null;
      birth_date: DateValue;
      birth_place: string | null;
      job_title: string | null;
      employee_type: string | null;
      contract_type: string | null;
      farm_code: string | null;
      associated_worker_name: string | null;
      email: string | null;
      phone_number: string | null;
      address: string | null;
      city: string | null;
      parish: string | null;
      nationality: string | null;
      education_title: string | null;
      job_classification_code: string | null;
      children_count: string | number | null;
      dependents_count: string | number | null;
      last_entry_date: DateValue;
      last_exit_date: DateValue;
      employer_name: string | null;
      performance_pay_applicable: boolean | null;
      disabled_flag: boolean | null;
    };

    const result = await query<ProfileRow>(
      `SELECT DISTINCT ON (person_id)
         person_id, person_name, national_id, gender, marital_status,
         birth_date, birth_place, job_title, employee_type, contract_type,
         farm_code, associated_worker_name, email, phone_number,
         address, city, parish, nationality, education_title,
         job_classification_code, children_count, dependents_count,
         last_entry_date, last_exit_date, employer_name,
         performance_pay_applicable, disabled_flag
       FROM slv.tthh_dim_person_profile_scd2
       WHERE person_id = $1
         AND employer_name = $2
       ORDER BY person_id, valid_from DESC NULLS LAST
       LIMIT 1`,
      [personId, TALENTO_EMPLOYER],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      personId: row.person_id,
      personName: toStr(row.person_name),
      nationalId: toStr(row.national_id),
      gender: toStr(row.gender),
      maritalStatus: toStr(row.marital_status),
      birthDate: toIsoDate(row.birth_date),
      birthPlace: toStr(row.birth_place),
      jobTitle: toStr(row.job_title),
      employeeType: toStr(row.employee_type),
      contractType: toStr(row.contract_type),
      farmCode: toStr(row.farm_code),
      associatedWorkerName: toStr(row.associated_worker_name),
      email: toStr(row.email),
      phoneNumber: toStr(row.phone_number),
      address: toStr(row.address),
      city: toStr(row.city),
      parish: toStr(row.parish),
      nationality: toStr(row.nationality),
      educationTitle: toStr(row.education_title),
      jobClassificationCode: toStr(row.job_classification_code),
      childrenCount: toNum(row.children_count),
      dependentsCount: toNum(row.dependents_count),
      lastEntryDate: toIsoDate(row.last_entry_date),
      lastExitDate: toIsoDate(row.last_exit_date),
      employerName: toStr(row.employer_name),
      performancePayApplicable: row.performance_pay_applicable,
      disabledFlag: row.disabled_flag,
    };
  });
}
