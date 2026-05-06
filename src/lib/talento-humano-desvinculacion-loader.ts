import "server-only";

import { query } from "@/lib/db";
import { matchesMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import type {
  TalentoExitData,
  TalentoExitFilters,
  TalentoExitFilterOptions,
  TalentoExitRecord,
} from "@/lib/talento-humano";

const TALENTO_EXIT_TTL_MS = 60 * 1000;
const EXIT_SOURCE = "gld.mv_tthh_exit_rend_abs_cur";

type DateValue = string | Date | null;

type ExitQueryRow = {
  person_id: string;
  national_id: string | null;
  person_name: string | null;
  last_exit_date: DateValue;
  n_entry: string | number | null;
  entry_date: DateValue;
  exit_date: DateValue;
  active_days: string | number | null;
  active_months: string | number | null;
  exit_reason: string | null;
  resignation_reason: string | null;
  resignation_category: string | null;
  resignation_classification: string | null;
  rend: string | number | null;
  rend_min: string | number | null;
  cumpl: string | number | null;
  pct_actual_hours_rend: string | number | null;
  pct_actual_hours_hn: string | number | null;
  pct_abs_total: string | number | null;
  associated_worker_name: string | null;
  observations: string | null;
};

type YearMonthRow = {
  year: string | null;
  month: string | null;
};

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" || text === "UNKNOWN" ? null : text;
}

function toIsoDate(value: DateValue): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return text.includes("T") ? text.slice(0, 10) : text;
}

function complianceBucket(value: number | null) {
  if (value === null) return "Sin dato";
  if (value > 1) return "> 100%";
  if (value >= 0.9) return "90% - 100%";
  return "< 90%";
}

function tenureBucket(days: number | null) {
  if (days === null) return "Sin dato";
  if (days <= 30) return "1 - 30 dias";
  if (days <= 90) return "31 - 90 dias";
  if (days <= 180) return "91 - 180 dias";
  if (days <= 360) return "181 - 360 dias";
  return "> 360 dias";
}

function mapExitRow(row: ExitQueryRow): TalentoExitRecord {
  const activeDays = toNum(row.active_days);
  const cumplimiento = toNum(row.cumpl);

  return {
    personId: row.person_id,
    personName: toStr(row.person_name) ?? row.person_id,
    areaId: "-",
    areaName: "-",
    areaGeneral: "-",
    gender: null,
    maritalStatus: null,
    birthPlace: null,
    jobTitle: null,
    employeeType: null,
    contractType: null,
    associatedWorkerName: toStr(row.associated_worker_name),
    jobClassificationCode: null,
    employerName: null,
    address: null,
    city: null,
    parish: null,
    birthDate: null,
    lastEntryDate: toIsoDate(row.entry_date),
    farmCode: null,
    nationality: null,
    educationTitle: null,
    childrenCount: null,
    dependentsCount: null,
    entryCount: toNum(row.n_entry),
    performancePayApplicable: null,
    disabledFlag: null,
    nationalId: toStr(row.national_id),
    lastExitDate: toIsoDate(row.last_exit_date),
    entryDate: toIsoDate(row.entry_date),
    exitDate: toIsoDate(row.exit_date),
    activeDays,
    activeMonths: toNum(row.active_months),
    exitReason: toStr(row.exit_reason),
    resignationReason: toStr(row.resignation_reason),
    resignationCategory: toStr(row.resignation_category),
    resignationClassification: toStr(row.resignation_classification),
    rendimiento: toNum(row.rend),
    rendimientoMin: toNum(row.rend_min),
    cumplimiento,
    pctActualHoursRend: toNum(row.pct_actual_hours_rend),
    pctActualHoursHn: toNum(row.pct_actual_hours_hn),
    pctAbsTotal: toNum(row.pct_abs_total),
    observations: toStr(row.observations),
    complianceBucket: complianceBucket(cumplimiento),
    tenureBucket: tenureBucket(activeDays),
  };
}

function uniq(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .map(String)
    .sort((left, right) => left.localeCompare(right, "es-EC"));
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function matchesFilters(row: TalentoExitRecord, filters: TalentoExitFilters) {
  return (
    matchesMultiSelectValue(filters.associatedWorker, row.associatedWorkerName ?? "Sin dato")
    && matchesMultiSelectValue(filters.exitReason, row.exitReason ?? "Sin dato")
    && matchesMultiSelectValue(filters.resignationReason, row.resignationReason ?? "Sin dato")
    && matchesMultiSelectValue(filters.resignationCategory, row.resignationCategory ?? "Sin dato")
    && matchesMultiSelectValue(filters.resignationClassification, row.resignationClassification ?? "Sin dato")
    && matchesMultiSelectValue(filters.complianceBucket, row.complianceBucket)
    && matchesMultiSelectValue(filters.tenureBucket, row.tenureBucket)
  );
}

function buildOptions(rows: TalentoExitRecord[], yearMonths: YearMonthRow[]): TalentoExitFilterOptions {
  return {
    years: uniq(yearMonths.map((row) => row.year)),
    months: uniq(yearMonths.map((row) => row.month)),
    associatedWorkers: uniq(rows.map((row) => row.associatedWorkerName ?? "Sin dato")),
    exitReasons: uniq(rows.map((row) => row.exitReason ?? "Sin dato")),
    resignationReasons: uniq(rows.map((row) => row.resignationReason ?? "Sin dato")),
    resignationCategories: uniq(rows.map((row) => row.resignationCategory ?? "Sin dato")),
    resignationClassifications: uniq(rows.map((row) => row.resignationClassification ?? "Sin dato")),
    complianceBuckets: ["> 100%", "90% - 100%", "< 90%", "Sin dato"],
    tenureBuckets: ["1 - 30 dias", "31 - 90 dias", "91 - 180 dias", "181 - 360 dias", "> 360 dias", "Sin dato"],
  };
}

function buildSourceQuery(filters: TalentoExitFilters) {
  const values: unknown[] = [];
  const wheres: string[] = [];

  if (filters.year !== "all") {
    values.push(filters.year);
    wheres.push(`EXTRACT(YEAR FROM last_exit_date)::text = $${values.length}`);
  }

  if (filters.month !== "all") {
    values.push(filters.month);
    wheres.push(`EXTRACT(MONTH FROM last_exit_date)::int::text = $${values.length}`);
  }

  const whereClause = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";

  return {
    values,
    text: `
      SELECT
        person_id, national_id, person_name,
        to_char(last_exit_date, 'YYYY-MM-DD') AS last_exit_date,
        n_entry,
        to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
        to_char(exit_date, 'YYYY-MM-DD') AS exit_date,
        active_days, active_months,
        exit_reason, resignation_reason, resignation_category, resignation_classification,
        rend, rend_min, cumpl, pct_actual_hours_rend, pct_actual_hours_hn, pct_abs_total,
        associated_worker_name, observations
      FROM ${EXIT_SOURCE}
      ${whereClause}
      ORDER BY last_exit_date DESC NULLS LAST, person_name
    `,
  };
}

export async function getDesvinculacionData(filters: TalentoExitFilters): Promise<TalentoExitData> {
  const cacheKey = `talento:desvinculacion:v1:${JSON.stringify(filters)}`;
  return cachedAsync(cacheKey, TALENTO_EXIT_TTL_MS, async () => {
    const sourceQuery = buildSourceQuery(filters);
    const [sourceResult, yearMonthResult] = await Promise.all([
      query<ExitQueryRow>(sourceQuery.text, sourceQuery.values),
      query<YearMonthRow>(
        `SELECT DISTINCT
           EXTRACT(YEAR FROM last_exit_date)::int::text AS year,
           EXTRACT(MONTH FROM last_exit_date)::int::text AS month
         FROM ${EXIT_SOURCE}
         WHERE last_exit_date IS NOT NULL
         ORDER BY year DESC, month DESC`,
      ),
    ]);

    const baseRows = sourceResult.rows.map(mapExitRow);
    const rows = baseRows.filter((row) => matchesFilters(row, filters));
    const rowsWithReason = rows.filter((row) => row.exitReason || row.resignationReason || row.resignationCategory);
    const categories = new Set(rows.map((row) => row.resignationCategory).filter(Boolean));
    const socialWorkers = new Set(rows.map((row) => row.associatedWorkerName).filter(Boolean));

    return {
      generatedAt: new Date().toISOString(),
      filters,
      options: buildOptions(baseRows, yearMonthResult.rows),
      rows,
      summary: {
        totalExits: rows.length,
        exitsWithReason: rowsWithReason.length,
        categoriesDetected: categories.size,
        socialWorkers: socialWorkers.size,
        avgCompliance: average(rows.map((row) => row.cumplimiento)),
        avgRendimiento: average(rows.map((row) => row.rendimiento)),
        avgRendimientoMin: average(rows.map((row) => row.rendimientoMin)),
        avgPctActualHoursRend: average(rows.map((row) => row.pctActualHoursRend)),
        avgPctActualHoursHn: average(rows.map((row) => row.pctActualHoursHn)),
        avgPctAbsTotal: average(rows.map((row) => row.pctAbsTotal)),
        avgActiveMonths: average(rows.map((row) => row.activeMonths)),
      },
    };
  });
}
