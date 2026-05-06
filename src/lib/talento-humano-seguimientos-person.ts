import { query } from "@/lib/db";
import type {
  EmployeeFollowupPersonDetail,
  EmployeeFollowupPersonSearchResult,
  PersonProfileQueryRow,
} from "@/modules/talento-humano/seguimientos/server/types";

// ─────────────────────────────────────────────────────────────────────────────
// Derivación de ruta AGR/ADM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derivar ruta AGR/ADM desde el job_classification_code del DW.
 * AGRICOLA → AGR, ADMINISTRATIVO → ADM, fallback → AGR.
 */
export function deriveFollowupRoute(
  followUpType: string | null | undefined,
  jobClassificationCode: string | null | undefined,
): "AGR" | "ADM" {
  // Si el tipo del seguimiento lo indica explícitamente
  if (followUpType) {
    const t = followUpType.toUpperCase();
    if (t.includes("ADM") || t === "ADMINISTRATIVO") return "ADM";
    if (t.includes("AGR") || t === "AGRICOLA") return "AGR";
  }
  // Fallback a clasificación del perfil
  if (jobClassificationCode) {
    const c = jobClassificationCode.toUpperCase();
    if (c === "ADMINISTRATIVO") return "ADM";
    if (c === "AGRICOLA") return "AGR";
  }
  return "AGR";
}

// ─────────────────────────────────────────────────────────────────────────────
// Búsqueda de personas
// ─────────────────────────────────────────────────────────────────────────────

export async function searchPersons(
  q: string,
  asOfDate: string,
  limit = 20,
): Promise<EmployeeFollowupPersonSearchResult[]> {
  const searchTokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const searchConditions = searchTokens.map((_, index) => (
    `(p.person_id ILIKE $${index + 2} ESCAPE '\\' OR p.person_name ILIKE $${index + 2} ESCAPE '\\')`
  ));
  const searchParams = searchTokens.map((token) => `%${token.replace(/[%_\\]/g, "\\$&")}%`);

  const result = await query<
    PersonProfileQueryRow & { area_name: string | null; area_general: string | null }
  >(
    `
    SELECT
      p.person_id,
      p.person_name,
      p.gender,
      p.job_title,
      p.job_classification_code,
      p.associated_worker_name,
      to_char(p.last_entry_date, 'YYYY-MM-DD') AS last_entry_date,
      a.area_name,
      a.area_general
    FROM slv.tthh_dim_person_profile_scd2 p
    LEFT JOIN LATERAL (
      SELECT ca.area_name, ca.area_general
      FROM (
        SELECT DISTINCT ON (e.person_id)
          e.person_id,
          ap.area_name,
          ap.area_general
        FROM slv.tthh_asgn_person_area_event_scd2 e
        LEFT JOIN slv.camp_dim_area_profile_scd2 ap
          ON ap.area_id = e.area_id AND ap.is_current = true AND ap.is_valid = true
        WHERE e.person_id = p.person_id
          AND e.is_current = true
          AND e.event_type = 'IS'
          AND e.is_valid = true
          AND e.area_id NOT IN ('UNKNOWN')
          AND $1::date >= e.valid_from::date
          AND $1::date < COALESCE(e.valid_to::date, DATE '9999-12-31')
        ORDER BY e.person_id, e.valid_from DESC
      ) ca
    ) a ON true
    WHERE p.is_current = true
      AND p.is_valid = true
      AND ${searchConditions.join(" AND ")}
    ORDER BY p.person_name
    LIMIT $${searchParams.length + 2}
    `,
    [asOfDate, ...searchParams, limit],
  );

  return result.rows.map((row) => ({
    personId: row.person_id,
    personName: row.person_name,
    gender: row.gender,
    jobTitle: row.job_title,
    jobClassificationCode: row.job_classification_code,
    associatedWorkerName: row.associated_worker_name,
    lastEntryDate: row.last_entry_date,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Ficha completa de persona
// ─────────────────────────────────────────────────────────────────────────────

export async function getPersonDetail(
  personId: string,
  asOfDate: string,
): Promise<EmployeeFollowupPersonDetail | null> {
  const result = await query<
    PersonProfileQueryRow & { area_id: string | null; area_name: string | null; area_general: string | null }
  >(
    `
    SELECT
      p.person_id,
      p.person_name,
      p.gender,
      p.marital_status,
      p.city,
      p.job_title,
      p.employer_name,
      p.job_classification_code,
      p.associated_worker_name,
      to_char(p.last_entry_date, 'YYYY-MM-DD') AS last_entry_date,
      a.area_id,
      a.area_name,
      a.area_general
    FROM slv.tthh_dim_person_profile_scd2 p
    LEFT JOIN LATERAL (
      SELECT e.area_id, ap.area_name, ap.area_general
      FROM slv.tthh_asgn_person_area_event_scd2 e
      LEFT JOIN slv.camp_dim_area_profile_scd2 ap
        ON ap.area_id = e.area_id AND ap.is_current = true AND ap.is_valid = true
      WHERE e.person_id = p.person_id
        AND e.is_current = true
        AND e.event_type = 'IS'
        AND e.is_valid = true
        AND e.area_id NOT IN ('UNKNOWN')
        AND $1::date >= e.valid_from::date
        AND $1::date < COALESCE(e.valid_to::date, DATE '9999-12-31')
      ORDER BY e.valid_from DESC
      LIMIT 1
    ) a ON true
    WHERE p.person_id = $2
      AND p.is_current = true
      AND p.is_valid = true
    LIMIT 1
    `,
    [asOfDate, personId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    personId: row.person_id,
    personName: row.person_name,
    gender: row.gender,
    maritalStatus: row.marital_status,
    city: row.city,
    jobTitle: row.job_title,
    jobClassificationCode: row.job_classification_code,
    associatedWorkerName: row.associated_worker_name,
    lastEntryDate: row.last_entry_date,
    employerName: row.employer_name,
    areaId: (row as { area_id: string | null }).area_id,
    areaName: (row as { area_name: string | null }).area_name,
    areaGeneral: (row as { area_general: string | null }).area_general,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista de trabajadoras sociales activas
// ─────────────────────────────────────────────────────────────────────────────

export async function loadAssociatedWorkers(): Promise<string[]> {
  const result = await query<{ associated_worker_name: string }>(
    `
    SELECT DISTINCT associated_worker_name
    FROM slv.tthh_dim_person_profile_scd2
    WHERE is_current = true
      AND is_valid = true
      AND associated_worker_name IS NOT NULL
    ORDER BY associated_worker_name
    `,
  );

  return result.rows.map((r) => r.associated_worker_name);
}

export async function loadAreaOptions(): Promise<string[]> {
  const result = await query<{ area_id: string }>(
    `
    SELECT DISTINCT e.area_id::text AS area_id
    FROM slv.tthh_asgn_person_area_event_scd2 e
    WHERE e.is_current = true
      AND e.event_type = 'IS'
      AND e.is_valid = true
      AND e.area_id IS NOT NULL
      AND e.area_id NOT IN ('UNKNOWN')
    ORDER BY e.area_id::text
    `,
  );

  return result.rows.map((r) => r.area_id);
}
