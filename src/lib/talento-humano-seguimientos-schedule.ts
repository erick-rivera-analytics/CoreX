import { query } from "@/lib/db";
import { queryHumanTalent } from "@/lib/human-talent-db";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { deriveFollowupRoute } from "@/lib/talento-humano-seguimientos-person";
import type {
  EmployeeFollowupFilters,
  EmployeeFollowupStatus,
  EmployeeScheduledFollowupRow,
  ScheduledFollowupQueryRow,
} from "@/modules/talento-humano/seguimientos/server/types";

type ScheduledFollowupDwRow = ScheduledFollowupQueryRow & {
  person_name: string;
  associated_worker_name: string | null;
  job_classification_code: string | null;
  area_name: string | null;
  area_general: string | null;
};

type ResponseStatusRow = {
  unique_follow_up_code: string;
  person_id: string;
  event_id: string;
  is_valid: boolean;
};

type FollowupDateOptionsRow = {
  years: string[] | null;
  months: string[] | null;
};

export async function loadFollowupDateOptions(): Promise<{ years: string[]; months: string[] }> {
  const result = await query<FollowupDateOptionsRow>(`
    WITH date_parts AS (
      SELECT DISTINCT
        EXTRACT(YEAR FROM f.follow_up_date::date)::int AS followup_year,
        EXTRACT(MONTH FROM f.follow_up_date::date)::int AS followup_month
      FROM gld.mv_tthh_asgn_followup_scd2 f
      WHERE f.follow_up_date IS NOT NULL
        AND EXTRACT(YEAR FROM f.follow_up_date::date)::int <= EXTRACT(YEAR FROM CURRENT_DATE)::int
    )
    SELECT
      (
        SELECT ARRAY_AGG(followup_year::text ORDER BY followup_year DESC)
        FROM (SELECT DISTINCT followup_year FROM date_parts) years
      ) AS years,
      (
        SELECT ARRAY_AGG(followup_month::text ORDER BY followup_month ASC)
        FROM (SELECT DISTINCT followup_month FROM date_parts) months
      ) AS months
  `);

  return {
    years: result.rows[0]?.years ?? [],
    months: result.rows[0]?.months ?? [],
  };
}

/**
 * Construye el conjunto de seguimientos programados desde el DW y
 * mezcla el estado (pending/registered) consultando db_human_talent.
 *
 * Arquitectura: DW y db_human_talent son clusters separados → composición en API.
 */
export async function loadScheduledFollowups(
  filters: EmployeeFollowupFilters,
): Promise<EmployeeScheduledFollowupRow[]> {
  const asOfDate = filters.asOfDate || new Date().toISOString().slice(0, 10);

  // ── 1. DW: seguimientos programados + perfil + área PIT ──────────────────
  const params: unknown[] = [asOfDate];
  const conditions: string[] = [];
  let pIdx = 2;

  if (filters.personSearch?.trim()) {
    const pattern = `%${filters.personSearch.trim().replace(/[%_]/g, "\\$&")}%`;
    conditions.push(`(p.person_id ILIKE $${pIdx} OR p.person_name ILIKE $${pIdx})`);
    params.push(pattern);
    pIdx++;
  }

  if (filters.associatedWorker?.trim()) {
    conditions.push(`p.associated_worker_name = $${pIdx}`);
    params.push(filters.associatedWorker.trim());
    pIdx++;
  }

  if (filters.uniqueFollowUpCode?.trim()) {
    conditions.push(`f.unique_follow_up_code = $${pIdx}`);
    params.push(filters.uniqueFollowUpCode.trim());
    pIdx++;
  }

  const years = decodeMultiSelectValue(filters.year);
  if (years.length > 0) {
    conditions.push(`EXTRACT(YEAR FROM f.follow_up_date::date)::int::text = ANY($${pIdx}::text[])`);
    params.push(years);
    pIdx++;
  }

  const months = decodeMultiSelectValue(filters.month);
  if (months.length > 0) {
    conditions.push(`EXTRACT(MONTH FROM f.follow_up_date::date)::int::text = ANY($${pIdx}::text[])`);
    params.push(months);
    pIdx++;
  }

  if (filters.dateFrom) {
    conditions.push(`f.follow_up_date::date >= $${pIdx}::date`);
    params.push(filters.dateFrom);
    pIdx++;
  }

  if (filters.dateTo) {
    conditions.push(`f.follow_up_date::date <= $${pIdx}::date`);
    params.push(filters.dateTo);
    pIdx++;
  }

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

  const dwResult = await query<ScheduledFollowupDwRow>(
    `
    SELECT
      f.person_id,
      f.follow_up_type,
      f.follow_up_code,
      f.follow_up_date::text AS follow_up_date,
      f.unique_follow_up_code,
      p.person_name,
      p.associated_worker_name,
      p.job_classification_code,
      a.area_name,
      a.area_general
    FROM gld.mv_tthh_asgn_followup_scd2 f
    JOIN slv.tthh_dim_person_profile_scd2 p
      ON p.person_id = f.person_id
      AND p.is_current = true
      AND p.is_valid = true
    LEFT JOIN LATERAL (
      SELECT ap.area_name, ap.area_general
      FROM slv.tthh_asgn_person_area_event_scd2 e
      LEFT JOIN slv.camp_dim_area_profile_scd2 ap
        ON ap.area_id = e.area_id AND ap.is_current = true AND ap.is_valid = true
      WHERE e.person_id = f.person_id
        AND e.event_type = 'CA'
        AND e.is_valid = true
        AND $1::date >= e.valid_from::date
        AND $1::date < COALESCE(e.valid_to::date, DATE '9999-12-31')
      ORDER BY e.valid_from DESC
      LIMIT 1
    ) a ON true
    WHERE 1 = 1
    ${whereClause}
    ORDER BY f.follow_up_date DESC, p.person_name
    LIMIT 500
    `,
    params,
  );

  if (dwResult.rows.length === 0) return [];

  // ── 2. db_human_talent: estado de respuestas latest valid ─────────────────
  const statusParams: unknown[] = [];
  const keyTuples = dwResult.rows
    .map((row) => {
      statusParams.push(row.unique_follow_up_code, row.person_id);
      const base = statusParams.length - 1;
      return `($${base}, $${base + 1})`;
    })
    .join(",");

  const statusMap = new Map<string, ResponseStatusRow>();

  try {
    const pool = getHumanTalentPool();
    if (pool) {
      const statusResult = await queryHumanTalent<ResponseStatusRow>(
        `
        SELECT DISTINCT ON (unique_follow_up_code, person_id)
          unique_follow_up_code,
          person_id,
          event_id,
          is_valid
        FROM public.tthh_fact_employee_followup_response_cur
        WHERE is_latest_valid_version = true
          AND is_valid = true
          AND (unique_follow_up_code, person_id) IN (${keyTuples})
        ORDER BY unique_follow_up_code, person_id, response_version DESC
        `,
        statusParams,
      );
      for (const row of statusResult.rows) {
        statusMap.set(`${row.unique_follow_up_code}::${row.person_id}`, row);
      }
    }
  } catch {
    // db_human_talent puede no estar disponible; status queda pending
  }

  // ── 3. Merge y derivación de ruta/estado ─────────────────────────────────
  return dwResult.rows
    .map((row) => {
      const derivedRoute = deriveFollowupRoute(row.follow_up_type, row.job_classification_code);

      // Filtrar por ruta si se especificó (string vacío o undefined = sin filtro)
      const routeFilter = filters.route;
      if (routeFilter && derivedRoute !== routeFilter) {
        return null;
      }

      const statusRow = statusMap.get(`${row.unique_follow_up_code}::${row.person_id}`);
      let status: EmployeeFollowupStatus = "pending";
      if (statusRow) status = "registered";

      // Filtrar por status
      if (filters.status && filters.status !== "all" && status !== filters.status) {
        return null;
      }

      return {
        personId: row.person_id,
        personName: row.person_name,
        followUpType: row.follow_up_type,
        followUpCode: row.follow_up_code,
        uniqueFollowUpCode: row.unique_follow_up_code,
        followUpDate: row.follow_up_date,
        associatedWorkerName: row.associated_worker_name,
        areaName: row.area_name,
        areaGeneral: row.area_general,
        jobClassificationCode: row.job_classification_code,
        derivedRoute,
        status,
        responseEventId: statusRow?.event_id ?? null,
      } satisfies EmployeeScheduledFollowupRow;
    })
    .filter((row): row is EmployeeScheduledFollowupRow => row !== null);
}

// Pool helper (importado dinámicamente para evitar circular)
function getHumanTalentPool() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getHumanTalentPool: get } = require("@/lib/human-talent-db") as {
      getHumanTalentPool: () => import("pg").Pool | null;
    };
    return get();
  } catch {
    return null;
  }
}
