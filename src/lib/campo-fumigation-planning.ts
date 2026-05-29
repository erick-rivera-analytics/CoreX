import "server-only";

import crypto from "node:crypto";

import { listCurrentBodegaProducts } from "@/lib/bodega-masters";
import { queryCamp, withCampTransaction } from "@/lib/camp-db";
import {
  getDefaultDrenchTargetIsoWeekId,
  listDrenchWeekCalendarOptions,
  type DrenchWeekCalendarWeekOption,
} from "@/lib/drench-week-calendar";
import {
  FUMIGATION_PROGRAM_PROPOSAL_SEED,
  type FumigationProposalSeedApplication,
  type FumigationProposalSeedProgram,
  type FumigationProposalSeedSlot,
} from "@/lib/fumigation-program-proposal-seed";
import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";

const FUMIGATION_PLANNING_TTL_MS = 60 * 1000;
const PLAN_TABLE = "public.field_fumigation_week_block_plan_cur";
const PLAN_LOG_TABLE = "public.field_fumigation_week_block_plan_log";
const DEFAULT_LITERS_PER_BED = 4;

export type FumigationPlanKind = "REGULAR" | "DRON" | "LANZAS";

type PlanningBaseRow = {
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

type SavedPlanRow = {
  plan_id: string | null;
  iso_week_id: string | null;
  cycle_key: string | null;
  block_id: string | null;
  fumigation_kind: FumigationPlanKind | null;
  confirmed_at: string | Date | null;
  confirmed_by: string | null;
  updated_at: string | Date | null;
  actor_id: string | null;
};

export type CampoFumigationPlanningFilters = {
  isoWeekId: string;
  variety: string;
  areaId: string;
};

export type CampoFumigationPlanningLine = {
  lineOrder: number;
  productName: string;
  productCode: string | null;
  unitCode: string | null;
  quantityPerLiter: number | null;
  litersPerBed: number;
  litersTotal: number | null;
  quantityTotal: number | null;
};

export type CampoFumigationPlanningApplication = {
  applicationNumber: number;
  lineCount: number;
  lines: CampoFumigationPlanningLine[];
};

export type CampoFumigationPlanningRecipeSet = Partial<Record<FumigationPlanKind, CampoFumigationPlanningApplication[]>>;

export type CampoFumigationPlanningRow = {
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
  bedCount: number | null;
  litersPerBed: number;
  litersTotal: number | null;
  defaultKind: FumigationPlanKind;
  selectedKind: FumigationPlanKind;
  savedKind: FumigationPlanKind | null;
  savedAt: string | null;
  savedBy: string | null;
  recipesByKind: CampoFumigationPlanningRecipeSet;
};

export type CampoFumigationPlanningOptions = {
  isoWeeks: DrenchWeekCalendarWeekOption[];
  varieties: string[];
  areas: string[];
  defaultIsoWeekId: string;
  kinds: FumigationPlanKind[];
};

type PlanningChangeInput = {
  cycleKey: string;
  blockId: string;
  selectedKind: FumigationPlanKind;
  parentBlock?: string | null;
  areaId?: string | null;
  variety?: string | null;
  phenologicalWeek?: number | null;
};

declare global {
  var __dashboardCampoFumigationPlanningInitialized: boolean | undefined;
}

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

function resolveCanonicalProductName(name: string) {
  const normalized = normalizeLookupValue(name);
  return PRODUCT_NAME_ALIASES[normalized] ?? name;
}

async function ensureCampoFumigationPlanningTable() {
  await queryCamp(`
    create table if not exists ${PLAN_TABLE} (
      plan_id text primary key,
      iso_week_id text not null,
      cycle_key text not null,
      block_id text not null,
      parent_block text null,
      area_id text null,
      variety_code text not null,
      phenological_week integer not null,
      fumigation_kind text not null check (fumigation_kind in ('REGULAR', 'DRON', 'LANZAS')),
      default_kind text not null default 'REGULAR' check (default_kind in ('REGULAR', 'DRON', 'LANZAS')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      confirmed_at timestamptz null,
      confirmed_by text null,
      actor_id text null
    );

    alter table ${PLAN_TABLE}
      add column if not exists confirmed_at timestamptz null;

    alter table ${PLAN_TABLE}
      add column if not exists confirmed_by text null;

    create table if not exists ${PLAN_LOG_TABLE} (
      event_id text primary key,
      plan_id text null,
      iso_week_id text not null,
      cycle_key text not null,
      block_id text not null,
      parent_block text null,
      area_id text null,
      variety_code text not null,
      phenological_week integer not null,
      previous_kind text null check (previous_kind in ('REGULAR', 'DRON', 'LANZAS')),
      next_kind text not null check (next_kind in ('REGULAR', 'DRON', 'LANZAS')),
      default_kind text not null check (default_kind in ('REGULAR', 'DRON', 'LANZAS')),
      action_type text not null default 'UPSERT',
      actor_id text null,
      occurred_at timestamptz not null default now()
    );

    create unique index if not exists field_fumigation_week_block_plan_cur_uq
      on ${PLAN_TABLE} (iso_week_id, cycle_key);

    create index if not exists field_fumigation_week_block_plan_log_idx
      on ${PLAN_LOG_TABLE} (iso_week_id, cycle_key, occurred_at desc);
  `);

  global.__dashboardCampoFumigationPlanningInitialized = true;
}

function normalizeFilters(filters: Partial<CampoFumigationPlanningFilters>): CampoFumigationPlanningFilters {
  return {
    isoWeekId: String(filters.isoWeekId ?? "").trim(),
    variety: String(filters.variety ?? "").trim().toUpperCase(),
    areaId: String(filters.areaId ?? "").trim().toUpperCase(),
  };
}

async function buildBodegaProductMap() {
  const products = await listCurrentBodegaProducts();
  return new Map(products.map((product) => [normalizeLookupValue(product.productName), product]));
}

function buildProgramMap() {
  const programMap = new Map<string, FumigationProposalSeedProgram[]>();
  for (const program of FUMIGATION_PROGRAM_PROPOSAL_SEED) {
    const key = `${program.kind}|${normalizeRecipeVarietyCode(program.varietyCode)}`;
    const current = programMap.get(key) ?? [];
    current.push(program);
    programMap.set(key, current);
  }
  return programMap;
}

function resolveProgram(
  kind: FumigationPlanKind,
  variety: string,
  phenologicalWeek: number,
  isoWeekId: string,
  programMap: Map<string, FumigationProposalSeedProgram[]>,
) {
  const normalizedIsoWeekId = normalizeOperationalIsoWeekId(isoWeekId);
  const candidates = programMap.get(`${kind}|${normalizeRecipeVarietyCode(variety)}`) ?? [];
  for (const program of candidates) {
    if (
      phenologicalWeek < program.phenologicalStartWeek ||
      phenologicalWeek > program.phenologicalEndWeek
    ) {
      continue;
    }

    const matchedWeek = program.weeks.find((week) => (
      normalizeOperationalIsoWeekId(week.weekIso) === normalizedIsoWeekId
    )) ?? null;

    if (matchedWeek) {
      return matchedWeek.applications;
    }
  }

  return null;
}

function mapSeedSlotToLine(
  slot: FumigationProposalSeedSlot,
  lineOrder: number,
  litersPerBlock: number | null,
  productMap: Map<string, Awaited<ReturnType<typeof listCurrentBodegaProducts>>[number]>,
): CampoFumigationPlanningLine {
  const canonicalProductName = resolveCanonicalProductName(slot.productName);
  const product = productMap.get(normalizeLookupValue(canonicalProductName)) ?? null;
  const quantityPerLiter = Number(slot.quantity);
  const safeQuantity = Number.isFinite(quantityPerLiter) ? quantityPerLiter : null;
  const quantityTotal = safeQuantity !== null && litersPerBlock !== null
    ? safeQuantity * litersPerBlock
    : null;

  return {
    lineOrder,
    productName: product?.productName ?? canonicalProductName,
    productCode: product?.productCode ?? null,
    unitCode: product?.baseUnitCode ?? null,
    quantityPerLiter: safeQuantity,
    litersPerBed: DEFAULT_LITERS_PER_BED,
    litersTotal: litersPerBlock,
    quantityTotal,
  };
}

function mapApplications(
  applications: FumigationProposalSeedApplication[] | null,
  litersPerBlock: number | null,
  productMap: Map<string, Awaited<ReturnType<typeof listCurrentBodegaProducts>>[number]>,
): CampoFumigationPlanningApplication[] {
  if (!applications) {
    return [];
  }

  return applications.map((application) => ({
    applicationNumber: application.applicationNumber,
    lineCount: application.slots.length,
    lines: application.slots.map((slot, index) => mapSeedSlotToLine(slot, index + 1, litersPerBlock, productMap)),
  }));
}

async function listSavedPlanRows(isoWeekId: string) {
  await ensureCampoFumigationPlanningTable();
  const result = await queryCamp<SavedPlanRow>(
    `
      select
        plan_id,
        iso_week_id,
        cycle_key,
        block_id,
        fumigation_kind,
        confirmed_at,
        confirmed_by,
        updated_at,
        actor_id
      from ${PLAN_TABLE}
      where iso_week_id = $1
    `,
    [isoWeekId],
  );

  return new Map(
    result.rows.flatMap((row) => (
      row.cycle_key
        ? [[row.cycle_key, row] as const]
        : []
    )),
  );
}

export async function listCampoFumigationPlanningOptions(): Promise<CampoFumigationPlanningOptions> {
  const cacheKey = "campo-fumigation-planning:options";
  return cachedAsync(cacheKey, FUMIGATION_PLANNING_TTL_MS, async () => {
    const [weekOptions, defaultIsoWeekId, areaResult, varietyResult] = await Promise.all([
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
      query<{ variety: string | null }>(
        `
          select distinct variety
          from slv.camp_v_drench_week_calendar_cur
          where variety is not null and variety <> ''
          order by variety asc
        `,
      ),
    ]);

    return {
      isoWeeks: weekOptions.isoWeeks,
      varieties: varietyResult.rows.flatMap((row) => (row.variety ? [normalizeRecipeVarietyCode(row.variety)] : [])),
      areas: areaResult.rows.flatMap((row) => (row.area_id ? [row.area_id] : [])),
      defaultIsoWeekId,
      kinds: ["REGULAR", "DRON", "LANZAS"],
    };
  });
}

export async function listCampoFumigationPlanning(
  incomingFilters: Partial<CampoFumigationPlanningFilters> = {},
): Promise<CampoFumigationPlanningRow[]> {
  const normalized = normalizeFilters(incomingFilters);
  const resolvedIsoWeekId = normalized.isoWeekId || await getDefaultDrenchTargetIsoWeekId();
  const filters = { ...normalized, isoWeekId: resolvedIsoWeekId };

  const [baseResult, savedPlans, productMap] = await Promise.all([
    query<PlanningBaseRow>(
      `
        select
          cycle_key,
          block_id,
          parent_block,
          area_id,
          variety,
          sp_type,
          greenhouse,
          bed_count,
          cycle_type_code,
          cycle_type_label,
          to_char(sp_date, 'YYYY-MM-DD') as sp_date,
          iso_week_id,
          to_char(week_start_date, 'YYYY-MM-DD') as week_start_date,
          to_char(week_end_date, 'YYYY-MM-DD') as week_end_date,
          phenological_week
        from slv.camp_v_drench_week_calendar_cur
        where iso_week_id = $1
          and ($2 = '' or upper(trim(variety)) = $2)
          and ($3 = '' or upper(trim(coalesce(area_id, ''))) = $3)
        order by variety asc, block_id asc, cycle_key asc
      `,
      [filters.isoWeekId, filters.variety, filters.areaId],
    ),
    listSavedPlanRows(filters.isoWeekId),
    buildBodegaProductMap(),
  ]);

  const programMap = buildProgramMap();

  return baseResult.rows.flatMap((row) => {
    if (
      !row.cycle_key ||
      !row.block_id ||
      !row.variety ||
      !row.iso_week_id ||
      !row.week_start_date ||
      !row.week_end_date ||
      row.phenological_week === null
    ) {
      return [];
    }

    const saved = savedPlans.get(row.cycle_key) ?? null;
    const defaultKind: FumigationPlanKind = "REGULAR";
    const selectedKind = saved?.fumigation_kind ?? defaultKind;
    const normalizedVariety = normalizeRecipeVarietyCode(row.variety);
    const bedCount = row.bed_count === null ? null : Number(row.bed_count);
    const litersTotal = bedCount === null ? null : bedCount * DEFAULT_LITERS_PER_BED;

    const recipesByKind: CampoFumigationPlanningRecipeSet = {
      REGULAR: mapApplications(
        resolveProgram("REGULAR", normalizedVariety, row.phenological_week, row.iso_week_id, programMap),
        litersTotal,
        productMap,
      ),
      DRON: mapApplications(
        resolveProgram("DRON", normalizedVariety, row.phenological_week, row.iso_week_id, programMap),
        litersTotal,
        productMap,
      ),
      LANZAS: mapApplications(
        resolveProgram("LANZAS", normalizedVariety, row.phenological_week, row.iso_week_id, programMap),
        litersTotal,
        productMap,
      ),
    };

    return [{
      cycleKey: row.cycle_key,
      blockId: row.block_id,
      parentBlock: row.parent_block ?? null,
      areaId: row.area_id ?? null,
      greenhouse: row.greenhouse ?? null,
      variety: normalizedVariety,
      spType: row.sp_type ?? null,
      cycleTypeCode: row.cycle_type_code ?? null,
      cycleTypeLabel: row.cycle_type_label ?? null,
      spDate: row.sp_date ?? null,
      isoWeekId: row.iso_week_id,
      weekStartDate: row.week_start_date,
      weekEndDate: row.week_end_date,
      phenologicalWeek: row.phenological_week,
      bedCount,
      litersPerBed: DEFAULT_LITERS_PER_BED,
      litersTotal,
      defaultKind,
      selectedKind,
        savedKind: saved?.fumigation_kind ?? null,
        savedAt: saved?.updated_at ? new Date(saved.updated_at).toISOString() : null,
        savedBy: saved?.confirmed_by ?? saved?.actor_id ?? null,
        recipesByKind,
      }];
  });
}

export async function saveCampoFumigationPlanningChanges(input: {
  isoWeekId: string;
  actorId: string;
  changes: PlanningChangeInput[];
}) {
  await ensureCampoFumigationPlanningTable();

  const isoWeekId = String(input.isoWeekId ?? "").trim();
  const actorId = String(input.actorId ?? "").trim() || "system";
  const changes = input.changes.filter((change) => (
    change.cycleKey &&
    change.blockId &&
    (change.selectedKind === "REGULAR" || change.selectedKind === "DRON" || change.selectedKind === "LANZAS")
  ));

  if (!isoWeekId) {
    throw new Error("La semana ISO es obligatoria.");
  }

  if (!changes.length) {
    return { updatedCount: 0 };
  }

  await withCampTransaction(async (client) => {
    for (const change of changes) {
      const current = await client.query<{
        plan_id: string | null;
        fumigation_kind: FumigationPlanKind | null;
      }>(
        `
          select plan_id, fumigation_kind
          from ${PLAN_TABLE}
          where iso_week_id = $1 and cycle_key = $2
          limit 1
        `,
        [isoWeekId, change.cycleKey],
      );

      const existing = current.rows[0] ?? null;
      const planId = existing?.plan_id ?? `fum_plan_${crypto.randomUUID()}`;

      await client.query(
        `
          insert into ${PLAN_TABLE} (
            plan_id,
            iso_week_id,
            cycle_key,
            block_id,
            parent_block,
            area_id,
            variety_code,
            phenological_week,
            fumigation_kind,
            default_kind,
            actor_id,
            confirmed_at,
            confirmed_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'REGULAR', $10, now(), $10)
          on conflict (iso_week_id, cycle_key)
          do update set
            block_id = excluded.block_id,
            parent_block = excluded.parent_block,
            area_id = excluded.area_id,
            variety_code = excluded.variety_code,
            phenological_week = excluded.phenological_week,
            fumigation_kind = excluded.fumigation_kind,
            actor_id = excluded.actor_id,
            confirmed_at = now(),
            confirmed_by = excluded.confirmed_by,
            updated_at = now()
        `,
        [
          planId,
          isoWeekId,
          change.cycleKey,
          change.blockId,
          change.parentBlock ?? null,
          change.areaId ?? null,
          normalizeRecipeVarietyCode(change.variety ?? ""),
          change.phenologicalWeek ?? 0,
          change.selectedKind,
          actorId,
        ],
      );

      await client.query(
        `
          insert into ${PLAN_LOG_TABLE} (
            event_id,
            plan_id,
            iso_week_id,
            cycle_key,
            block_id,
            parent_block,
            area_id,
            variety_code,
            phenological_week,
            previous_kind,
            next_kind,
            default_kind,
            action_type,
            actor_id
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'REGULAR', $12, $13
          )
        `,
        [
          `fum_plan_log_${crypto.randomUUID()}`,
          planId,
          isoWeekId,
          change.cycleKey,
          change.blockId,
          change.parentBlock ?? null,
          change.areaId ?? null,
          normalizeRecipeVarietyCode(change.variety ?? ""),
          change.phenologicalWeek ?? 0,
          existing?.fumigation_kind ?? null,
          change.selectedKind,
          existing ? "UPDATE" : "CREATE",
          actorId,
        ],
      );
    }
  });

  return { updatedCount: changes.length };
}

export async function listCampoFumigationPlanKindMap(isoWeekId: string) {
  const saved = await listSavedPlanRows(isoWeekId);
  return new Map(
    [...saved.entries()].flatMap(([cycleKey, row]) => (
      row.fumigation_kind ? [[cycleKey, row.fumigation_kind] as const] : []
    )),
  );
}
