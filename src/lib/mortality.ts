import { query } from "@/lib/db";
import { decodeMultiSelectValue, encodeMultiSelectValue } from "@/lib/multi-select";
import { cachedAsync } from "@/lib/server-cache";
import { normalizeAreaDisplayName } from "@/shared/lib/area-normalization";
import { roundValue, toNumber } from "@/shared/lib/number-utils";

type MortalityDashboardQueryRow = {
  cycle_key: string;
  valid_from: string | null;
  valid_to: string | null;
  area: string | null;
  parent_block: string | null;
  block_id: string | null;
  variety: string | null;
  sp_type: string | null;
  initial_plants: string | number | null;
  dead_plants_count: string | number | null;
  reseed_plants_count: string | number | null;
  initial_plants_cycle: string | number | null;
  final_plants_count: string | number | null;
  pct_availability_vs_scheduled_plants: string | number | null;
  pct_availability_vs_initial_plants: string | number | null;
  pct_mortality: string | number | null;
};

type MortalityCurveQueryRow = {
  cycle_key: string;
  calendar_date: string | null;
  dead_plants_count: string | number | null;
  reseed_plants_count: string | number | null;
  initial_plants_cycle: string | number | null;
};

export type MortalityFilters = {
  area: string;
  spType: string;
  variety: string;
  parentBlock: string;
  block: string;
};

export type MortalityDashboardRow = {
  id: string;
  cycleKey: string;
  validFrom: string | null;
  validTo: string | null;
  area: string;
  parentBlock: string;
  block: string;
  variety: string;
  spType: string;
  initialPlants: number | null;
  deadPlantsCount: number | null;
  reseedPlantsCount: number | null;
  initialPlantsCycle: number | null;
  finalPlantsCount: number | null;
  availabilityVsScheduledPct: number | null;
  availabilityVsInitialPct: number | null;
  mortalityPct: number | null;
};

export type MortalityFilterOptions = {
  areas: string[];
  spTypes: string[];
  varieties: string[];
  parentBlocks: string[];
  blocks: string[];
};

export type MortalityDashboardData = {
  generatedAt: string;
  filters: MortalityFilters;
  options: MortalityFilterOptions;
  rows: MortalityDashboardRow[];
  summary: {
    totalCycles: number;
    totalDeadPlants: number;
    totalReseededPlants: number;
    totalFinalPlants: number;
    weightedMortalityPct: number | null;
  };
};

export type MortalityCurveEntityType = "aggregate" | "cycle" | "valve" | "bed";

export type MortalityCurvePoint = {
  calendarDate: string;
  eventDay: number;
  deadPlantsCount: number;
  reseedPlantsCount: number;
  dailyMortalityPct: number | null;
  cumulativeDeadPlants: number;
  cumulativeReseedPlants: number;
  cumulativeMortalityPct: number | null;
};

export type MortalityCurvePayload = {
  entityType: MortalityCurveEntityType;
  cycleKey: string;
  valveId: string | null;
  bedId: string | null;
  label: string;
  generatedAt: string;
  summary: {
    initialPlantsCycle: number;
    programmedPlants: number | null;
    totalDeadPlants: number;
    totalReseededPlants: number;
    lastDailyMortalityPct: number | null;
    lastCumulativeMortalityPct: number | null;
    maxDailyMortalityPct: number | null;
    totalDays: number;
  };
  points: MortalityCurvePoint[];
};

export const defaultMortalityFilters: MortalityFilters = {
  area: "all",
  spType: "all",
  variety: "all",
  parentBlock: "all",
  block: "all",
};

const CYCLE_MORTALITY_SOURCE = "gld.mv_camp_kardex_cycle_plants_cur";
const CYCLE_MORTALITY_DAY_SOURCE = "gld.mv_camp_kardex_cycle_plants_day_cur";
const VALVE_MORTALITY_DAY_SOURCE = "gld.mv_camp_kardex_valve_plants_day_cur";
const BED_MORTALITY_DAY_SOURCE = "gld.mv_camp_kardex_bed_plants_day_cur";
const BED_PLANTS_SOURCE = "gld.mv_camp_kardex_bed_plants_cur";
const MORTALITY_BASE_TTL_MS = 60 * 1000;
const MORTALITY_CURVE_TTL_MS = 60 * 1000;

const collator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
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

function sumNumbers(values: Array<number | null | undefined>) {
  return roundValue(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
}

function averageNumbers(values: Array<number | null | undefined>) {
  const normalizedValues = values.filter((value): value is number => value !== null && value !== undefined);

  if (!normalizedValues.length) {
    return null;
  }

  return roundValue(normalizedValues.reduce<number>((sum, value) => sum + value, 0) / normalizedValues.length);
}

function calculateWeightedMortalityPct(
  totalDeadPlants: number,
  totalInitialPlantsCycle: number,
  totalReseededPlants: number,
) {
  const denominator = totalInitialPlantsCycle + totalReseededPlants;
  return denominator > 0 ? roundValue((totalDeadPlants / denominator) * 100) : null;
}

function normalizeSelectValue(value: string | undefined) {
  return encodeMultiSelectValue(decodeMultiSelectValue(value));
}

function matchesFilter(filterValue: string, candidateValue: string) {
  const selectedValues = decodeMultiSelectValue(filterValue);

  if (!selectedValues.length) {
    return true;
  }

  return selectedValues.includes(candidateValue);
}

function buildMortalityRow(row: MortalityDashboardQueryRow): MortalityDashboardRow {
  return {
    id: row.cycle_key,
    cycleKey: cleanText(row.cycle_key),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    area: normalizeAreaDisplayName(row.area),
    parentBlock: cleanText(row.parent_block),
    block: cleanText(row.block_id),
    variety: cleanText(row.variety),
    spType: cleanText(row.sp_type),
    initialPlants: toNumber(row.initial_plants),
    deadPlantsCount: toNumber(row.dead_plants_count),
    reseedPlantsCount: toNumber(row.reseed_plants_count),
    initialPlantsCycle: toNumber(row.initial_plants_cycle),
    finalPlantsCount: toNumber(row.final_plants_count),
    availabilityVsScheduledPct: toPercent(row.pct_availability_vs_scheduled_plants),
    availabilityVsInitialPct: toPercent(row.pct_availability_vs_initial_plants),
    mortalityPct: toPercent(row.pct_mortality),
  };
}

async function loadMortalityBaseRows() {
  const result = await query<MortalityDashboardQueryRow>(
    `
      select distinct on (mp.cycle_key)
        mp.cycle_key,
        to_char(mp.valid_from, 'YYYY-MM-DD') as valid_from,
        to_char(mp.valid_to, 'YYYY-MM-DD') as valid_to,
        coalesce(nullif(mp.area_id, ''), nullif(split_part(mp.cycle_key, '-', 1), '')) as area,
        coalesce(
          nullif(cp.parent_block, ''),
          nullif(split_part(mp.cycle_key, '-', 2), '')
        ) as parent_block,
        coalesce(
          nullif(mp.block_id, ''),
          nullif(cp.block_id, ''),
          nullif(cp.parent_block, ''),
          nullif(split_part(mp.cycle_key, '-', 2), '')
        ) as block_id,
        nullif(mp.variety, '') as variety,
        nullif(mp.sp_type, '') as sp_type,
        mp.initial_plants,
        mp.dead_plants_count,
        mp.reseed_plants_count,
        mp.initial_plants_cycle,
        mp.final_plants_count,
        mp.pct_availability_vs_scheduled_plants,
        mp.pct_availability_vs_initial_plants,
        mp.pct_mortality
      from ${CYCLE_MORTALITY_SOURCE} mp
      left join lateral (
        select
          cp.parent_block,
          cp.block_id
        from slv.camp_dim_cycle_profile_scd2 cp
        where cp.cycle_key = mp.cycle_key
        order by
          cp.is_current desc,
          cp.valid_from desc nulls last
        limit 1
      ) cp on true
      order by
        mp.cycle_key,
        mp.valid_from desc nulls last,
        mp.valid_to desc nulls last
    `,
  );

  return result.rows.map(buildMortalityRow);
}

async function getMortalityBaseRows() {
  return cachedAsync("mortality:base-rows", MORTALITY_BASE_TTL_MS, loadMortalityBaseRows);
}

function buildMortalityOptions(rows: MortalityDashboardRow[]): MortalityFilterOptions {
  const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((left, right) => collator.compare(left, right));

  return {
    areas: uniqueValues(rows.map((row) => row.area)),
    spTypes: uniqueValues(rows.map((row) => row.spType)),
    varieties: uniqueValues(rows.map((row) => row.variety)),
    parentBlocks: uniqueValues(rows.map((row) => row.parentBlock)),
    blocks: uniqueValues(rows.map((row) => row.block)),
  };
}

function filterMortalityRows(rows: MortalityDashboardRow[], filters: MortalityFilters) {
  return rows
    .filter((row) => matchesFilter(filters.area, row.area))
    .filter((row) => matchesFilter(filters.spType, row.spType))
    .filter((row) => matchesFilter(filters.variety, row.variety))
    .filter((row) => matchesFilter(filters.parentBlock, row.parentBlock))
    .filter((row) => matchesFilter(filters.block, row.block))
    .sort((left, right) => {
      const mortalityComparison = (right.mortalityPct ?? -1) - (left.mortalityPct ?? -1);

      if (mortalityComparison !== 0) {
        return mortalityComparison;
      }

      const parentBlockComparison = collator.compare(left.parentBlock, right.parentBlock);

      if (parentBlockComparison !== 0) {
        return parentBlockComparison;
      }

      const blockComparison = collator.compare(left.block, right.block);

      if (blockComparison !== 0) {
        return blockComparison;
      }

      return collator.compare(left.cycleKey, right.cycleKey);
    });
}

export function normalizeMortalityFilters(input: Partial<Record<keyof MortalityFilters, string | undefined>>) {
  return {
    area: normalizeSelectValue(input.area),
    spType: normalizeSelectValue(input.spType),
    variety: normalizeSelectValue(input.variety),
    parentBlock: normalizeSelectValue(input.parentBlock),
    block: normalizeSelectValue(input.block),
  } satisfies MortalityFilters;
}

export async function getMortalityDashboardData(filters: MortalityFilters): Promise<MortalityDashboardData> {
  const rows = await getMortalityBaseRows();
  const filteredRows = filterMortalityRows(rows, filters);
  const totalDeadPlants = sumNumbers(filteredRows.map((row) => row.deadPlantsCount));
  const totalReseededPlants = sumNumbers(filteredRows.map((row) => row.reseedPlantsCount));
  const totalInitialPlantsCycle = sumNumbers(filteredRows.map((row) => row.initialPlantsCycle));

  return {
    generatedAt: new Date().toISOString(),
    filters,
    options: buildMortalityOptions(rows),
    rows: filteredRows,
    summary: {
      totalCycles: filteredRows.length,
      totalDeadPlants,
      totalReseededPlants,
      totalFinalPlants: sumNumbers(filteredRows.map((row) => row.finalPlantsCount)),
      weightedMortalityPct: calculateWeightedMortalityPct(
        totalDeadPlants,
        totalInitialPlantsCycle,
        totalReseededPlants,
      ),
    },
  };
}

function buildMortalityCurvePoints(rows: MortalityCurveQueryRow[]) {
  const initialPlantsCycle = rows
    .map((row) => toNumber(row.initial_plants_cycle))
    .find((value): value is number => value !== null) ?? 0;

  let cumulativeDeadPlants = 0;
  let cumulativeReseedPlants = 0;

  const points = rows.map((row, index) => {
    const deadPlantsCount = toNumber(row.dead_plants_count) ?? 0;
    const reseedPlantsCount = toNumber(row.reseed_plants_count) ?? 0;
    cumulativeDeadPlants = roundValue(cumulativeDeadPlants + deadPlantsCount);
    cumulativeReseedPlants = roundValue(cumulativeReseedPlants + reseedPlantsCount);

    const dailyBase = initialPlantsCycle + reseedPlantsCount;
    const cumulativeBase = initialPlantsCycle + cumulativeReseedPlants;
    const dailyMortalityPct = dailyBase > 0 ? roundValue((deadPlantsCount / dailyBase) * 100) : null;
    const cumulativeMortalityPct = cumulativeBase > 0 ? roundValue((cumulativeDeadPlants / cumulativeBase) * 100) : null;

    return {
      calendarDate: row.calendar_date ?? "",
      eventDay: index + 1,
      deadPlantsCount,
      reseedPlantsCount,
      dailyMortalityPct,
      cumulativeDeadPlants,
      cumulativeReseedPlants,
      cumulativeMortalityPct,
    } satisfies MortalityCurvePoint;
  });

  return {
    initialPlantsCycle,
    points,
  };
}

async function loadMortalityCurve(
  key: string,
  source: string,
  whereClause: string,
  values: unknown[],
  meta: {
    entityType: MortalityCurveEntityType;
    cycleKey: string;
    valveId?: string | null;
    bedId?: string | null;
    label: string;
  },
) {
  return cachedAsync(key, MORTALITY_CURVE_TTL_MS, async () => {
    const [result, programmedResult] = await Promise.all([
      query<MortalityCurveQueryRow>(
        `
          select
            cycle_key,
            to_char(calendar_date::date, 'YYYY-MM-DD') as calendar_date,
            coalesce(dead_plants_count, 0) as dead_plants_count,
            coalesce(reseed_plants_count, 0) as reseed_plants_count,
            coalesce(initial_plants_cycle, 0) as initial_plants_cycle
          from ${source}
          ${whereClause}
          order by calendar_date asc
        `,
        values,
      ),
      query<{ total: string | number }>(
        `select coalesce(sum(initial_plants), 0) as total from ${BED_PLANTS_SOURCE} where cycle_key = $1`,
        [meta.cycleKey],
      ),
    ]);

    const programmedPlants = toNumber(programmedResult.rows[0]?.total) ?? null;
    const { initialPlantsCycle, points } = buildMortalityCurvePoints(result.rows);
    const lastPoint = points[points.length - 1] ?? null;

    return {
      entityType: meta.entityType,
      cycleKey: meta.cycleKey,
      valveId: meta.valveId ?? null,
      bedId: meta.bedId ?? null,
      label: meta.label,
      generatedAt: new Date().toISOString(),
      summary: {
        initialPlantsCycle,
        programmedPlants,
        totalDeadPlants: sumNumbers(points.map((point) => point.deadPlantsCount)),
        totalReseededPlants: sumNumbers(points.map((point) => point.reseedPlantsCount)),
        lastDailyMortalityPct: lastPoint?.dailyMortalityPct ?? null,
        lastCumulativeMortalityPct: lastPoint?.cumulativeMortalityPct ?? null,
        maxDailyMortalityPct: averageNumbers(
          points.length
            ? [Math.max(...points.map((point) => point.dailyMortalityPct ?? 0))]
            : [],
        ),
        totalDays: points.length,
      },
      points,
    } satisfies MortalityCurvePayload;
  });
}

export async function getAggregatedMortalityCurve(
  filters: MortalityFilters,
): Promise<MortalityCurvePayload> {
  const baseRows = await getMortalityBaseRows();
  const filteredRows = filterMortalityRows(baseRows, filters);
  const cycleKeys = filteredRows.map((row) => row.cycleKey);
  const totalInitialPlantsCycle = sumNumbers(filteredRows.map((row) => row.initialPlantsCycle));

  if (!cycleKeys.length) {
    return {
      entityType: "aggregate",
      cycleKey: "",
      valveId: null,
      bedId: null,
      label: "Vista filtrada",
      generatedAt: new Date().toISOString(),
      summary: {
        initialPlantsCycle: 0,
        programmedPlants: null,
        totalDeadPlants: 0,
        totalReseededPlants: 0,
        lastDailyMortalityPct: null,
        lastCumulativeMortalityPct: null,
        maxDailyMortalityPct: null,
        totalDays: 0,
      },
      points: [],
    };
  }

  return cachedAsync(
    `mortality:aggregate:${[
      filters.area,
      filters.spType,
      filters.variety,
      filters.parentBlock,
      filters.block,
    ].join("|")}`,
    MORTALITY_CURVE_TTL_MS,
    async () => {
      const result = await query<MortalityCurveQueryRow>(
        `
          select
            cycle_key,
            to_char(calendar_date::date, 'YYYY-MM-DD') as calendar_date,
            coalesce(dead_plants_count, 0) as dead_plants_count,
            coalesce(reseed_plants_count, 0) as reseed_plants_count,
            coalesce(initial_plants_cycle, 0) as initial_plants_cycle
          from ${CYCLE_MORTALITY_DAY_SOURCE}
          where cycle_key = any($1::text[])
          order by cycle_key asc, calendar_date asc
        `,
        [cycleKeys],
      );

      const initialPlantsByCycle = new Map(
        filteredRows.map((row) => [row.cycleKey, row.initialPlantsCycle ?? 0] as const),
      );
      const cycleDayCounter = new Map<string, number>();
      const dayBuckets = new Map<number, {
        eventDay: number;
        minDate: string | null;
        maxDate: string | null;
        deadPlantsCount: number;
        reseedPlantsCount: number;
        cycleKeys: Set<string>;
      }>();

      for (const row of result.rows) {
        const cycleKey = cleanText(row.cycle_key);
        const eventDay = (cycleDayCounter.get(cycleKey) ?? 0) + 1;
        cycleDayCounter.set(cycleKey, eventDay);

        const bucket = dayBuckets.get(eventDay) ?? {
          eventDay,
          minDate: row.calendar_date,
          maxDate: row.calendar_date,
          deadPlantsCount: 0,
          reseedPlantsCount: 0,
          cycleKeys: new Set<string>(),
        };

        bucket.minDate = !bucket.minDate || (row.calendar_date && row.calendar_date < bucket.minDate)
          ? row.calendar_date
          : bucket.minDate;
        bucket.maxDate = !bucket.maxDate || (row.calendar_date && row.calendar_date > bucket.maxDate)
          ? row.calendar_date
          : bucket.maxDate;
        bucket.deadPlantsCount = roundValue(bucket.deadPlantsCount + (toNumber(row.dead_plants_count) ?? 0));
        bucket.reseedPlantsCount = roundValue(bucket.reseedPlantsCount + (toNumber(row.reseed_plants_count) ?? 0));
        bucket.cycleKeys.add(cycleKey);
        dayBuckets.set(eventDay, bucket);
      }

      let cumulativeDeadPlants = 0;
      let cumulativeReseedPlants = 0;
      const seenCycles = new Set<string>();
      const points = Array.from(dayBuckets.values())
        .sort((left, right) => left.eventDay - right.eventDay)
        .map((bucket) => {
          bucket.cycleKeys.forEach((cycleKey) => seenCycles.add(cycleKey));
          cumulativeDeadPlants = roundValue(cumulativeDeadPlants + bucket.deadPlantsCount);
          cumulativeReseedPlants = roundValue(cumulativeReseedPlants + bucket.reseedPlantsCount);

          const dailyInitialPlants = Array.from(bucket.cycleKeys).reduce<number>(
            (sum, cycleKey) => sum + (initialPlantsByCycle.get(cycleKey) ?? 0),
            0,
          );
          const cumulativeInitialPlants = Array.from(seenCycles).reduce<number>(
            (sum, cycleKey) => sum + (initialPlantsByCycle.get(cycleKey) ?? 0),
            0,
          );
          const dailyBase = dailyInitialPlants + bucket.reseedPlantsCount;
          const cumulativeBase = cumulativeInitialPlants + cumulativeReseedPlants;

          return {
            calendarDate: bucket.minDate && bucket.maxDate && bucket.minDate !== bucket.maxDate
              ? `${bucket.minDate} -> ${bucket.maxDate}`
              : bucket.minDate ?? bucket.maxDate ?? "",
            eventDay: bucket.eventDay,
            deadPlantsCount: bucket.deadPlantsCount,
            reseedPlantsCount: bucket.reseedPlantsCount,
            dailyMortalityPct: dailyBase > 0 ? roundValue((bucket.deadPlantsCount / dailyBase) * 100) : null,
            cumulativeDeadPlants,
            cumulativeReseedPlants,
            cumulativeMortalityPct: cumulativeBase > 0 ? roundValue((cumulativeDeadPlants / cumulativeBase) * 100) : null,
          } satisfies MortalityCurvePoint;
        });

      const lastPoint = points[points.length - 1] ?? null;

      return {
        entityType: "aggregate",
        cycleKey: "",
        valveId: null,
        bedId: null,
        label: "Vista filtrada",
        generatedAt: new Date().toISOString(),
        summary: {
          initialPlantsCycle: totalInitialPlantsCycle,
          programmedPlants: sumNumbers(filteredRows.map((row) => row.initialPlants)),
          totalDeadPlants: sumNumbers(points.map((point) => point.deadPlantsCount)),
          totalReseededPlants: sumNumbers(points.map((point) => point.reseedPlantsCount)),
          lastDailyMortalityPct: lastPoint?.dailyMortalityPct ?? null,
          lastCumulativeMortalityPct: lastPoint?.cumulativeMortalityPct ?? null,
          maxDailyMortalityPct: points.length
            ? Math.max(...points.map((point) => point.dailyMortalityPct ?? 0))
            : null,
          totalDays: points.length,
        },
        points,
      } satisfies MortalityCurvePayload;
    },
  );
}

export async function getCycleMortalityCurveByCycleKey(cycleKey: string) {
  const normalizedCycleKey = cycleKey.trim();

  return loadMortalityCurve(
    `mortality:cycle:${normalizedCycleKey}`,
    CYCLE_MORTALITY_DAY_SOURCE,
    "where cycle_key = $1",
    [normalizedCycleKey],
    {
      entityType: "cycle",
      cycleKey: normalizedCycleKey,
      label: normalizedCycleKey,
    },
  );
}

export async function getValveMortalityCurveByCycleAndValve(cycleKey: string, valveId: string) {
  const normalizedCycleKey = cycleKey.trim();
  const normalizedValveId = valveId.trim();

  return loadMortalityCurve(
    `mortality:valve:${normalizedCycleKey}:${normalizedValveId}`,
    VALVE_MORTALITY_DAY_SOURCE,
    "where cycle_key = $1 and valve_id = $2",
    [normalizedCycleKey, normalizedValveId],
    {
      entityType: "valve",
      cycleKey: normalizedCycleKey,
      valveId: normalizedValveId,
      label: normalizedValveId,
    },
  );
}

export async function getBedMortalityCurveByCycleAndBed(cycleKey: string, bedId: string) {
  const normalizedCycleKey = cycleKey.trim();
  const normalizedBedId = bedId.trim();

  return loadMortalityCurve(
    `mortality:bed:${normalizedCycleKey}:${normalizedBedId}`,
    BED_MORTALITY_DAY_SOURCE,
    "where cycle_key = $1 and bed_id = $2",
    [normalizedCycleKey, normalizedBedId],
    {
      entityType: "bed",
      cycleKey: normalizedCycleKey,
      bedId: normalizedBedId,
      label: normalizedBedId,
    },
  );
}
