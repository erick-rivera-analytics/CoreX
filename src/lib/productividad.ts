import "server-only";

import { loadBoxesPerBedTargetIndex, type BoxesPerBedTargetIndex } from "@/lib/admin-masters-goals";
import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue, matchesMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { normalizeAreaDisplayName } from "@/shared/lib/area-normalization";
import { parseDateOnly } from "@/shared/lib/format";
import { roundValue, toNumber } from "@/shared/lib/number-utils";

// ── Fuente de datos ──────────────────────────────────────────────────────────
const PROD_HOURS_SOURCE      = "gld.mv_prod_hours_cycle_person_cur";
const KARDEX_CYCLE_SOURCE    = "gld.mv_camp_kardex_cycle_plants_cur";
const FENOGRAMA_SOURCE       = "gld.mv_prod_fenograma_cur";               // stems_count
const PRODUCTIVITY_POST_SRC  = "gld.mv_prod_productivity_post_cur";      // post_weight_kg
const PRODUCTIVITY_GREEN_SRC = "gld.mv_prod_productivity_green_cur";     // green_weight_kg → cajas
const CYCLE_PROFILE_SOURCE   = "slv.camp_dim_cycle_profile_scd2";
const CALENDAR_SOURCE        = "slv.common_dim_calendar_date_scd0";      // iso_week por fecha

// ── TTL ──────────────────────────────────────────────────────────────────────
const PRODUCTIVIDAD_TTL_MS = 60 * 1000;

// ── Mapeo de origen DW → meta (boxes_per_bed) ───────────────────────────────
// El verde DW guarda labels en español MAYÚSCULAS, las metas en inglés minúsculas.
const ORIGIN_DW_TO_META: Record<string, string> = {
  APERTURA: "opening",
  GV: "gv",
  PRECLASIFICACION: "preclassification",
};

function resolveMetaOriginCode(variety: string, originCode: string): string | null {
  const normalizedVariety = variety.trim().toUpperCase();
  if (normalizedVariety !== "CLO") return originCode;

  // Corrección negocio: CLO no existe como GV ni Preclasificación. Los valores
  // cargados originalmente como preclassification son la meta real de Apertura.
  if (originCode === "preclassification") return "opening";
  if (originCode === "gv") return null;
  return originCode;
}

// ── Query row types (snake_case, DB output) ──────────────────────────────────
type ProductividadQueryRow = {
  cycle_key: string;
  block: string | null;
  area: string | null;
  variety: string | null;
  sp_type: string | null;
  sp_date: string | Date | null;
  harvest_start_date: string | Date | null;
  harvest_end_date: string | Date | null;
  harvest_year: number | string | null;
  harvest_month: number | string | null;
  cost_area: string | null;
  sub_cost_center: string | null;
  activity_type: string | null;
  activity_name: string | null;
  effective_hours: number | string | null;
  units_produced: number | string | null;
  bed_area: number | string | null;
  green_weight_kg: number | string | null;
  green_origin_kg_jsonb: Record<string, number | string | null> | null;
  iso_week: number | string | null;
  total_stems: number | string | null;
  plants_current: number | string | null;
  initial_plants_cycle: number | string | null;
  reseed_plants_count: number | string | null;
  dead_plants_count: number | string | null;
  post_weight_kg: number | string | null;
  pct_mortality: number | string | null;
};

// ── Public types ─────────────────────────────────────────────────────────────
export type ProductividadFilters = {
  year: string;
  month: string;
  spType: string;
  variety: string;
  area: string;
  block: string;
  status: string;
};

export type ProductividadRow = {
  cycleKey: string;
  block: string;
  area: string;
  variety: string;
  spType: string;
  spDate: string | null;
  harvestStartDate: string | null;
  harvestEndDate: string | null;
  harvestYear: number | null;
  harvestMonth: number | null;
  costArea: string;
  etapaLabel: string;
  subCostCenter: string;
  activityType: string;
  activityName: string;
  cycleStatus: "Planificado" | "Abierto" | "Cerrado";
  pctMortality: number | null;
  effectiveHours: number | null;
  unitsProduced: number | null;
  bedArea: number | null;
  greenWeightKg: number | null;
  cajas: number | null;
  camas30: number | null;
  totalStems: number | null;
  plantsCurrentOrInitial: number | null;
  initialPlantsCycle: number | null;
  reseedPlantsCycle: number | null;
  deadPlantsCycle: number | null;
  postWeightKg: number | null;
  isoWeek: number | null;
  // Calculated metrics
  horaCaja: number | null;
  cajaCama: number | null;
  horaCama: number | null;
  tallosPlanta: number | null;
  pesoTalloGramos: number | null;
  cajaCamaMeta: number | null;
  cumplimiento: number | null; // ratio 0..1+ (cajaCama / cajaCamaMeta)
};

export type ProductividadFilterOptions = {
  years: string[];
  months: string[];
  spTypes: string[];
  varieties: string[];
  areas: string[];
  blocks: string[];
  statuses: string[];
};

export type ProductividadDashboardData = {
  generatedAt: string;
  filters: ProductividadFilters;
  options: ProductividadFilterOptions;
  rows: ProductividadRow[];
  summary: {
    totalCycles: number;
    totalEffectiveHours: number;
    totalUnitsProduced: number;
    totalCajas: number;
    weightedHoraCaja: number | null;
    weightedCajaCama: number | null;
    weightedHoraCama: number | null;
    weightedTallosPlanta: number | null;
    weightedPesoTalloGramos: number | null;
    weightedMortalityPct: number | null;
  };
};

// ── Defaults ─────────────────────────────────────────────────────────────────
export const defaultProductividadFilters: ProductividadFilters = {
  year: "all",
  month: "all",
  spType: "all",
  variety: "all",
  area: "all",
  block: "all",
  status: "all",
};

// ── Normalizer ───────────────────────────────────────────────────────────────
export function normalizeProductividadFilters(
  input: Partial<ProductividadFilters>,
): ProductividadFilters {
  return {
    year: parseSelectValue(input.year),
    month: parseSelectValue(input.month),
    spType: parseSelectValue(input.spType),
    variety: parseSelectValue(input.variety),
    area: parseSelectValue(input.area),
    block: parseSelectValue(input.block),
    status: parseSelectValue(input.status),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSelectValue(value: string | null | undefined) {
  return encodeMultiSelectValue(decodeMultiSelectValue(value ?? "all"));
}

function toPercentRatio(value: string | number | null | undefined) {
  const numericValue = toNumber(value);

  if (numericValue === null) {
    return null;
  }

  return Math.abs(numericValue) > 1.5 ? numericValue / 100 : numericValue;
}

function toPercent(value: string | number | null | undefined) {
  const numericValue = toPercentRatio(value);
  return numericValue === null ? null : roundValue(numericValue * 100);
}

function normalizeDateValue(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  return null;
}

function formatDateValue(value: string | Date | null | undefined): string | null {
  return normalizeDateValue(value);
}

function parseYearValue(value: string | number | Date | null | undefined): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getFullYear();
  }

  return toNumber(value);
}

function parseMonthValue(value: string | number | Date | null | undefined): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getMonth() + 1;
  }

  return toNumber(value);
}

function cleanText(value: string | null | undefined): string {
  return value?.trim() || "";
}

function divOrNull(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

/**
 * Calcula la meta ponderada `cajas/cama` de un ciclo a partir del desglose
 * de verde por origen y las metas dimensionadas en `db_admin`.
 *
 * Por cada origen presente en el verde del ciclo, busca la meta correspondiente
 * con clave `${origin_code}|${variety_code}|${sp_type_code}|${iso_week}` y
 * pondera por su participación (kg_origen / kg_total). Si algún origen no tiene
 * meta registrada, se renormaliza por la suma de pesos efectivamente cubiertos
 * (evita subestimar la meta).
 *
 * Retorna `null` si:
 * - No hay desglose por origen (share_jsonb vacío).
 * - Falta variety/sp_type/iso_week.
 * - Ningún origen del ciclo tiene meta registrada.
 */
function computeWeightedBoxesPerBedMeta(
  targetIndex: BoxesPerBedTargetIndex,
  originKgJsonb: Record<string, number | string | null> | null | undefined,
  variety: string,
  spType: string,
  isoWeek: number | null,
): number | null {
  if (!originKgJsonb || !variety || !spType || isoWeek === null) return null;
  const isoWeekStr = String(isoWeek);

  let weighted = 0;
  let weightSum = 0;
  let totalKg = 0;

  // Acumular total para normalizar shares
  for (const dwLabel of Object.keys(ORIGIN_DW_TO_META)) {
    const kg = toNumber(originKgJsonb[dwLabel]) ?? 0;
    if (kg > 0) totalKg += kg;
  }
  if (totalKg <= 0) return null;

  for (const [dwLabel, originCode] of Object.entries(ORIGIN_DW_TO_META)) {
    const kg = toNumber(originKgJsonb[dwLabel]) ?? 0;
    if (kg <= 0) continue;
    const resolvedOriginCode = resolveMetaOriginCode(variety, originCode);
    if (!resolvedOriginCode) continue;
    const meta = targetIndex.get(`${resolvedOriginCode}|${variety}|${spType}|${isoWeekStr}`);
    if (meta === undefined) continue;
    const share = kg / totalKg;
    weighted += share * meta;
    weightSum += share;
  }

  return weightSum > 0 ? weighted / weightSum : null;
}

function maxOrNull(current: number | null, incoming: number | null) {
  if (incoming === null) return current;
  if (current === null) return incoming;
  return Math.max(current, incoming);
}

function etapaLabel(costArea: string): string {
  if (costArea === "CAMPO") return "Vegetativo";
  if (costArea === "COSECHA") return "Cosecha";
  return costArea || "Sin etapa";
}

function matchesFilter(filterValue: string, candidateValue: string): boolean {
  return matchesMultiSelectValue(filterValue, candidateValue);
}

// ── Main data function ────────────────────────────────────────────────────────
export async function getProductividadDashboardData(
  filters: ProductividadFilters,
): Promise<ProductividadDashboardData> {
  const cacheKey = `productividad:dashboard:v2:${filters.year}:${filters.month}:${filters.spType}:${filters.variety}:${filters.area}:${filters.block}:${filters.status}`;

  return cachedAsync(cacheKey, PRODUCTIVIDAD_TTL_MS, async () => {
    const [result, targetIndex] = await Promise.all([
      query<ProductividadQueryRow>(
      `
      with cycle_profile as (
        select distinct on (cycle_key)
          cycle_key,
          coalesce(parent_block, block_id) as block,
          area_id                          as area,
          nullif(trim(variety), '')        as variety,
          nullif(trim(sp_type), '')        as sp_type,
          sp_date,
          harvest_start_date,
          harvest_end_date,
          coalesce(bed_area, 0)            as bed_area,
          coalesce(sum_initial_plants, 0)  as initial_plants_profile
        from ${CYCLE_PROFILE_SOURCE}
        order by cycle_key, valid_from desc nulls last
      ),
      -- plantas actuales y mortalidad desde kardex (agregado por ciclo)
      kardex as (
        select distinct on (cycle_key)
          cycle_key,
          coalesce(final_plants_count, 0)   as plants_current,
          coalesce(initial_plants_cycle, 0) as initial_plants_cycle,
          coalesce(reseed_plants_count, 0)  as reseed_plants_count,
          coalesce(dead_plants_count, 0)    as dead_plants_count,
          pct_mortality
        from ${KARDEX_CYCLE_SOURCE}
        order by cycle_key, valid_from desc nulls last
      ),
      -- tallos totales desde fenograma
      feno as (
        select
          cycle_key,
          sum(coalesce(stems_count, 0)) as total_stems
        from ${FENOGRAMA_SOURCE}
        group by cycle_key
      ),
      -- peso post cosecha
      post_weight as (
        select
          cycle_key,
          sum(coalesce(post_weight_kg, 0)) as post_weight_kg
        from ${PRODUCTIVITY_POST_SRC}
        group by cycle_key
      ),
      -- peso verde (base para cajas = green_weight_kg / 10)
      green_weight as (
        select
          cycle_key,
          sum(coalesce(green_weight_kg, 0)) as green_weight_kg
        from ${PRODUCTIVITY_GREEN_SRC}
        group by cycle_key
      ),
      -- desglose de verde por origen (APERTURA/GV/PRECLASIFICACION) para meta ponderada
      green_by_origin as (
        select
          t.cycle_key,
          upper(o.elem ->> 'origin') as origin_label_upper,
          sum(coalesce((o.elem ->> 'green_weight_kg')::numeric, 0)) as green_weight_kg
        from ${PRODUCTIVITY_GREEN_SRC} t
        cross join lateral jsonb_array_elements(coalesce(t.share_jsonb -> 'origin', '[]'::jsonb)) as o(elem)
        where t.share_jsonb is not null
          and o.elem ->> 'origin' is not null
        group by t.cycle_key, upper(o.elem ->> 'origin')
      ),
      green_origin_agg as (
        select
          cycle_key,
          coalesce(jsonb_object_agg(origin_label_upper, green_weight_kg), '{}'::jsonb) as origin_kg_jsonb
        from green_by_origin
        group by cycle_key
      ),
      -- iso_week derivada de sp_date para lookup de meta.
      -- Usamos EXTRACT(WEEK FROM date) que devuelve el ISO 8601 week (1..53)
      -- por defecto en PostgreSQL — coincide con la semana usada en
      -- target_scope_jsonb.filters.iso_week (int como string, ej "4").
      -- Fallback al calendar table por si sp_date es null pero existe en común.
      cycle_iso_week as (
        select
          cp.cycle_key,
          coalesce(
            extract(week from cp.sp_date)::int,
            extract(week from cal.calendar_date)::int
          ) as iso_week
        from cycle_profile cp
        left join ${CALENDAR_SOURCE} cal
          on cal.calendar_date = cp.sp_date
      ),
      hours_agg as (
        select
          h.cycle_key,
          h.cost_area,
          coalesce(nullif(trim(h.sub_cost_center), ''), 'General') as sub_cost_center,
          coalesce(nullif(trim(h.activity_type), ''), 'General')   as activity_type,
          coalesce(nullif(trim(h.activity_name), ''), 'General')   as activity_name,
          sum(coalesce(h.effective_hours, 0))  as effective_hours,
          sum(coalesce(h.units_produced, 0))   as units_produced
        from ${PROD_HOURS_SOURCE} h
        group by h.cycle_key, h.cost_area, h.sub_cost_center, h.activity_type, h.activity_name
      )
      select
        ha.cycle_key,
        cp.block,
        cp.area,
        cp.variety,
        cp.sp_type,
        cp.sp_date,
        cp.harvest_start_date,
        cp.harvest_end_date,
        extract(year  from cp.harvest_end_date)::int as harvest_year,
        extract(month from cp.harvest_end_date)::int as harvest_month,
        ha.cost_area,
        ha.sub_cost_center,
        ha.activity_type,
        ha.activity_name,
        ha.effective_hours,
        ha.units_produced,
        cp.bed_area,
        coalesce(k.pct_mortality, 0) as pct_mortality,
        coalesce(gw.green_weight_kg, 0) as green_weight_kg,
        coalesce(gow.origin_kg_jsonb, '{}'::jsonb) as green_origin_kg_jsonb,
        ciw.iso_week,
        coalesce(f.total_stems, 0)      as total_stems,
        coalesce(nullif(k.plants_current, 0),       cp.initial_plants_profile, 0) as plants_current,
        coalesce(nullif(k.initial_plants_cycle, 0), cp.initial_plants_profile, 0) as initial_plants_cycle,
        coalesce(k.reseed_plants_count, 0)   as reseed_plants_count,
        coalesce(k.dead_plants_count, 0)     as dead_plants_count,
        coalesce(pw.post_weight_kg, 0)       as post_weight_kg
      from hours_agg ha
      join  cycle_profile cp  on cp.cycle_key  = ha.cycle_key
      left join kardex     k   on k.cycle_key   = ha.cycle_key
      left join feno       f   on f.cycle_key   = ha.cycle_key
      left join post_weight pw  on pw.cycle_key = ha.cycle_key
      left join green_weight gw on gw.cycle_key = ha.cycle_key
      left join green_origin_agg gow on gow.cycle_key = ha.cycle_key
      left join cycle_iso_week    ciw on ciw.cycle_key = ha.cycle_key
      order by
        harvest_year desc nulls last,
        harvest_month desc nulls last,
        cp.block asc,
        ha.cycle_key asc,
        ha.cost_area asc,
        ha.sub_cost_center asc,
        ha.activity_type asc,
        ha.activity_name asc
      `,
      ),
      loadBoxesPerBedTargetIndex(),
    ]);

    // ── Transform rows ───────────────────────────────────────────────────────
    const allRows: ProductividadRow[] = result.rows.map((row) => {
      const effectiveHours = toNumber(row.effective_hours);
      const unitsProduced = toNumber(row.units_produced);
      const bedArea = toNumber(row.bed_area);
      const greenWeightKg = toNumber(row.green_weight_kg);
      const totalStems = toNumber(row.total_stems);
      const plantsCurrentOrInitial = toNumber(row.plants_current);
      const initialPlantsCycle = toNumber(row.initial_plants_cycle);
      const reseedPlantsCycle = toNumber(row.reseed_plants_count);
      const deadPlantsCycle = toNumber(row.dead_plants_count);
      const postWeightKg = toNumber(row.post_weight_kg);
      const costArea = cleanText(row.cost_area);

      // Derived
      const cajas = greenWeightKg !== null ? greenWeightKg / 10 : null;
      const camas30 = bedArea !== null && bedArea > 0 ? bedArea / 30 : null;
      const horaCaja = divOrNull(effectiveHours, cajas);
      const cajaCama = divOrNull(cajas, camas30);

      // ── Meta ponderada (boxes_per_bed) ─────────────────────────────────────
      // Por cada origen del verde del ciclo, busca su meta en target_scope_jsonb.filters
      // y pondera por la participación (kg_origen / kg_total).
      const cajaCamaMeta = computeWeightedBoxesPerBedMeta(
        targetIndex,
        row.green_origin_kg_jsonb,
        cleanText(row.variety),
        cleanText(row.sp_type),
        toNumber(row.iso_week),
      );
      const cumplimiento =
        cajaCama !== null && cajaCamaMeta !== null && cajaCamaMeta !== 0
          ? cajaCama / cajaCamaMeta
          : null;

      // Cycle status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const spDate = parseDateOnly(row.sp_date);
      const startDate = parseDateOnly(row.harvest_start_date);
      const endDate = parseDateOnly(row.harvest_end_date);
      const cycleEndDate = endDate ?? startDate ?? spDate;
      let cycleStatus: "Planificado" | "Abierto" | "Cerrado";

      if (spDate && spDate >= today) {
        cycleStatus = "Planificado";
      } else if (cycleEndDate && cycleEndDate < today) {
        cycleStatus = "Cerrado";
      } else {
        cycleStatus = "Abierto";
      }

      return {
        cycleKey: cleanText(row.cycle_key),
        block: cleanText(row.block),
        area: normalizeAreaDisplayName(row.area),
        variety: cleanText(row.variety),
        spType: cleanText(row.sp_type),
        spDate: formatDateValue(row.sp_date),
        harvestStartDate: formatDateValue(row.harvest_start_date),
        harvestEndDate: formatDateValue(row.harvest_end_date),
        harvestYear: parseYearValue(row.harvest_year),
        harvestMonth: parseMonthValue(row.harvest_month),
        costArea,
        etapaLabel: etapaLabel(costArea),
        subCostCenter: cleanText(row.sub_cost_center),
        activityType: cleanText(row.activity_type),
        activityName: cleanText(row.activity_name),
        cycleStatus,
        pctMortality: toPercent(row.pct_mortality),
        effectiveHours,
        unitsProduced,
        bedArea,
        greenWeightKg,
        cajas,
        camas30,
        totalStems,
        plantsCurrentOrInitial,
        initialPlantsCycle,
        reseedPlantsCycle,
        deadPlantsCycle,
        postWeightKg,
        isoWeek: toNumber(row.iso_week),
        horaCaja,
        cajaCama,
        horaCama: (horaCaja !== null && cajaCama !== null) ? horaCaja * cajaCama : null,
        tallosPlanta: divOrNull(totalStems, plantsCurrentOrInitial),
        pesoTalloGramos: divOrNull(
          greenWeightKg !== null ? greenWeightKg * 1000 : null,
          totalStems,
        ),
        cajaCamaMeta,
        cumplimiento,
      };
    });

    // ── Apply client-side filters ────────────────────────────────────────────
    const filtered = allRows.filter((row) => {
      if (!matchesFilter(filters.year, String(row.harvestYear ?? ""))) return false;
      if (!matchesFilter(filters.month, String(row.harvestMonth ?? ""))) return false;
      if (!matchesFilter(filters.spType, row.spType)) return false;
      if (!matchesFilter(filters.variety, row.variety)) return false;
      if (!matchesFilter(filters.area, row.area)) return false;
      if (!matchesFilter(filters.block, row.block)) return false;
      if (!matchesFilter(filters.status, row.cycleStatus)) return false;
      return true;
    });

    // ── Build filter options from ALL rows ───────────────────────────────────
    const collator = new Intl.Collator("es-EC", { numeric: true, sensitivity: "base" });

    const years = Array.from(new Set(
      allRows.map((r) => String(r.harvestYear ?? "")).filter(Boolean),
    )).sort((a, b) => collator.compare(b, a)); // desc

    const months = Array.from(new Set(
      allRows.map((r) => String(r.harvestMonth ?? "")).filter(Boolean),
    )).sort((a, b) => Number(a) - Number(b));

    const spTypes = Array.from(new Set(
      allRows.map((r) => r.spType).filter(Boolean),
    )).sort((a, b) => collator.compare(a, b));

    const varieties = Array.from(new Set(
      allRows.map((r) => r.variety).filter(Boolean),
    )).sort((a, b) => collator.compare(a, b));

    const areas = Array.from(new Set(
      allRows.map((r) => r.area).filter(Boolean),
    )).sort((a, b) => collator.compare(a, b));

    const blocks = Array.from(new Set(
      allRows.map((r) => r.block).filter(Boolean),
    )).sort((a, b) => collator.compare(a, b));

    const statuses = Array.from(new Set(
      allRows.map((r) => r.cycleStatus),
    )).sort();

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalEffectiveHours = filtered.reduce((s, r) => s + (r.effectiveHours ?? 0), 0);
    const totalUnitsProduced = filtered.reduce((s, r) => s + (r.unitsProduced ?? 0), 0);
    const uniqueCycles = new Set(filtered.map((r) => r.cycleKey)).size;

    // Cajas por ciclo: tomar el máximo por ciclo (green_weight_kg igual en todas las filas del ciclo)
    const cycleTotals = new Map<string, {
      cajas: number | null;
      camas30: number | null;
      greenWeightKg: number | null;
      totalStems: number | null;
      plantsCurrent: number | null;
      initialPlantsCycle: number | null;
      reseedPlantsCycle: number | null;
      deadPlantsCycle: number | null;
    }>();
    for (const row of filtered) {
      const current = cycleTotals.get(row.cycleKey) ?? {
        cajas: null,
        camas30: null,
        greenWeightKg: null,
        totalStems: null,
        plantsCurrent: null,
        initialPlantsCycle: null,
        reseedPlantsCycle: null,
        deadPlantsCycle: null,
      };
      current.cajas = maxOrNull(current.cajas, row.cajas);
      current.camas30 = maxOrNull(current.camas30, row.camas30);
      current.greenWeightKg = maxOrNull(current.greenWeightKg, row.greenWeightKg);
      current.totalStems = maxOrNull(current.totalStems, row.totalStems);
      current.plantsCurrent = maxOrNull(current.plantsCurrent, row.plantsCurrentOrInitial);
      current.initialPlantsCycle = maxOrNull(current.initialPlantsCycle, row.initialPlantsCycle);
      current.reseedPlantsCycle = maxOrNull(current.reseedPlantsCycle, row.reseedPlantsCycle);
      current.deadPlantsCycle = maxOrNull(current.deadPlantsCycle, row.deadPlantsCycle);
      cycleTotals.set(row.cycleKey, current);
    }

    let totalCajas = 0;
    let totalCamas30 = 0;
    let totalGreenWeightKg = 0;
    let totalStems = 0;
    let totalPlantsCurrent = 0;
    let totalInitialPlantsCycle = 0;
    let totalReseedPlantsCycle = 0;
    let totalDeadPlantsCycle = 0;

    for (const totals of cycleTotals.values()) {
      totalCajas += totals.cajas ?? 0;
      totalCamas30 += totals.camas30 ?? 0;
      totalGreenWeightKg += totals.greenWeightKg ?? 0;
      totalStems += totals.totalStems ?? 0;
      totalPlantsCurrent += totals.plantsCurrent ?? 0;
      totalInitialPlantsCycle += totals.initialPlantsCycle ?? 0;
      totalReseedPlantsCycle += totals.reseedPlantsCycle ?? 0;
      totalDeadPlantsCycle += totals.deadPlantsCycle ?? 0;
    }

    // Mort%: Σ(dead_plants_count) / Σ(inicial + resiembras) — numerador directo del kardex
    const totalCycleBase = totalInitialPlantsCycle + totalReseedPlantsCycle;

    return {
      generatedAt: new Date().toISOString(),
      filters,
      options: { years, months, spTypes, varieties, areas, blocks, statuses },
      rows: filtered,
      summary: {
        totalCycles: uniqueCycles,
        totalEffectiveHours,
        totalUnitsProduced,
        totalCajas,
        weightedHoraCaja: totalCajas > 0 ? totalEffectiveHours / totalCajas : null,
        weightedCajaCama: totalCamas30 > 0 ? totalCajas / totalCamas30 : null,
        weightedHoraCama: totalCamas30 > 0 ? totalEffectiveHours / totalCamas30 : null,
        weightedTallosPlanta: totalPlantsCurrent > 0 ? totalStems / totalPlantsCurrent : null,
        weightedPesoTalloGramos: totalStems > 0 ? (totalGreenWeightKg * 1000) / totalStems : null,
        weightedMortalityPct: totalCycleBase > 0
          ? (totalDeadPlantsCycle / totalCycleBase) * 100
          : null,
      },
    };
  });
}
