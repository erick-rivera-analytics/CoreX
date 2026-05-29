import "server-only";

import { listCurrentBodegaProducts } from "@/lib/bodega-masters";
import { listCampoFumigationPlanKindMap, type FumigationPlanKind } from "@/lib/campo-fumigation-planning";
import {
  getDefaultDrenchTargetIsoWeekId,
  listDrenchWeekCalendarOptions,
  type DrenchWeekCalendarWeekOption,
} from "@/lib/drench-week-calendar";
import {
  FUMIGATION_PROGRAM_PROPOSAL_SEED,
  type FumigationProposalSeedProgram,
  type FumigationProposalSeedSlot,
} from "@/lib/fumigation-program-proposal-seed";
import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";

const FUMIGATION_WEEK_PROGRAM_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LITERS_PER_BED = 4;

const PRODUCT_NAME_ALIASES: Record<string, string> = {
  ANTRACOL: "ANTRACOL 70% PM",
  FITORAZ: "FITORAZ 76 PM",
  FULMINATE: "FULMINANTE",
  PREVICUR: "PREVICUR N",
  CORRIDABUL: "CORRIDA BUL",
  DANTHOTSU: "DANTOTSU 500",
  POLYRAM: "POLYRAM 80%",
  "NIT. CA": "NITRATO DE CALCIO",
  "NIT. MG": "NITRATO DE MAGNESIO",
  "SULF DE K": "SULFATO DE POTASIO AGRICOLA",
  "NITROFOSKA 8-12-24": "NITROFOSKA AZUL 12-12-17+2",
  "METALOZATO DE CALCIO": "METALOSATO DE CALCIO",
  "TRACKING CA-B": "TRAKING CA-B",
  DACONIL: "DACONIL 720",
  AMISTAR: "AMISTAR TOP",
  ORTHENE: "ORTHENE 75%",
  POLO: "POLO 250 8C",
  KARATE: "KARATE ZEON",
  AVISO: "AVISO DF",
  TIFLO: "TIFLO 42",
  ROVRAL: "ROVRAL 50% POLVO",
  "SIVANTO PRIME 200 SL": "SIVANTO",
};

type FumigationWeekProgramQueryRow = {
  cycle_key: string | null;
  block_id: string | null;
  parent_block: string | null;
  area_id: string | null;
  variety: string | null;
  sp_type: string | null;
  greenhouse: string | null;
  bed_count: number | string | null;
  cycle_type_code: string | null;
  cycle_type_label: string | null;
  sp_date: string | null;
  iso_week_id: string | null;
  week_start_date: string | null;
  week_end_date: string | null;
  phenological_week: number | null;
};

export type FumigationWeekProgramFilters = {
  isoWeekId: string;
  kind: "" | "REGULAR" | "DRON" | "LANZAS";
  variety: string;
  areaId: string;
};

export type FumigationWeekProgramLine = {
  lineOrder: number;
  productName: string;
  productCode: string | null;
  unitCode: string | null;
  dosePerLiter: number | null;
  litersPerBed: number;
  litersTotal: number | null;
  quantityTotal: number | null;
  categoryLeafName: string | null;
};

export type FumigationWeekProgramApplication = {
  applicationNumber: number;
  lineCount: number;
  lines: FumigationWeekProgramLine[];
};

export type FumigationWeekProgramRow = {
  cycleKey: string;
  blockId: string;
  parentBlock: string | null;
  areaId: string | null;
  greenhouse: string | null;
  variety: string;
  spType: string | null;
  cycleTypeCode: string | null;
  cycleTypeLabel: string | null;
  spDate: string | null;
  isoWeekId: string;
  weekStartDate: string;
  weekEndDate: string;
  phenologicalWeek: number;
  fumigationKind: "REGULAR" | "DRON" | "LANZAS";
  programTitle: string | null;
  bedCount: number | null;
  litersPerBed: number;
  litersTotal: number | null;
  recipeResolved: boolean;
  applications: FumigationWeekProgramApplication[];
};

export type FumigationWeekProgramOptions = {
  isoWeeks: DrenchWeekCalendarWeekOption[];
  kinds: Array<"REGULAR" | "DRON" | "LANZAS">;
  varieties: string[];
  areas: string[];
  defaultIsoWeekId: string;
};

function normalizeLookupValue(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeRecipeVarietyCode(value: string) {
  const normalized = normalizeLookupValue(value);
  if (normalized === "XLE" || normalized === "XL") return "XLENCE";
  if (normalized === "CLO" || normalized === "CLD") return "CLOUD";
  return normalized;
}

function normalizeOperationalIsoWeekId(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const dashed = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (dashed) {
    const year = Number(dashed[1]) % 100;
    const week = Number(dashed[2]);
    return `${String(year).padStart(2, "0")}${String(week).padStart(2, "0")}`;
  }

  if (/^\d{6}$/.test(raw)) {
    return raw.slice(2);
  }

  return raw;
}

function normalizeFilters(filters: Partial<FumigationWeekProgramFilters>): FumigationWeekProgramFilters {
  return {
    isoWeekId: String(filters.isoWeekId ?? "").trim(),
    kind: String(filters.kind ?? "").trim().toUpperCase() as FumigationWeekProgramFilters["kind"],
    variety: String(filters.variety ?? "").trim().toUpperCase(),
    areaId: String(filters.areaId ?? "").trim().toUpperCase(),
  };
}

function mapFumigationRow(row: FumigationWeekProgramQueryRow): FumigationWeekProgramRow | null {
  if (
    !row.cycle_key ||
    !row.block_id ||
    !row.variety ||
    !row.iso_week_id ||
    !row.week_start_date ||
    !row.week_end_date ||
    row.phenological_week === null
  ) {
    return null;
  }

  return {
    cycleKey: row.cycle_key,
    blockId: row.block_id,
    parentBlock: row.parent_block ?? null,
    areaId: row.area_id ?? null,
    greenhouse: row.greenhouse ?? null,
    variety: normalizeRecipeVarietyCode(row.variety),
    spType: row.sp_type ?? null,
    cycleTypeCode: row.cycle_type_code ?? null,
    cycleTypeLabel: row.cycle_type_label ?? null,
    spDate: row.sp_date ?? null,
    isoWeekId: row.iso_week_id,
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    phenologicalWeek: row.phenological_week,
    fumigationKind: "REGULAR",
    programTitle: null,
    bedCount: row.bed_count === null ? null : Number(row.bed_count),
    litersPerBed: DEFAULT_LITERS_PER_BED,
    litersTotal: row.bed_count === null ? null : Number(row.bed_count) * DEFAULT_LITERS_PER_BED,
    recipeResolved: false,
    applications: [],
  };
}

function resolveCanonicalProductName(name: string) {
  const normalized = normalizeLookupValue(name);
  return PRODUCT_NAME_ALIASES[normalized] ?? name;
}

async function buildBodegaProductMap() {
  const products = await listCurrentBodegaProducts();
  return new Map(
    products.map((product) => [normalizeLookupValue(product.productName), product]),
  );
}

function resolveProgramForRow(
  row: FumigationWeekProgramRow,
  programMap: Map<string, FumigationProposalSeedProgram[]>,
) {
  const candidates = programMap.get(`${row.fumigationKind}|${row.variety}`) ?? [];
  const normalizedIsoWeekId = normalizeOperationalIsoWeekId(row.isoWeekId);

  for (const program of candidates) {
    if (
      row.phenologicalWeek < program.phenologicalStartWeek ||
      row.phenologicalWeek > program.phenologicalEndWeek
    ) {
      continue;
    }

    const hasWeek = program.weeks.some((week) => (
      normalizeOperationalIsoWeekId(week.weekIso) === normalizedIsoWeekId
    ));

    if (hasWeek) {
      return program;
    }
  }

  return null;
}

function mapSeedSlotToLine(
  slot: FumigationProposalSeedSlot,
  lineOrder: number,
  litersPerBlock: number | null,
  bodegaProductMap: Map<string, Awaited<ReturnType<typeof listCurrentBodegaProducts>>[number]>,
): FumigationWeekProgramLine {
  const canonicalProductName = resolveCanonicalProductName(slot.productName);
  const product = bodegaProductMap.get(normalizeLookupValue(canonicalProductName)) ?? null;
  const dosePerLiter = Number(slot.quantity);
  const safeDose = Number.isFinite(dosePerLiter) ? dosePerLiter : null;
  const quantityTotal = safeDose !== null && litersPerBlock !== null
    ? safeDose * litersPerBlock
    : null;

  return {
    lineOrder,
    productName: product?.productName ?? canonicalProductName,
    productCode: product?.productCode ?? null,
    unitCode: product?.baseUnitCode ?? null,
    dosePerLiter: safeDose,
    litersPerBed: DEFAULT_LITERS_PER_BED,
    litersTotal: litersPerBlock,
    quantityTotal,
    categoryLeafName: product?.categoryLeafName ?? null,
  };
}

async function buildProgramRows(
  filters: FumigationWeekProgramFilters,
): Promise<FumigationWeekProgramRow[]> {
  const result = await query<FumigationWeekProgramQueryRow>(
    `
      select
        cal.cycle_key,
        cal.block_id,
        cal.parent_block,
        cal.area_id,
        cal.variety,
        cal.sp_type,
        cal.greenhouse,
        cal.bed_count,
        cal.cycle_type_code,
        cal.cycle_type_label,
        to_char(cal.sp_date, 'YYYY-MM-DD') as sp_date,
        cal.iso_week_id,
        to_char(cal.week_start_date, 'YYYY-MM-DD') as week_start_date,
        to_char(cal.week_end_date, 'YYYY-MM-DD') as week_end_date,
        cal.phenological_week
      from slv.camp_v_drench_week_calendar_cur cal
      where cal.iso_week_id = $1
        and ($2 = '' or upper(trim(cal.variety)) = $2)
        and ($3 = '' or upper(trim(coalesce(cal.area_id, ''))) = $3)
      order by cal.variety asc, cal.block_id asc, cal.cycle_key asc
    `,
    [filters.isoWeekId, filters.variety, filters.areaId],
  );

  const [bodegaProductMap, seedPrograms, savedKindMap] = await Promise.all([
    buildBodegaProductMap(),
    Promise.resolve(FUMIGATION_PROGRAM_PROPOSAL_SEED),
    listCampoFumigationPlanKindMap(filters.isoWeekId),
  ]);

  const programMap = new Map<string, FumigationProposalSeedProgram[]>();
  for (const program of seedPrograms) {
    const key = `${program.kind}|${normalizeRecipeVarietyCode(program.varietyCode)}`;
    const existing = programMap.get(key) ?? [];
    existing.push(program);
    programMap.set(key, existing);
  }

  return result.rows.flatMap((row) => {
    const mapped = mapFumigationRow(row);
    if (!mapped) return [];

    const effectiveKind = (savedKindMap.get(mapped.cycleKey) ?? "REGULAR") as FumigationPlanKind;
    const mappedWithSelectedKind: FumigationWeekProgramRow = {
      ...mapped,
      fumigationKind: effectiveKind,
    };

    if (filters.kind && effectiveKind !== filters.kind) {
      return [];
    }

    const matchedProgram = resolveProgramForRow(mappedWithSelectedKind, programMap);
    const matchedWeek = matchedProgram?.weeks.find((week) => (
      normalizeOperationalIsoWeekId(week.weekIso) === normalizeOperationalIsoWeekId(mapped.isoWeekId)
    )) ?? null;

    if (!matchedProgram || !matchedWeek) {
      return [mappedWithSelectedKind];
    }

    return [{
      ...mappedWithSelectedKind,
      programTitle: matchedProgram.title,
      recipeResolved: true,
      applications: matchedWeek.applications.map((application) => ({
        applicationNumber: application.applicationNumber,
        lineCount: application.slots.length,
        lines: application.slots.map((slot, index) => (
          mapSeedSlotToLine(slot, index + 1, mapped.litersTotal, bodegaProductMap)
        )),
      })),
    }];
  });
}

export async function listFumigationWeekProgramOptions(): Promise<FumigationWeekProgramOptions> {
  const cacheKey = "fumigation-week-program:options";
  return cachedAsync(cacheKey, FUMIGATION_WEEK_PROGRAM_TTL_MS, async () => {
    const [weekOptions, defaultIsoWeekId, areaResult] = await Promise.all([
      listDrenchWeekCalendarOptions(),
      getDefaultDrenchTargetIsoWeekId(),
      query<{ area_id: string | null }>(
        `
          select distinct area_id
          from slv.camp_v_drench_week_calendar_cur
          where area_id is not null and area_id <> ''
          order by area_id asc
        `,
      ),
    ]);

    return {
      isoWeeks: weekOptions.isoWeeks,
      kinds: ["REGULAR", "DRON", "LANZAS"],
      varieties: ["CLOUD", "XLENCE"],
      areas: areaResult.rows.flatMap((row) => (row.area_id ? [row.area_id] : [])),
      defaultIsoWeekId,
    };
  });
}

export async function listFumigationWeekProgram(
  incomingFilters: Partial<FumigationWeekProgramFilters> = {},
): Promise<FumigationWeekProgramRow[]> {
  const normalized = normalizeFilters(incomingFilters);
  const resolvedIsoWeekId = normalized.isoWeekId || await getDefaultDrenchTargetIsoWeekId();
  const filters = { ...normalized, isoWeekId: resolvedIsoWeekId };
  return buildProgramRows(filters);
}
