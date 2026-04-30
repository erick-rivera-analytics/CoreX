import "server-only";

import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { normalizeAreaDisplayName } from "@/shared/lib/area-normalization";
import { formatFlexibleNumber, formatPercent as formatPercentShared } from "@/shared/lib/format";
import { roundValue, toNumber } from "@/shared/lib/number-utils";

type ComparisonOptionQueryRow = {
  cycle_key: string | null;
  parent_block: string | null;
  area: string | null;
  variety: string | null;
  sp_type: string | null;
  sp_date: string | null;
  harvest_start_date: string | null;
  harvest_end_date: string | null;
  total_stems: number | string | null;
};

type ComparisonFilterOptionsRow = {
  areas: string[] | null;
  blocks: string[] | null;
  varieties: string[] | null;
};

type ComparisonSnapshotQueryRow = {
  cycle_key: string;
  parent_block: string | null;
  block_id: string | null;
  area: string | null;
  variety: string | null;
  sp_type: string | null;
  sp_date: string | null;
  harvest_start_date: string | null;
  harvest_end_date: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_current: boolean | null;
  bed_count: string | number | null;
  pambiles_count: string | number | null;
  bed_area: string | number | null;
  programmed_plants: string | number | null;
  cycle_start_plants: string | number | null;
  current_plants: string | number | null;
  dead_plants: string | number | null;
  reseeded_plants: string | number | null;
  availability_vs_scheduled_pct: string | number | null;
  availability_vs_initial_pct: string | number | null;
  mortality_pct: string | number | null;
  total_stems: string | number | null;
  green_weight_kg: string | number | null;
  post_weight_kg: string | number | null;
  effective_hours: string | number | null;
};

export type ComparisonSearchFilters = {
  q: string;
  area: string;
  block: string;
  variety: string;
  limit: number;
};

export type ComparisonCycleOption = {
  cycleKey: string;
  block: string;
  area: string;
  variety: string;
  spType: string;
  spDate: string | null;
  harvestStartDate: string | null;
  harvestEndDate: string | null;
  totalStems: number;
};

export type ComparisonCycleSnapshot = ComparisonCycleOption & {
  blockId: string;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
  bedCount: number | null;
  pambilesCount: number | null;
  bedArea: number | null;
  programmedPlants: number | null;
  cycleStartPlants: number | null;
  currentPlants: number | null;
  deadPlants: number | null;
  reseededPlants: number | null;
  availabilityVsScheduledPct: number | null;
  availabilityVsInitialPct: number | null;
  mortalityPct: number | null;
  cajasVerde: number | null;
  cajasBlanco: number | null;
  pesoTalloG: number | null;
  horasCaja: number | null;
  cajasCama: number | null;
  horasCama: number | null;
};

export type ComparisonMetric = {
  key: string;
  label: string;
  leftValue: number | null;
  rightValue: number | null;
  leftDisplay: string;
  rightDisplay: string;
  leftShare: number;
  rightShare: number;
  winner: "left" | "right" | "tie" | "neutral";
};

export type ComparisonRadarPoint = {
  label: string;
  maxLabel: string;
  left: number;
  right: number;
  leftDisplay: string;
  rightDisplay: string;
};

export type ComparisonPairPayload = {
  generatedAt: string;
  left: ComparisonCycleSnapshot | null;
  right: ComparisonCycleSnapshot | null;
  metrics: ComparisonMetric[];
  radar: ComparisonRadarPoint[];
};

export type ComparisonFilterOptions = {
  areas: string[];
  blocks: string[];
  varieties: string[];
};

export type ComparisonDashboardData = {
  generatedAt: string;
  filters: ComparisonSearchFilters;
  filterOptions: ComparisonFilterOptions;
  options: ComparisonCycleOption[];
  leftCycleKey: string | null;
  rightCycleKey: string | null;
  comparison: ComparisonPairPayload | null;
};

const AREA_SQL = `
  case
    when nullif(parent_block, '') is not null
      and position(concat('-', nullif(parent_block, ''), '-') in coalesce(cycle_key, '')) > 0
      then nullif(split_part(coalesce(cycle_key, ''), concat('-', nullif(parent_block, ''), '-'), 1), '')
    else nullif(split_part(coalesce(cycle_key, ''), '-', 1), '')
  end
`;

const FENOGRAMA_SOURCE    = "gld.mv_prod_fenograma_cur";
const CYCLE_PLANTS_SOURCE = "gld.mv_camp_kardex_cycle_plants_cur";
const PROD_GREEN_SOURCE   = "gld.mv_prod_productivity_green_cur";
const PROD_POST_SOURCE    = "gld.mv_prod_productivity_post_cur";
const PROD_HOURS_SOURCE   = "gld.mv_prod_hours_cycle_person_cur";
const CYCLE_PROFILE_SOURCE = "slv.camp_dim_cycle_profile_scd2";

const COMPARISON_OPTIONS_TTL_MS = 5 * 60 * 1000;
const COMPARISON_SEARCH_TTL_MS  = 30 * 1000;
const COMPARISON_PAIR_TTL_MS    = 60 * 1000;

const RADAR_METRIC_KEYS = new Set([
  "totalStems",
  "cajasVerde",
  "pesoTalloG",
  "cajasCama",
  "mortalityPct",
  "availabilityVsScheduledPct",
]);

const RADAR_MAX_LABELS: Record<string, string> = {
  totalStems: "300K",
  cajasVerde: "1,100",
  pesoTalloG: "50 g",
  cajasCama: "20",
  mortalityPct: "100%",
  availabilityVsScheduledPct: "100%",
};

export const defaultComparisonFilters: ComparisonSearchFilters = {
  q: "",
  area: "all",
  block: "",
  variety: "all",
  limit: 24,
};

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function toPercentRatio(value: string | number | null) {
  const numericValue = toNumber(value);
  if (numericValue === null) return null;
  return Math.abs(numericValue) > 1.5 ? numericValue / 100 : numericValue;
}

function divOrNull(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return roundValue(a / b);
}

function formatNumber(value: number | null) {
  return formatFlexibleNumber(value, { empty: "-" });
}

function formatGrams(value: number | null) {
  if (value === null) return "-";
  return `${formatFlexibleNumber(value, { empty: "-" })} g`;
}

function formatPercent(value: number | null) {
  return formatPercentShared(value, { input: "ratio", empty: "-" });
}

function serializeFilters(filters: ComparisonSearchFilters) {
  return [
    filters.q,
    filters.area,
    filters.block,
    filters.variety,
    String(filters.limit),
  ].join("|");
}

function buildOption(row: ComparisonOptionQueryRow): ComparisonCycleOption | null {
  const cycleKey = cleanText(row.cycle_key);
  if (!cycleKey) return null;

  return {
    cycleKey,
    block: cleanText(row.parent_block),
    area: normalizeAreaDisplayName(row.area),
    variety: cleanText(row.variety),
    spType: cleanText(row.sp_type),
    spDate: row.sp_date,
    harvestStartDate: row.harvest_start_date,
    harvestEndDate: row.harvest_end_date,
    totalStems: roundValue(toNumber(row.total_stems) ?? 0),
  };
}

function normalizeSelectValue(value: string | undefined) {
  return encodeMultiSelectValue(decodeMultiSelectValue(value));
}

export function normalizeComparisonFilters(
  rawFilters: Partial<Record<keyof ComparisonSearchFilters, string | number | undefined>> = {},
): ComparisonSearchFilters {
  const limit = Number(rawFilters.limit ?? defaultComparisonFilters.limit);

  return {
    q: cleanText(typeof rawFilters.q === "string" ? rawFilters.q : null),
    area: normalizeSelectValue(typeof rawFilters.area === "string" ? rawFilters.area : undefined),
    block: cleanText(typeof rawFilters.block === "string" ? rawFilters.block : null),
    variety: normalizeSelectValue(typeof rawFilters.variety === "string" ? rawFilters.variety : undefined),
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 40) : defaultComparisonFilters.limit,
  };
}

async function loadComparisonFilterOptions(): Promise<ComparisonFilterOptions> {
  const result = await query<ComparisonFilterOptionsRow>(
    `
      select
        array(
          select distinct area_value
          from (
            select ${AREA_SQL} as area_value
            from ${CYCLE_PROFILE_SOURCE}
            where cycle_key is not null and cycle_key != ''
          ) areas
          where area_value is not null
          order by area_value
        ) as areas,
        array(
          select distinct block_value
          from (
            select nullif(parent_block, '') as block_value
            from ${CYCLE_PROFILE_SOURCE}
          ) blocks
          where block_value is not null
          order by block_value
        ) as blocks,
        array(
          select distinct variety_value
          from (
            select nullif(variety, '') as variety_value
            from ${CYCLE_PROFILE_SOURCE}
          ) varieties
          where variety_value is not null
          order by variety_value
        ) as varieties
    `,
  );

  return {
    areas: result.rows[0]?.areas ?? [],
    blocks: result.rows[0]?.blocks ?? [],
    varieties: result.rows[0]?.varieties ?? [],
  };
}

export async function getComparisonFilterOptions() {
  return cachedAsync("comparacion:filter-options", COMPARISON_OPTIONS_TTL_MS, loadComparisonFilterOptions);
}

function buildSearchWhere(filters: ComparisonSearchFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const selectedAreas = decodeMultiSelectValue(filters.area);
  const selectedVarieties = decodeMultiSelectValue(filters.variety);

  if (selectedAreas.length) {
    values.push(selectedAreas);
    conditions.push(`area = any($${values.length}::text[])`);
  }

  if (selectedVarieties.length) {
    values.push(selectedVarieties);
    conditions.push(`variety = any($${values.length}::text[])`);
  }

  if (filters.block) {
    values.push(`%${filters.block}%`);
    conditions.push(`parent_block ilike $${values.length}`);
  }

  if (filters.q) {
    values.push(`%${filters.q}%`);
    conditions.push(
      `concat_ws(' ', cycle_key, parent_block, area, variety, sp_type, coalesce(sp_date, ''), coalesce(harvest_start_date, '')) ilike $${values.length}`,
    );
  }

  return {
    whereClause: conditions.length ? `where ${conditions.join(" and ")}` : "",
    values,
  };
}

export async function searchComparisonCycles(
  rawFilters: Partial<Record<keyof ComparisonSearchFilters, string | number | undefined>> = {},
) {
  const filters = normalizeComparisonFilters(rawFilters);

  return cachedAsync(`comparacion:search:${serializeFilters(filters)}`, COMPARISON_SEARCH_TTL_MS, async () => {
    const { whereClause, values } = buildSearchWhere(filters);
    values.push(filters.limit);

    const result = await query<ComparisonOptionQueryRow>(
      `
        with base as (
          select distinct on (cp.cycle_key)
            cp.cycle_key,
            cp.parent_block,
            cp.variety,
            cp.sp_type,
            cp.sp_date,
            cp.harvest_start_date,
            cp.harvest_end_date,
            coalesce(feno.total_stems, 0) as total_stems
          from ${CYCLE_PROFILE_SOURCE} cp
          left join lateral (
            select sum(coalesce(stems_count, 0)) as total_stems
            from ${FENOGRAMA_SOURCE}
            where cycle_key = cp.cycle_key
          ) feno on true
          where cp.cycle_key is not null and cp.cycle_key != ''
          order by cp.cycle_key, cp.is_current desc, cp.valid_from desc nulls last
        ),
        cycles as (
          select
            nullif(cycle_key, '') as cycle_key,
            nullif(parent_block, '') as parent_block,
            ${AREA_SQL} as area,
            nullif(variety, '') as variety,
            nullif(sp_type, '') as sp_type,
            to_char(sp_date, 'YYYY-MM-DD') as sp_date,
            to_char(harvest_start_date, 'YYYY-MM-DD') as harvest_start_date,
            to_char(harvest_end_date, 'YYYY-MM-DD') as harvest_end_date,
            total_stems
          from base
        )
        select
          cycle_key,
          parent_block,
          area,
          variety,
          sp_type,
          sp_date,
          harvest_start_date,
          harvest_end_date,
          total_stems
        from cycles
        ${whereClause}
        order by
          harvest_start_date desc nulls last,
          sp_date desc nulls last,
          total_stems desc nulls last,
          cycle_key asc
        limit $${values.length}
      `,
      values,
    );

    return result.rows
      .map((row) => buildOption(row))
      .filter((row): row is ComparisonCycleOption => Boolean(row));
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeMetricValue(
  value: number | null,
  range: { min: number; max: number },
  preference: "higher" | "lower" | "neutral",
) {
  const safeValue = value ?? range.min;
  const boundedValue = clamp(safeValue, range.min, range.max);
  const span = range.max - range.min || 1;
  const rawShare = (boundedValue - range.min) / span;
  const adjustedShare = preference === "lower" ? 1 - rawShare : rawShare;
  return roundValue(adjustedShare * 100);
}

function buildMetric(
  key: string,
  label: string,
  leftValue: number | null,
  rightValue: number | null,
  formatter: (value: number | null) => string,
  options: {
    range: { min: number; max: number };
    preference: "higher" | "lower" | "neutral";
  },
): ComparisonMetric {
  const leftShare = normalizeMetricValue(leftValue, options.range, options.preference);
  const rightShare = normalizeMetricValue(rightValue, options.range, options.preference);
  const comparableLeft = leftValue ?? Number.NaN;
  const comparableRight = rightValue ?? Number.NaN;
  let winner: ComparisonMetric["winner"] = "neutral";

  if (options.preference !== "neutral") {
    if (
      Number.isNaN(comparableLeft)
      || Number.isNaN(comparableRight)
      || comparableLeft === comparableRight
    ) {
      winner = "tie";
    } else if (options.preference === "higher") {
      winner = comparableLeft > comparableRight ? "left" : "right";
    } else {
      winner = comparableLeft < comparableRight ? "left" : "right";
    }
  }

  return {
    key,
    label,
    leftValue,
    rightValue,
    leftDisplay: formatter(leftValue),
    rightDisplay: formatter(rightValue),
    leftShare,
    rightShare,
    winner,
  };
}

function mapSnapshot(row: ComparisonSnapshotQueryRow | undefined, fallback?: ComparisonCycleOption | null) {
  if (!row && !fallback) return null;

  const totalStems = roundValue(toNumber(row?.total_stems ?? fallback?.totalStems ?? null) ?? 0);
  const greenWeightKg = toNumber(row?.green_weight_kg ?? null);
  const postWeightKg  = toNumber(row?.post_weight_kg ?? null);
  const effectiveHours = toNumber(row?.effective_hours ?? null);
  const bedArea = toNumber(row?.bed_area ?? null);

  const cajasVerde  = greenWeightKg !== null ? roundValue(greenWeightKg / 10) : null;
  const cajasBlanco = postWeightKg  !== null ? roundValue(postWeightKg  / 10) : null;
  const pesoTalloG  = greenWeightKg !== null && totalStems > 0
    ? roundValue(greenWeightKg * 1000 / totalStems)
    : null;
  const camas30   = bedArea !== null && bedArea > 0 ? bedArea / 30 : null;
  const horasCaja = divOrNull(effectiveHours, cajasVerde);
  const cajasCama = divOrNull(cajasVerde, camas30);
  const horasCama = divOrNull(effectiveHours, camas30);

  return {
    cycleKey: cleanText(row?.cycle_key ?? fallback?.cycleKey ?? null),
    block: cleanText(row?.parent_block ?? fallback?.block ?? null),
    blockId: cleanText(row?.block_id ?? null),
    area: cleanText(row?.area ?? fallback?.area ?? null),
    variety: cleanText(row?.variety ?? fallback?.variety ?? null),
    spType: cleanText(row?.sp_type ?? fallback?.spType ?? null),
    spDate: row?.sp_date ?? fallback?.spDate ?? null,
    harvestStartDate: row?.harvest_start_date ?? fallback?.harvestStartDate ?? null,
    harvestEndDate: row?.harvest_end_date ?? fallback?.harvestEndDate ?? null,
    totalStems,
    validFrom: row?.valid_from ?? null,
    validTo: row?.valid_to ?? null,
    isCurrent: Boolean(row?.is_current),
    bedCount: toNumber(row?.bed_count ?? null),
    pambilesCount: toNumber(row?.pambiles_count ?? null),
    bedArea,
    programmedPlants: toNumber(row?.programmed_plants ?? null),
    cycleStartPlants: toNumber(row?.cycle_start_plants ?? null),
    currentPlants: toNumber(row?.current_plants ?? null),
    deadPlants: toNumber(row?.dead_plants ?? null),
    reseededPlants: toNumber(row?.reseeded_plants ?? null),
    availabilityVsScheduledPct: toPercentRatio(row?.availability_vs_scheduled_pct ?? null),
    availabilityVsInitialPct: toPercentRatio(row?.availability_vs_initial_pct ?? null),
    mortalityPct: toPercentRatio(row?.mortality_pct ?? null),
    cajasVerde,
    cajasBlanco,
    pesoTalloG,
    horasCaja,
    cajasCama,
    horasCama,
  } satisfies ComparisonCycleSnapshot;
}

export async function getComparisonPair(
  leftCycleKey: string,
  rightCycleKey: string,
): Promise<ComparisonPairPayload> {
  const normalizedLeft  = cleanText(leftCycleKey);
  const normalizedRight = cleanText(rightCycleKey);
  const cycleKeys = Array.from(new Set([normalizedLeft, normalizedRight].filter(Boolean)));

  if (cycleKeys.length < 2) {
    return { generatedAt: new Date().toISOString(), left: null, right: null, metrics: [], radar: [] };
  }

  return cachedAsync(
    `comparacion:pair:${cycleKeys.join("|")}`,
    COMPARISON_PAIR_TTL_MS,
    async () => {
      const [result, options] = await Promise.all([
        query<ComparisonSnapshotQueryRow>(
          `
            select distinct on (cp.cycle_key)
              cp.cycle_key,
              nullif(cp.parent_block, '') as parent_block,
              nullif(cp.block_id, '') as block_id,
              coalesce(nullif(plants.area_id, ''), meta.area) as area,
              nullif(cp.variety, '') as variety,
              nullif(cp.sp_type, '') as sp_type,
              meta.sp_date,
              meta.harvest_start_date,
              meta.harvest_end_date,
              to_char(cp.valid_from, 'YYYY-MM-DD') as valid_from,
              to_char(cp.valid_to, 'YYYY-MM-DD') as valid_to,
              cp.is_current,
              cp.bed_count,
              cp.pambiles_count,
              cp.bed_area,
              plants.programmed_plants,
              plants.cycle_start_plants,
              plants.current_plants,
              plants.dead_plants,
              plants.reseeded_plants,
              plants.availability_vs_scheduled_pct,
              plants.availability_vs_initial_pct,
              plants.mortality_pct,
              meta.total_stems,
              green_prod.green_weight_kg,
              post_prod.post_weight_kg,
              labor.effective_hours
            from slv.camp_dim_cycle_profile_scd2 cp
            left join lateral (
              select
                nullif(area_id, '') as area_id,
                initial_plants as programmed_plants,
                initial_plants_cycle as cycle_start_plants,
                final_plants_count as current_plants,
                dead_plants_count as dead_plants,
                reseed_plants_count as reseeded_plants,
                pct_availability_vs_scheduled_plants as availability_vs_scheduled_pct,
                pct_availability_vs_initial_plants as availability_vs_initial_pct,
                pct_mortality as mortality_pct
              from ${CYCLE_PLANTS_SOURCE}
              where cycle_key = cp.cycle_key
              order by valid_from desc nulls last
              limit 1
            ) plants on true
            left join lateral (
              select
                ${AREA_SQL} as area,
                to_char(sp_date, 'YYYY-MM-DD') as sp_date,
                to_char(harvest_start_date, 'YYYY-MM-DD') as harvest_start_date,
                to_char(harvest_end_date, 'YYYY-MM-DD') as harvest_end_date,
                sum(coalesce(stems_count, 0)) as total_stems
              from ${FENOGRAMA_SOURCE}
              where cycle_key = cp.cycle_key
              group by 1, 2, 3, 4
              order by harvest_start_date desc nulls last, sp_date desc nulls last
              limit 1
            ) meta on true
            left join lateral (
              select coalesce(sum(green_weight_kg), 0) as green_weight_kg
              from ${PROD_GREEN_SOURCE}
              where cycle_key = cp.cycle_key
            ) green_prod on true
            left join lateral (
              select coalesce(sum(post_weight_kg), 0) as post_weight_kg
              from ${PROD_POST_SOURCE}
              where cycle_key = cp.cycle_key
            ) post_prod on true
            left join lateral (
              select coalesce(sum(effective_hours), 0) as effective_hours
              from ${PROD_HOURS_SOURCE}
              where cycle_key = cp.cycle_key
            ) labor on true
            where cp.cycle_key = any($1::text[])
            order by
              cp.cycle_key,
              cp.is_current desc,
              cp.valid_from desc nulls last
          `,
          [cycleKeys],
        ),
        searchComparisonCycles({ limit: 40 }),
      ]);

      const rowsByCycleKey    = new Map(result.rows.map((row) => [row.cycle_key, row] as const));
      const optionsByCycleKey = new Map(options.map((option) => [option.cycleKey, option] as const));
      const left  = mapSnapshot(rowsByCycleKey.get(normalizedLeft),  optionsByCycleKey.get(normalizedLeft));
      const right = mapSnapshot(rowsByCycleKey.get(normalizedRight), optionsByCycleKey.get(normalizedRight));

      const metrics: ComparisonMetric[] = [
        buildMetric("totalStems", "Tallos",
          left?.totalStems ?? null, right?.totalStems ?? null,
          formatNumber, { range: { min: 0, max: 300000 }, preference: "higher" }),
        buildMetric("cajasVerde", "Cajas Verde",
          left?.cajasVerde ?? null, right?.cajasVerde ?? null,
          formatNumber, { range: { min: 0, max: 1100 }, preference: "higher" }),
        buildMetric("cajasBlanco", "Cajas Blanco",
          left?.cajasBlanco ?? null, right?.cajasBlanco ?? null,
          formatNumber, { range: { min: 0, max: 1100 }, preference: "higher" }),
        buildMetric("pesoTalloG", "Peso Tallo",
          left?.pesoTalloG ?? null, right?.pesoTalloG ?? null,
          formatGrams, { range: { min: 0, max: 50 }, preference: "higher" }),
        buildMetric("horasCaja", "Horas / Caja",
          left?.horasCaja ?? null, right?.horasCaja ?? null,
          formatNumber, { range: { min: 0, max: 5 }, preference: "lower" }),
        buildMetric("cajasCama", "Cajas / Cama",
          left?.cajasCama ?? null, right?.cajasCama ?? null,
          formatNumber, { range: { min: 0, max: 20 }, preference: "higher" }),
        buildMetric("horasCama", "Horas / Cama",
          left?.horasCama ?? null, right?.horasCama ?? null,
          formatNumber, { range: { min: 0, max: 100 }, preference: "lower" }),
        buildMetric("mortalityPct", "Mortandad",
          left?.mortalityPct ?? null, right?.mortalityPct ?? null,
          formatPercent, { range: { min: 0, max: 1.0 }, preference: "lower" }),
        buildMetric("availabilityVsScheduledPct", "Disp. vs Programadas",
          left?.availabilityVsScheduledPct ?? null, right?.availabilityVsScheduledPct ?? null,
          formatPercent, { range: { min: 0, max: 1.0 }, preference: "higher" }),
      ];

      const radar: ComparisonRadarPoint[] = metrics
        .filter((m) => RADAR_METRIC_KEYS.has(m.key))
        .map((m) => ({
          label: m.label,
          maxLabel: RADAR_MAX_LABELS[m.key] ?? "",
          left: m.leftShare,
          right: m.rightShare,
          leftDisplay: m.leftDisplay,
          rightDisplay: m.rightDisplay,
        }));

      return { generatedAt: new Date().toISOString(), left, right, metrics, radar };
    },
  );
}

export async function getComparisonDashboardData(): Promise<ComparisonDashboardData> {
  const [filterOptions, options] = await Promise.all([
    getComparisonFilterOptions(),
    searchComparisonCycles(defaultComparisonFilters),
  ]);

  const leftCycleKey  = options[0]?.cycleKey ?? null;
  const rightCycleKey = options[1]?.cycleKey ?? null;
  const comparison = leftCycleKey && rightCycleKey
    ? await getComparisonPair(leftCycleKey, rightCycleKey)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    filters: defaultComparisonFilters,
    filterOptions,
    options,
    leftCycleKey,
    rightCycleKey,
    comparison,
  };
}
