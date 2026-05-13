import "server-only";

import { queryAdmin } from "@/lib/admin-db";
import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";

/**
 * KPIs de Balanzas con meta y cumplimiento.
 *
 * Tres indicadores convertidos a KPI:
 *   - Hidratación: `(SUM(peso_b2) / SUM(peso_b1c)) - 1`, meta por grado.
 *                  Equivalente al `hydration_pct` legacy del header
 *                  (mismo número, en escala ratio 0..1).
 *   - Desperdicio: `1 - (SUM(peso_b2a) / SUM(peso_b2))`, meta por destino.
 *                  Convención POSITIVA: real > 0 = pérdida, meta > 0 = máximo
 *                  aceptable, cumplimiento = meta/real (menor pérdida → mejor).
 *   - Ajuste:      `LEAST(GREATEST(α + β·razón, 0.98), 1.02)`, donde
 *                  `razón = peso_tallo_venta_semanal / peso_tallo_estimado_ponderado`.
 *
 * Todos los KPIs son **razones de sumas** (nunca promedios de %),
 * robustos ante agregaciones por semana, destino, grado o cualquier
 * combinación. Las metas son ponderadas por `peso_b2` cuando el
 * agrupado mezcla múltiples grades / destinos.
 *
 * Las metas y parámetros viven en `db_admin.public.adm_dim_goal_target_profile_scd2`
 * bajo `subdomain_code="balances"` (ver seeds `sql/seed_db_admin_balances_*.sql`).
 *
 * El factor de hidratación predictivo viene del modelo ML
 * `mdl.prod_fact_ml2_operational_subset_cur`. Las ventas semanales para
 * el ajuste vienen de `gld.mv_prod_weight_stem_week_sales_cur`.
 *
 * No modifica las MVs `gld.mv_camp_ind_bal_*` ni las columnas legacy
 * `hydration_pct` / `dispatch_pct` — los KPIs se computan en paralelo.
 */

// ─── Constantes ────────────────────────────────────────────────────────────────

const TARGETS_TTL_MS = 5 * 60 * 1000;
const FACTOR_INDEX_TTL_MS = 5 * 60 * 1000;
const SALES_INDEX_TTL_MS = 5 * 60 * 1000;

/**
 * Mapping branch del nodo (postcosecha-balanzas-core.ts) → origin_code canon en
 * las metas SCD2 + ML (`mdl.prod_fact_ml2_operational_subset_cur.origin`).
 *
 * Reusa la convención de `productividad.ts ORIGIN_DW_TO_META`:
 *   APERTURA      → opening
 *   GV            → gv
 *   PRECLASIFICACION → preclassification
 */
const BRANCH_TO_META_ORIGIN = {
  apertura: "opening",
  gv: "gv",
  preclasif: "preclassification",
} as const satisfies Record<string, string>;

const BRANCH_TO_DW_ORIGIN = {
  apertura: "APERTURA",
  gv: "GV",
  preclasif: "PRECLASIFICACION",
} as const satisfies Record<string, string>;

/**
 * Mapping sufijo finca del nombre de la MV (xl/cl/zn) → variety code del
 * modelo ML. Confirmado contra muestreo de
 * `mdl.prod_fact_ml2_operational_subset_cur`.
 */
const FARM_TO_VARIETY = {
  xl: "XLE",
  cl: "CLO",
  zn: "ZIN",
} as const satisfies Record<string, string>;

export type BalanzasBranch = keyof typeof BRANCH_TO_META_ORIGIN;
export type BalanzasFarm = keyof typeof FARM_TO_VARIETY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Convierte `Date` o ISO string a `YYWW` (4 dígitos, semana ISO).
 * Misma convención que el SQL `weekSql(dateCol)` de `postcosecha-balanzas-core.ts:807`
 * y que `mv_prod_weight_stem_week_sales_cur.iso_week_id`.
 */
export function dateToYyww(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // ISO week year + ISO week number
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const yy = target.getUTCFullYear() % 100;
  return `${String(yy).padStart(2, "0")}${String(weekNum).padStart(2, "0")}`;
}

/**
 * Resuelve metaOrigin desde el branch del nodo y valida que sea
 * consistente. Devuelve `null` si el branch no es uno de los conocidos.
 */
export function resolveMetaOrigin(branch: string): string | null {
  return BRANCH_TO_META_ORIGIN[branch as BalanzasBranch] ?? null;
}

export function resolveDwOrigin(branch: string): string | null {
  return BRANCH_TO_DW_ORIGIN[branch as BalanzasBranch] ?? null;
}

export function resolveVarietyFromFarm(farm: string): string | null {
  return FARM_TO_VARIETY[farm as BalanzasFarm] ?? null;
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type BalanzasKpiResult = {
  /** Razón real `SUM(num) / SUM(den)`. */
  real: number | null;
  /** Meta ponderada `SUM(meta × peso) / SUM(peso)`. */
  meta: number | null;
  /**
   * Cumplimiento.
   *   - Hidratación (mayor es mejor): `real / meta`.
   *   - Desperdicio (menor es mejor): `|meta| / |real|`.
   *   En ambos casos, >1 = sobre meta.
   */
  cumplimiento: number | null;
  /** Numerador acumulado (informativo). */
  num: number;
  /** Denominador acumulado (informativo). */
  den: number;
  /** Filas válidas (con peso > 0) consideradas. */
  rowsCount: number;
  /** Filas excluidas por falta de meta para su categoría (informativo). */
  rowsMissingMeta: number;
};

export type BalanzasAdjustmentKpiResult = {
  /** Peso/tallo estimado ponderado por peso_b1c (kg/tallo). */
  pesoTalloEstimadoPonderado: number | null;
  /** Peso/tallo de ventas (kg/tallo) tomado de mv_prod_weight_stem_week_sales_cur. */
  pesoTalloVenta: number | null;
  /** razon = pesoTalloVenta / pesoTalloEstimadoPonderado. */
  razonAjuste: number | null;
  /** α (alpha). */
  alpha: number;
  /** β (beta). */
  beta: number;
  /** alpha + beta × razon. */
  ajusteBruto: number | null;
  /** Censurado al rango [0.98, 1.02]. */
  ajusteFinal: number | null;
  /** Lista de iso_week_id (YYWW) cubiertos por las rows. */
  weeksCovered: string[];
};

export type BalanzasNodeKpi = {
  hydration?: BalanzasKpiResult;
  waste?: BalanzasKpiResult;
  adjustment?: BalanzasAdjustmentKpiResult;
};

// ─── Loaders catálogo (db_admin) ──────────────────────────────────────────────

type HydrationTargetIndex = Map<string, number>; // key: `${origin}|${grade}`
type WasteTargetIndex = Map<string, number>; // key: `${origin}|${destination}`
type AdjustmentParams = { alpha: number; beta: number };

const NULL_ADJUSTMENT_PARAMS: AdjustmentParams = { alpha: 0.8, beta: 0.19 };

/**
 * Carga el índice de metas de hidratación desde db_admin.
 *
 * scope filters: `subdomain_code="balances"`, `origin_code`, `grade_code`.
 * Retorna Map `"${origin_code}|${grade_code}" → ratio meta`.
 *
 * Si la query falla o no hay metas, retorna Map vacío (modo degradado).
 */
export async function loadHydrationTargets(): Promise<HydrationTargetIndex> {
  return cachedAsync("admin:balances:hydration_targets", TARGETS_TTL_MS, async () => {
    try {
      const { rows } = await queryAdmin<{
        origin_code: string | null;
        grade_code: string | null;
        value_min: string | number | null;
      }>(
        `SELECT
           t.target_scope_jsonb #>> '{filters,origin_code}' AS origin_code,
           t.target_scope_jsonb #>> '{filters,grade_code}'  AS grade_code,
           t.value_min
         FROM public.adm_dim_goal_target_profile_scd2 t
         WHERE t.is_current = true AND t.is_valid = true
           AND t.metric_code = 'hydration_target'
           AND t.target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'`,
      );

      const idx: HydrationTargetIndex = new Map();
      for (const r of rows) {
        if (!r.origin_code || !r.grade_code) continue;
        const v = toNum(r.value_min);
        if (v === null) continue;
        idx.set(`${r.origin_code}|${r.grade_code}`, v);
      }
      return idx;
    } catch {
      return new Map();
    }
  });
}

/**
 * Carga el índice de metas de desperdicio desde db_admin.
 *
 * scope filters: `subdomain_code="balances"`, `origin_code`, `destination_code`.
 * Retorna Map `"${origin_code}|${destination_code}" → ratio POSITIVO`
 * (sin signo; el cómputo lo invierte internamente).
 */
export async function loadWasteTargets(): Promise<WasteTargetIndex> {
  return cachedAsync("admin:balances:waste_targets", TARGETS_TTL_MS, async () => {
    try {
      const { rows } = await queryAdmin<{
        origin_code: string | null;
        destination_code: string | null;
        value_min: string | number | null;
      }>(
        `SELECT
           t.target_scope_jsonb #>> '{filters,origin_code}'      AS origin_code,
           t.target_scope_jsonb #>> '{filters,destination_code}' AS destination_code,
           t.value_min
         FROM public.adm_dim_goal_target_profile_scd2 t
         WHERE t.is_current = true AND t.is_valid = true
           AND t.metric_code = 'waste_target'
           AND t.target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'`,
      );

      const idx: WasteTargetIndex = new Map();
      for (const r of rows) {
        if (!r.origin_code || !r.destination_code) continue;
        const v = toNum(r.value_min);
        if (v === null) continue;
        idx.set(`${r.origin_code}|${r.destination_code}`, v);
      }
      return idx;
    } catch {
      return new Map();
    }
  });
}

/**
 * Carga los parámetros alpha + beta del ajuste desde db_admin (scope global
 * subdomain_code="balances").
 *
 * Si la query falla o falta algún parámetro, retorna defaults inseguros
 * `{alpha: 0.8, beta: 0.19}` — esos defaults corresponden a los valores
 * actuales del seed. La UI / API expone los valores reales cargados.
 */
export async function loadAdjustmentParams(): Promise<AdjustmentParams> {
  return cachedAsync("admin:balances:adjustment_params", TARGETS_TTL_MS, async () => {
    try {
      const { rows } = await queryAdmin<{ metric_code: string; value_min: string | number | null }>(
        `SELECT t.metric_code, t.value_min
         FROM public.adm_dim_goal_target_profile_scd2 t
         WHERE t.is_current = true AND t.is_valid = true
           AND t.metric_code IN ('adjustment_alpha', 'adjustment_beta')
           AND t.target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'`,
      );

      let alpha: number | null = null;
      let beta: number | null = null;
      for (const r of rows) {
        const v = toNum(r.value_min);
        if (v === null) continue;
        if (r.metric_code === "adjustment_alpha") alpha = v;
        else if (r.metric_code === "adjustment_beta") beta = v;
      }
      return {
        alpha: alpha ?? NULL_ADJUSTMENT_PARAMS.alpha,
        beta: beta ?? NULL_ADJUSTMENT_PARAMS.beta,
      };
    } catch {
      return { ...NULL_ADJUSTMENT_PARAMS };
    }
  });
}

// ─── Loaders externos (datalakehouse) ─────────────────────────────────────────

type SalesIndex = Map<string, number>; // key: iso_week_id (YYWW), value: weight_stem_sales

/**
 * Carga el índice de ventas peso/tallo semanal.
 *
 * MV: `gld.mv_prod_weight_stem_week_sales_cur`.
 * Columnas: `iso_week_id (text, YYWW 4-digit), weight, stems, weight_stem_sales`.
 *
 * Match contra balanza: la convención `iso_week_id` ya es YYWW (verificado
 * contra DB real: muestras `2653`, `2652`, etc.). El SQL `weekSql(dateCol)`
 * en `postcosecha-balanzas-core.ts:807` produce el mismo formato.
 */
export async function loadWeeklySalesIndex(weeks?: ReadonlyArray<string>): Promise<SalesIndex> {
  // Cache key incluye lista ordenada de semanas (o "ALL" si no se especifica)
  const cacheKey = weeks && weeks.length > 0
    ? `balances:sales:weeks:${[...weeks].sort().join(",")}`
    : "balances:sales:all";

  return cachedAsync(cacheKey, SALES_INDEX_TTL_MS, async () => {
    try {
      const sql = weeks && weeks.length > 0
        ? `SELECT iso_week_id, weight_stem_sales
           FROM gld.mv_prod_weight_stem_week_sales_cur
           WHERE iso_week_id = ANY($1::text[])`
        : `SELECT iso_week_id, weight_stem_sales
           FROM gld.mv_prod_weight_stem_week_sales_cur`;

      const params = weeks && weeks.length > 0 ? [weeks] : [];
      const { rows } = await query<{ iso_week_id: string; weight_stem_sales: string | number | null }>(
        sql,
        params,
      );

      const idx: SalesIndex = new Map();
      for (const r of rows) {
        if (!r.iso_week_id) continue;
        const v = toNum(r.weight_stem_sales);
        if (v === null) continue;
        idx.set(r.iso_week_id, v);
      }
      return idx;
    } catch {
      return new Map();
    }
  });
}

/**
 * Carga las filas necesarias para calcular el KPI Hidratación cuando
 * la MV del nodo NO tiene `grade` row-by-row (caso: apertura-b1c-b2a-vs-ideal).
 *
 * Reusa la MV cross `b1c_vs_b2_weight_<farm>_np_cur` que sí tiene grade.
 * El `whereSql`/`whereParams` del nodo original aplican íntegros porque
 * ambas MVs comparten `work_date`, `destination` y otros filtros temporales.
 *
 * Devuelve rows con columnas: grade, destination, weight_b1c_estimated_kg,
 * weight_b2_kg. Cacheado vía cachedAsync.
 */
export async function loadHydrationKpiSourceRows(args: {
  branch: BalanzasBranch;
  farm: BalanzasFarm;
  whereSql: string;
  whereParams: unknown[];
}): Promise<BalanzasComputeRow[]> {
  const { branch, farm } = args;
  if (branch !== "apertura") return [];

  const viewName = `gld.mv_camp_ind_bal_apertura_b1c_vs_b2_weight_${farm}_np_cur`;
  const cacheKey = `balances:hyd_src:${branch}:${farm}:${args.whereSql}:${JSON.stringify(args.whereParams)}`;

  return cachedAsync(cacheKey, FACTOR_INDEX_TTL_MS, async () => {
    try {
      const { rows } = await query<BalanzasComputeRow>(
        `SELECT grade, destination, weight_b1c_estimated_kg, weight_b2_kg
         FROM ${viewName} ${args.whereSql}
         LIMIT 100000`,
        args.whereParams,
      );
      return rows;
    } catch {
      return [];
    }
  });
}

/**
 * Carga las filas necesarias para calcular el KPI Ajuste desde la MV
 * `b1c_vs_b2_weight` de la finca correspondiente.
 *
 * El Ajuste se MUESTRA en los modales de `b2_vs_b2a` y `b1c_vs_b2a_vs_ideal`,
 * pero esas MVs no tienen `weight_per_stem_kg`, `weight_b1c_estimated_kg`,
 * ni `lot_date`/`grade` row-by-row. Por eso el cálculo lee de la MV
 * estructuralmente equivalente (`b1c_vs_b2_weight_${farm}_np_cur` para
 * APERTURA) que sí tiene todas las columnas necesarias.
 *
 * Filtros temporales se respetan exactamente como en el nodo actual.
 */
export async function loadAdjustmentSourceRows(args: {
  branch: BalanzasBranch;
  farm: BalanzasFarm;
  whereSql: string;
  whereParams: unknown[];
}): Promise<BalanzasComputeRow[]> {
  const { branch, farm } = args;
  // Solo soportamos APERTURA por ahora — GV/PRECLASIF se habilitan al
  // confirmar metas.
  if (branch !== "apertura") return [];

  // MV con weight_per_stem_kg + weight_b1c_estimated_kg + lot_date + grade
  // + destination + work_date.
  const viewName = `gld.mv_camp_ind_bal_apertura_b1c_vs_b2_weight_${farm}_np_cur`;
  const cacheKey = `balances:adj_source:${branch}:${farm}:${args.whereSql}:${JSON.stringify(args.whereParams)}`;

  return cachedAsync(cacheKey, FACTOR_INDEX_TTL_MS, async () => {
    try {
      const { rows } = await query<BalanzasComputeRow>(
        `SELECT work_date, lot_date, grade, destination,
                weight_per_stem_kg, weight_b1c_estimated_kg, weight_b2_kg
         FROM ${viewName} ${args.whereSql}
         LIMIT 100000`,
        args.whereParams,
      );
      return rows;
    } catch {
      return [];
    }
  });
}

type HydrationFactorIndex = {
  /** Match más fino disponible: `lot_date|work_date|grade|destination`. */
  byFull: Map<string, number>;
  /** Fallback granularidad media: `work_date|grade|destination`. */
  byWorkDate: Map<string, number>;
  /** Fallback coarse: `grade|destination`. */
  byGradeDest: Map<string, number>;
};

const EMPTY_FACTOR_INDEX: HydrationFactorIndex = {
  byFull: new Map(),
  byWorkDate: new Map(),
  byGradeDest: new Map(),
};

/**
 * Carga el índice de factor de hidratación predictivo desde el modelo ML.
 *
 * Fuente: `mdl.prod_fact_ml2_operational_subset_cur`.
 *
 * Filtros del request:
 *   - `dwOrigin`: APERTURA / GV / PRECLASIFICACION (mapeado desde branch del nodo).
 *   - `variety`: XLE / CLO / ZIN (mapeado desde el sufijo finca del MV).
 *   - `dateFrom` / `dateTo`: bounded por la ventana de trabajo del nodo.
 *
 * Construye 3 niveles de Map para que el cómputo elija el más fino que
 * matchee la row de balanza:
 *
 *   1. byFull        — lot_date(YYYY-MM-DD)|work_date|grade|destination
 *   2. byWorkDate    — work_date|grade|destination       (fallback si MV solo tiene work_date)
 *   3. byGradeDest   — grade|destination                 (último fallback)
 *
 * Cada nivel agrega con `AVG(hydration_factor)` (no ponderado, porque el
 * modelo ML genera 1 fila por evento productivo y todas pesan igual).
 */
export async function loadHydrationFactorIndex(args: {
  dwOrigin: string;
  variety: string;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<HydrationFactorIndex> {
  const { dwOrigin, variety, dateFrom, dateTo } = args;
  const cacheKey = `balances:factor:${dwOrigin}:${variety}:${dateFrom ?? "-"}:${dateTo ?? "-"}`;

  return cachedAsync(cacheKey, FACTOR_INDEX_TTL_MS, async () => {
    try {
      const conditions: string[] = [
        "is_valid = true",
        "hydration_factor IS NOT NULL",
        "origin = $1",
      ];
      const params: unknown[] = [dwOrigin];
      let p = 2;

      // Variety from model_cycle_id: `substring(model_cycle_id FROM 'GYP([^-]+)-')`
      // con ZZ → ZIN. Si pasamos variety XLE/CLO/ZIN, filtramos por el match
      // post-extracción.
      conditions.push(
        `CASE WHEN substring(model_cycle_id FROM 'GYP([^-]+)-') = 'ZZ' THEN 'ZIN'
              ELSE substring(model_cycle_id FROM 'GYP([^-]+)-') END = $${p}`,
      );
      params.push(variety);
      p++;

      if (dateFrom) {
        conditions.push(`post_event_at::date >= $${p}::date`);
        params.push(dateFrom);
        p++;
      }
      if (dateTo) {
        conditions.push(`post_event_at::date <= $${p}::date`);
        params.push(dateTo);
        p++;
      }

      const sql = `
        WITH base AS (
          SELECT
            event_date::date AS lot_date,
            post_event_at::date AS work_date,
            grade,
            destination,
            hydration_factor
          FROM mdl.prod_fact_ml2_operational_subset_cur
          WHERE ${conditions.join(" AND ")}
        )
        SELECT
          lot_date::text AS lot_date_text,
          work_date::text AS work_date_text,
          grade,
          destination,
          AVG(hydration_factor) AS hf
        FROM base
        WHERE grade IS NOT NULL AND destination IS NOT NULL
        GROUP BY lot_date, work_date, grade, destination
      `;

      const { rows } = await query<{
        lot_date_text: string;
        work_date_text: string;
        grade: string;
        destination: string;
        hf: string | number | null;
      }>(sql, params);

      const byFull = new Map<string, number>();
      const byWorkAgg = new Map<string, { sum: number; n: number }>();
      const byGradeDestAgg = new Map<string, { sum: number; n: number }>();

      for (const r of rows) {
        const hf = toNum(r.hf);
        if (hf === null) continue;
        const lotKey = r.lot_date_text;
        const workKey = r.work_date_text;
        const fullKey = `${lotKey}|${workKey}|${r.grade}|${r.destination}`;
        byFull.set(fullKey, hf);

        const workComposed = `${workKey}|${r.grade}|${r.destination}`;
        const agg1 = byWorkAgg.get(workComposed) ?? { sum: 0, n: 0 };
        agg1.sum += hf;
        agg1.n += 1;
        byWorkAgg.set(workComposed, agg1);

        const gdKey = `${r.grade}|${r.destination}`;
        const agg2 = byGradeDestAgg.get(gdKey) ?? { sum: 0, n: 0 };
        agg2.sum += hf;
        agg2.n += 1;
        byGradeDestAgg.set(gdKey, agg2);
      }

      const byWorkDate = new Map<string, number>();
      for (const [k, v] of byWorkAgg) byWorkDate.set(k, v.sum / v.n);
      const byGradeDest = new Map<string, number>();
      for (const [k, v] of byGradeDestAgg) byGradeDest.set(k, v.sum / v.n);

      return { byFull, byWorkDate, byGradeDest };
    } catch {
      return EMPTY_FACTOR_INDEX;
    }
  });
}

// ─── Funciones puras de cómputo (testeables) ──────────────────────────────────

export type BalanzasComputeRow = Readonly<Record<string, unknown>>;

/**
 * Configuración de columnas para `computeHydrationKpi` y
 * `computeWasteKpi`. Permite que el cómputo funcione con MVs distintas
 * que usan nombres distintos (ej. `weight_b1c_estimated_kg` vs `weight_b1c_kg`).
 */
export type HydrationColumnConfig = {
  b1cKey: string;        // ej. "weight_b1c_estimated_kg" o "weight_b1c_kg"
  b2Key: string;         // ej. "weight_b2_kg"
  gradeKey: string;      // ej. "grade"
};

export type WasteColumnConfig = {
  b2Key: string;         // ej. "weight_b2_kg"
  b2aKey: string;        // ej. "weight_b2a_kg"
  destinationKey: string; // ej. "destination"
};

export type AdjustmentColumnConfig = {
  weightPerStemKey: string;  // "weight_per_stem_kg"
  b1cKey: string;            // "weight_b1c_estimated_kg" o "weight_b1c_kg"
  lotDateKey?: string;       // "lot_date" si la MV la tiene
  workDateKey: string;       // "work_date"
  gradeKey: string;          // "grade"
  destinationKey: string;    // "destination"
};

/**
 * Calcula el KPI de Hidratación a partir de filas de balanza + metas.
 *
 * Fórmula canon (alineada con `hydration_pct` legacy del header):
 *
 *   real        = (SUM(b2) / SUM(b1c)) − 1
 *   meta        = (SUM(meta_grade × b1c) / SUM(b1c)) − 1
 *                 ↑ ponderación por peso_b1c (el denominador del ratio).
 *   cumplimiento = real / meta            (mayor es mejor)
 *
 * IMPORTANTE: las metas en SCD2 están guardadas en escala "ratio de
 * crecimiento", o sea: meta_BQT = 1.68 significa que B2 = 2.68 × B1C
 * (el peso aumenta 168% al hidratar). Es la misma escala que `real`,
 * por eso el cumplimiento es razón directa.
 *
 * Filas con `b1c ≤ 0` se ignoran.
 */
export function computeHydrationKpi(
  rows: ReadonlyArray<BalanzasComputeRow>,
  config: HydrationColumnConfig,
  targets: HydrationTargetIndex,
  metaOrigin: string,
): BalanzasKpiResult {
  let numB2 = 0;       // SUM(b2)
  let denB1c = 0;      // SUM(b1c)
  let metaTimesB1c = 0; // SUM(meta_grade * b1c)
  let metaDenB1c = 0;   // SUM(b1c) solo donde había meta
  let rowsCount = 0;
  let rowsMissingMeta = 0;

  for (const r of rows) {
    const b1c = toNum(r[config.b1cKey]) ?? 0;
    const b2 = toNum(r[config.b2Key]) ?? 0;
    if (b1c <= 0) continue;
    numB2 += b2;
    denB1c += b1c;
    rowsCount += 1;

    const grade = r[config.gradeKey];
    if (typeof grade === "string" && grade) {
      const m = targets.get(`${metaOrigin}|${grade}`);
      if (m !== undefined) {
        metaTimesB1c += m * b1c;
        metaDenB1c += b1c;
      } else {
        rowsMissingMeta += 1;
      }
    } else {
      rowsMissingMeta += 1;
    }
  }

  const real = denB1c > 0 ? numB2 / denB1c - 1 : null;
  const meta = metaDenB1c > 0 ? metaTimesB1c / metaDenB1c : null;
  const cumplimiento =
    real !== null && meta !== null && meta !== 0 ? real / meta : null;

  return { real, meta, cumplimiento, num: numB2, den: denB1c, rowsCount, rowsMissingMeta };
}

/**
 * Calcula el KPI de Desperdicio.
 *
 * Fórmula canon (POSITIVO — alineado con la convención del header
 * `dispatch_pct` después del fix a `derived-loss-ratio` en el core):
 *
 *   real         = 1 − (SUM(b2a) / SUM(b2))
 *   meta         = SUM(meta_destino × b2) / SUM(b2)   (positiva)
 *   cumplimiento = meta / real                        (menor real → mejor)
 *
 * Semántica: `real` es la fracción de peso perdido entre B2 y B2A
 * (0..1). Valores típicos 0.20..0.40. Cumplimiento >1 = mejor que meta
 * (menos pérdida), <1 = peor que meta.
 *
 * Filas con `b2 ≤ 0` se ignoran.
 */
export function computeWasteKpi(
  rows: ReadonlyArray<BalanzasComputeRow>,
  config: WasteColumnConfig,
  targets: WasteTargetIndex,
  metaOrigin: string,
): BalanzasKpiResult {
  let sumB2a = 0;
  let sumB2 = 0;
  let metaTimesB2 = 0;
  let metaDenB2 = 0;
  let rowsCount = 0;
  let rowsMissingMeta = 0;

  for (const r of rows) {
    const b2 = toNum(r[config.b2Key]) ?? 0;
    const b2a = toNum(r[config.b2aKey]) ?? 0;
    if (b2 <= 0) continue;
    sumB2a += b2a;
    sumB2 += b2;
    rowsCount += 1;

    const dest = r[config.destinationKey];
    if (typeof dest === "string" && dest) {
      const m = targets.get(`${metaOrigin}|${dest}`);
      if (m !== undefined) {
        metaTimesB2 += m * b2; // m ya está positivo en SCD2
        metaDenB2 += b2;
      } else {
        rowsMissingMeta += 1;
      }
    } else {
      rowsMissingMeta += 1;
    }
  }

  const real = sumB2 > 0 ? 1 - sumB2a / sumB2 : null;
  const meta = metaDenB2 > 0 ? metaTimesB2 / metaDenB2 : null;
  // menor real → mejor; cumplimiento = meta / real
  const cumplimiento =
    real !== null && meta !== null && real > 0 ? meta / real : null;

  return {
    real,
    meta,
    cumplimiento,
    num: sumB2a,
    den: sumB2,
    rowsCount,
    rowsMissingMeta,
  };
}

/**
 * Calcula el KPI de Ajuste.
 *
 * Pipeline (versión corregida R3 — validada contra Excel canon del usuario):
 *
 *   1. Por cada row, resolver `hydration_factor` desde el modelo ML con
 *      fallback cascada. **Regla especial para destino BLANCO**: la MV
 *      no trae `lot_date` válido para BLANCO, así que se salta `byFull`
 *      y va directo a `byWorkDate` → `byGradeDest`.
 *
 *   2. `peso_tallo_estimado_gr = weight_per_stem_kg × hydration_factor × 1000`.
 *      El `× 1000` escala kg/tallo → gramos/tallo, alineado con la
 *      unidad de `weight_stem_sales` de `mv_prod_weight_stem_week_sales_cur`.
 *
 *   3. Ponderado por `peso_b1c`:
 *        `SUM(peso_tallo_estimado_gr × peso_b1c) / SUM(peso_b1c)`.
 *
 *   4. Match contra ventas semanales por `iso_week_id` derivado de
 *      `work_date`. Si las rows cubren varias semanas, se hace un
 *      ponderado por `peso_b1c` de cada semana (estimado y venta).
 *
 *   5. `razón = peso_tallo_estimado_ponderado / peso_tallo_venta`
 *      (estimado / venta — NO al revés).
 *
 *   6. `ajuste_bruto = alpha + beta × razón`.
 *
 *   7. `ajuste_final = MAX(bruto, 0.96)`  — **solo censura inferior**.
 *      No hay techo (el ratio puede subir si el estimado excede ventas).
 */
export function computeAdjustmentKpi(
  rows: ReadonlyArray<BalanzasComputeRow>,
  config: AdjustmentColumnConfig,
  factorIndex: HydrationFactorIndex,
  salesIndex: SalesIndex,
  params: AdjustmentParams,
): BalanzasAdjustmentKpiResult {
  const { alpha, beta } = params;

  type WeekAccum = {
    estimatedNum: number; // Σ(peso_tallo_estimado_gr × peso_b1c)
    estimatedDen: number; // Σ(peso_b1c)
  };
  const byWeek = new Map<string, WeekAccum>();

  for (const r of rows) {
    const peso_b1c = toNum(r[config.b1cKey]) ?? 0;
    if (peso_b1c <= 0) continue;
    const wps_kg = toNum(r[config.weightPerStemKey]); // kg/tallo en la MV
    if (wps_kg === null) continue;

    const workDateRaw = r[config.workDateKey];
    const yyww = dateToYyww(workDateRaw as Date | string | null);
    if (!yyww) continue;

    const grade = typeof r[config.gradeKey] === "string" ? (r[config.gradeKey] as string) : "";
    const dest = typeof r[config.destinationKey] === "string" ? (r[config.destinationKey] as string) : "";
    const workDateStr =
      workDateRaw instanceof Date
        ? workDateRaw.toISOString().slice(0, 10)
        : typeof workDateRaw === "string"
        ? workDateRaw.slice(0, 10)
        : "";

    // Resolver hydration_factor con cascada.
    // Regla especial BLANCO: la MV no tiene lot_date válido, se salta
    // byFull y se va directo a byWorkDate.
    const isBlanco = dest.toUpperCase() === "BLANCO";

    let hf: number | undefined;
    if (!isBlanco && config.lotDateKey) {
      const lotRaw = r[config.lotDateKey];
      const lotStr =
        lotRaw instanceof Date
          ? lotRaw.toISOString().slice(0, 10)
          : typeof lotRaw === "string"
          ? lotRaw.slice(0, 10)
          : "";
      if (lotStr && workDateStr && grade && dest) {
        hf = factorIndex.byFull.get(`${lotStr}|${workDateStr}|${grade}|${dest}`);
      }
    }
    if (hf === undefined && workDateStr && grade && dest) {
      hf = factorIndex.byWorkDate.get(`${workDateStr}|${grade}|${dest}`);
    }
    if (hf === undefined && grade && dest) {
      hf = factorIndex.byGradeDest.get(`${grade}|${dest}`);
    }
    if (hf === undefined) continue; // skip row sin factor disponible

    // Escalar a gramos: kg/tallo × factor × 1000 = gr/tallo (alineado con venta)
    const pesoTalloEstimadoGr = wps_kg * hf * 1000;
    const acc = byWeek.get(yyww) ?? { estimatedNum: 0, estimatedDen: 0 };
    acc.estimatedNum += pesoTalloEstimadoGr * peso_b1c;
    acc.estimatedDen += peso_b1c;
    byWeek.set(yyww, acc);
  }

  if (byWeek.size === 0) {
    return {
      pesoTalloEstimadoPonderado: null,
      pesoTalloVenta: null,
      razonAjuste: null,
      alpha,
      beta,
      ajusteBruto: null,
      ajusteFinal: null,
      weeksCovered: [],
    };
  }

  // Ponderado global por peso_b1c entre semanas.
  let venta_weighted_num = 0;
  let estimado_weighted_num = 0;
  let total_b1c = 0;
  const weeksWithSales: string[] = [];

  for (const [yyww, acc] of byWeek) {
    if (acc.estimatedDen <= 0) continue;
    const ventaWeek = salesIndex.get(yyww);
    if (ventaWeek === undefined) continue;
    const estimadoWeek = acc.estimatedNum / acc.estimatedDen;
    venta_weighted_num += ventaWeek * acc.estimatedDen;
    estimado_weighted_num += estimadoWeek * acc.estimatedDen;
    total_b1c += acc.estimatedDen;
    weeksWithSales.push(yyww);
  }

  if (total_b1c <= 0) {
    return {
      pesoTalloEstimadoPonderado: null,
      pesoTalloVenta: null,
      razonAjuste: null,
      alpha,
      beta,
      ajusteBruto: null,
      ajusteFinal: null,
      weeksCovered: [...byWeek.keys()].sort(),
    };
  }

  const pesoTalloEstimadoPonderado = estimado_weighted_num / total_b1c;
  const pesoTalloVenta = venta_weighted_num / total_b1c;
  // razón = estimado / venta (NO venta / estimado)
  const razonAjuste =
    pesoTalloVenta > 0 ? pesoTalloEstimadoPonderado / pesoTalloVenta : null;
  const ajusteBruto = razonAjuste !== null ? alpha + beta * razonAjuste : null;
  // Censura SOLO inferior a 0.96 (sin techo)
  const ajusteFinal = ajusteBruto !== null ? Math.max(ajusteBruto, 0.96) : null;

  return {
    pesoTalloEstimadoPonderado,
    pesoTalloVenta,
    razonAjuste,
    alpha,
    beta,
    ajusteBruto,
    ajusteFinal,
    weeksCovered: weeksWithSales.sort(),
  };
}
