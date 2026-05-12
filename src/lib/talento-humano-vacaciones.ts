import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, matchesMultiSelectValue } from "@/lib/multi-select";
import { formatTenureLabel } from "@/lib/talento-humano-colaboradores-utils";

type DbDate = string | Date | null;

export type VacationSimulatorFilters = {
  corteDate: string;
  area: string;
  jobClassification: string;
  associatedWorker: string;
  q: string;
};

export type VacationSimulatorRow = {
  personId: string;
  personName: string;
  nationalId: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  jobTitle: string | null;
  jobClassificationCode: string | null;
  contractType: string | null;
  associatedWorkerName: string | null;
  entryDate: string | null;
  tenureDays: number;
  tenureLabel: string | null;
  diasAcumulados: number;
  diasTomados: number;
  diasDisponibles: number;
};

export type VacationSimulatorOptionEntry = { id: string; name: string };

export type VacationSimulatorOptions = {
  areas: VacationSimulatorOptionEntry[];
  jobClassifications: string[];
  associatedWorkers: string[];
};

export type VacationSimulatorAreaSummary = {
  areaId: string;
  areaName: string;
  total: number;
  disponibles: number;
};

export type VacationSimulatorClassificationSummary = {
  label: string;
  total: number;
  disponibles: number;
};

export type VacationSimulatorSummary = {
  totalCollaborators: number;
  totalAcumulados: number;
  totalTomados: number;
  totalDisponibles: number;
  byArea: VacationSimulatorAreaSummary[];
  byJobClassification: VacationSimulatorClassificationSummary[];
};

export type VacationSimulatorData = {
  generatedAt: string;
  corteDate: string;
  filters: VacationSimulatorFilters;
  options: VacationSimulatorOptions;
  summary: VacationSimulatorSummary;
  rows: VacationSimulatorRow[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text && text !== "UNKNOWN" ? text : null;
}

function toDate(value: DbDate): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
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

export function normalizeVacationFilters(
  raw: Record<string, string | undefined | null> = {},
): VacationSimulatorFilters {
  const today = new Date().toISOString().slice(0, 10);
  const rawCorte = (raw.corteDate ?? "").trim();
  const corteDate = ISO_DATE.test(rawCorte) ? rawCorte : today;
  return {
    corteDate,
    area: normalizeMulti(raw.area ?? null),
    jobClassification: normalizeMulti(raw.jobClassification ?? null),
    associatedWorker: normalizeMulti(raw.associatedWorker ?? null),
    q: (raw.q ?? "").trim(),
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
  contract_type: string | null;
  associated_worker_name: string | null;
  entry_date: string | null;
  tenure_days: number | string | null;
  dias_tomados: number | string | null;
};

async function loadVacationRows(corteDate: string): Promise<VacationSimulatorRow[]> {
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
        person_id, person_name, national_id, job_title, employee_type,
        contract_type, job_classification_code, associated_worker_name, last_entry_date
      FROM slv.tthh_dim_person_profile_scd2
      WHERE is_current = true AND is_valid = true
      ORDER BY person_id, valid_from DESC NULLS LAST
    ),
    vacation AS (
      SELECT person_id, last_entry_date AS mv_last_entry_date, vacation_days_taken
      FROM gld.mv_tthh_vacation_cur
    )
    SELECT
      ap.person_id,
      COALESCE(p.person_name, ap.person_id) AS person_name,
      p.national_id,
      ap.area_id,
      ar.area_name,
      ar.area_general,
      p.job_title,
      p.job_classification_code,
      p.contract_type,
      p.associated_worker_name,
      to_char(COALESCE(p.last_entry_date, v.mv_last_entry_date), 'YYYY-MM-DD') AS entry_date,
      GREATEST(
        0,
        ($1::date - COALESCE(p.last_entry_date, v.mv_last_entry_date)::date)
      )::int AS tenure_days,
      COALESCE(v.vacation_days_taken, 0)::numeric AS dias_tomados
    FROM active_persons ap
    LEFT JOIN profiles p ON p.person_id = ap.person_id
    LEFT JOIN slv.camp_dim_area_profile_scd2 ar
      ON ar.area_id = ap.area_id AND ar.is_current = true AND ar.is_valid = true
    LEFT JOIN vacation v ON v.person_id = ap.person_id
    WHERE COALESCE(p.last_entry_date, v.mv_last_entry_date) IS NOT NULL
      AND COALESCE(UPPER(p.contract_type), '') NOT LIKE '%SERVICIOS PRESTADOS%'
    ORDER BY COALESCE(p.person_name, ap.person_id)
    `,
    [corteDate],
  );

  return result.rows.map((row) => {
    const tenureDays = Math.max(0, Math.floor(toNumber(row.tenure_days)));
    const diasAcumulados = Math.floor((tenureDays / 30) * 1.25);
    const diasTomados = toNumber(row.dias_tomados);
    const diasDisponibles = diasAcumulados - diasTomados;
    return {
      personId: row.person_id,
      personName: toText(row.person_name) ?? row.person_id,
      nationalId: toText(row.national_id),
      areaId: toText(row.area_id),
      areaName: toText(row.area_name),
      areaGeneral: toText(row.area_general),
      jobTitle: toText(row.job_title),
      jobClassificationCode: toText(row.job_classification_code),
      contractType: toText(row.contract_type),
      associatedWorkerName: toText(row.associated_worker_name),
      entryDate: toDate(row.entry_date),
      tenureDays,
      tenureLabel: formatTenureLabel(tenureDays),
      diasAcumulados,
      diasTomados,
      diasDisponibles,
    };
  });
}

function searchTokens(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean).slice(0, 6).map((token) => token.toLocaleLowerCase("es-EC"));
}

function rowMatchesSearch(row: VacationSimulatorRow, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = [row.personId, row.personName, row.nationalId, row.areaId, row.areaName]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLocaleLowerCase("es-EC"))
    .join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function rowMatchesArea(row: VacationSimulatorRow, encoded: string): boolean {
  if (!encoded || encoded === "all") return true;
  const selected = decodeMultiSelectValue(encoded);
  if (selected.length === 0) return true;
  const candidates = [row.areaId, row.areaName, row.areaGeneral].filter((part): part is string => Boolean(part));
  return candidates.some((candidate) => selected.includes(candidate));
}

function buildOptions(rows: VacationSimulatorRow[]): VacationSimulatorOptions {
  const areasMap = new Map<string, string>();
  const classifications = new Set<string>();
  const associatedWorkers = new Set<string>();
  for (const row of rows) {
    if (row.areaId) {
      areasMap.set(row.areaId, row.areaName ?? row.areaId);
    }
    if (row.jobClassificationCode) classifications.add(row.jobClassificationCode);
    if (row.associatedWorkerName) associatedWorkers.add(row.associatedWorkerName);
  }
  return {
    areas: Array.from(areasMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es-EC")),
    jobClassifications: Array.from(classifications).sort((a, b) => a.localeCompare(b, "es-EC")),
    associatedWorkers: Array.from(associatedWorkers).sort((a, b) => a.localeCompare(b, "es-EC")),
  };
}

function buildSummary(rows: VacationSimulatorRow[]): VacationSimulatorSummary {
  let totalAcumulados = 0;
  let totalTomados = 0;
  let totalDisponibles = 0;

  const areaMap = new Map<string, VacationSimulatorAreaSummary>();
  const classificationMap = new Map<string, VacationSimulatorClassificationSummary>();

  for (const row of rows) {
    totalAcumulados += row.diasAcumulados;
    totalTomados += row.diasTomados;
    totalDisponibles += row.diasDisponibles;

    const areaKey = row.areaId ?? "__sin_area__";
    const areaName = row.areaName ?? row.areaId ?? "Sin área";
    const areaEntry = areaMap.get(areaKey) ?? {
      areaId: areaKey,
      areaName,
      total: 0,
      disponibles: 0,
    };
    areaEntry.total += 1;
    areaEntry.disponibles += row.diasDisponibles;
    areaMap.set(areaKey, areaEntry);

    const clasifKey = row.jobClassificationCode ?? "Sin clasificación";
    const clasifEntry = classificationMap.get(clasifKey) ?? {
      label: clasifKey,
      total: 0,
      disponibles: 0,
    };
    clasifEntry.total += 1;
    clasifEntry.disponibles += row.diasDisponibles;
    classificationMap.set(clasifKey, clasifEntry);
  }

  return {
    totalCollaborators: rows.length,
    totalAcumulados,
    totalTomados,
    totalDisponibles,
    byArea: Array.from(areaMap.values()).sort((a, b) => b.disponibles - a.disponibles),
    byJobClassification: Array.from(classificationMap.values()).sort(
      (a, b) => b.disponibles - a.disponibles,
    ),
  };
}

export async function getVacationSimulatorData(
  filters: VacationSimulatorFilters,
): Promise<VacationSimulatorData> {
  const normalized = normalizeVacationFilters({
    corteDate: filters.corteDate,
    area: filters.area,
    jobClassification: filters.jobClassification,
    associatedWorker: filters.associatedWorker,
    q: filters.q,
  });

  const rawRows = await loadVacationRows(normalized.corteDate);
  // Filtro canon: excluye personas con >400 días de antigüedad y 0 días
  // tomados — heurística de calidad de datos (alta antigüedad sin vacaciones
  // registradas suele indicar ausencia de histórico en la MV, no realidad).
  const allRows = rawRows.filter(
    (row) => !(row.tenureDays > 400 && row.diasTomados === 0),
  );
  const options = buildOptions(allRows);

  const tokens = searchTokens(normalized.q);
  const filteredRows = allRows.filter((row) =>
    rowMatchesArea(row, normalized.area)
      && matchesMultiSelectValue(normalized.jobClassification, row.jobClassificationCode)
      && matchesMultiSelectValue(normalized.associatedWorker, row.associatedWorkerName)
      && rowMatchesSearch(row, tokens),
  );

  return {
    generatedAt: new Date().toISOString(),
    corteDate: normalized.corteDate,
    filters: normalized,
    options,
    summary: buildSummary(filteredRows),
    rows: filteredRows,
  };
}
