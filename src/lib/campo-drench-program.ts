import crypto from "node:crypto";

import type { PoolClient, QueryResultRow } from "pg";

import { queryCamp, withCampTransaction } from "@/lib/camp-db";
import { listCurrentBodegaProducts } from "@/lib/bodega-masters";
import { DRENCH_PROGRAM_ACTIVITY_ID } from "@/lib/campo-drench-program-types";
import type {
  DrenchProgramCycleType,
  DrenchProgramLineInput,
  DrenchProgramLineRecord,
  DrenchProgramRuleInput,
  DrenchProgramRuleRecord,
} from "@/lib/campo-drench-program-types";

type CountRow = {
  total: number | string | null;
};

type CurrentRuleRow = {
  rule_id: string;
  rule_code: string;
  phenological_week: number | string | null;
  cycle_type: DrenchProgramCycleType;
  variety_code: string;
  activity_id: string;
  is_active: boolean | null;
  notes: string | null;
  valid_from: Date | string | null;
  valid_to: Date | string | null;
  loaded_at: Date | string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

type CurrentLineRow = {
  line_id: string;
  rule_id: string;
  line_order: number | string | null;
  application_method: string | null;
  liters_per_bed: number | string | null;
  product_id: string | null;
  source_product_name: string | null;
  source_product_code: string | null;
  source_unit_code: string | null;
  quantity_value: number | string | null;
  quantity_reference: string | null;
  notes: string | null;
  is_active: boolean | null;
  valid_from: Date | string | null;
  valid_to: Date | string | null;
  loaded_at: Date | string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

const RULE_REF_TABLE = "public.field_ref_drench_program_rule_id_core_scd2";
const RULE_DIM_TABLE = "public.field_dim_drench_program_rule_profile_scd2";
const RULE_LINE_TABLE = "public.field_bridge_drench_program_rule_line_scd2";
const DRENCH_ACTIVITY_ID = DRENCH_PROGRAM_ACTIVITY_ID;

declare global {
  // eslint-disable-next-line no-var
  var __dashboardDrenchProgramInitialized: boolean | undefined;
}

function formatTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function makeRecordId() {
  return crypto.randomUUID();
}

function makeEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function makeRunId(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeCode(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function boolValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function isCycleType(value: string): value is DrenchProgramCycleType {
  return value === "S" || value === "P";
}

function buildRuleCode(phenologicalWeek: number, cycleType: DrenchProgramCycleType, varietyCode: string) {
  return `${phenologicalWeek} ${cycleType} ${normalizeCode(varietyCode)}`;
}

function sanitizeLines(lines: DrenchProgramLineInput[]) {
  const sanitized = lines.map((line, index) => ({
    lineOrder: index + 1,
    applicationMethod: normalizeOptionalText(line.applicationMethod),
    litersPerBed: toNumber(line.litersPerBed),
    productId: normalizeOptionalText(line.productId),
    sourceProductName: normalizeOptionalText(line.sourceProductName),
    sourceProductCode: normalizeOptionalText(line.sourceProductCode),
    sourceUnitCode: normalizeOptionalText(line.sourceUnitCode),
    quantityValue: toNumber(line.quantityValue),
    quantityReference: normalizeOptionalText(line.quantityReference),
    notes: normalizeOptionalText(line.notes),
    isActive: boolValue(line.isActive, true),
  }));

  for (const line of sanitized) {
    if (!line.productId && !line.sourceProductName) {
      throw new Error("Cada linea debe tener un producto vinculado o al menos un nombre fuente pendiente.");
    }
  }

  return sanitized;
}

function sanitizeRuleInput(input: DrenchProgramRuleInput) {
  const phenologicalWeek = toInt(input.phenologicalWeek);
  const cycleType = normalizeCode(input.cycleType);
  const varietyCode = normalizeCode(input.varietyCode);
  const activityId = normalizeCode(input.activityId ?? DRENCH_ACTIVITY_ID) || DRENCH_ACTIVITY_ID;
  const notes = normalizeOptionalText(input.notes);
  const changeReason = normalizeOptionalText(input.changeReason);
  const lines = sanitizeLines(input.lines);

  if (!phenologicalWeek || phenologicalWeek <= 0) {
    throw new Error("La semana fenológica debe ser mayor a cero.");
  }

  if (!isCycleType(cycleType)) {
    throw new Error("El tipo de ciclo debe ser S o P.");
  }

  if (!varietyCode) {
    throw new Error("La variedad es obligatoria.");
  }

  return {
    phenologicalWeek,
    cycleType,
    varietyCode,
    activityId,
    isActive: boolValue(input.isActive, true),
    notes,
    lines,
    changeReason,
  };
}

async function initializeDrenchProgramMasterInternal(client?: PoolClient) {
  const runTypedQuery = <T extends QueryResultRow>(text: string, values: unknown[] = []) => {
    if (client) {
      return client.query<T>(text, values);
    }
    return queryCamp<T>(text, values);
  };

  await runTypedQuery(`
    create table if not exists ${RULE_REF_TABLE} (
      record_id text primary key,
      rule_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runTypedQuery(`
    create table if not exists ${RULE_DIM_TABLE} (
      record_id text primary key,
      rule_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      rule_code text not null,
      phenological_week integer not null,
      cycle_type text not null,
      variety_code text not null,
      activity_id text not null,
      notes text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runTypedQuery(`
    create table if not exists ${RULE_LINE_TABLE} (
      record_id text primary key,
      line_id text not null,
      rule_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      line_order integer not null,
      application_method text null,
      liters_per_bed numeric(18, 6) null,
      product_id text null,
      source_product_name text null,
      source_product_code text null,
      source_unit_code text null,
      quantity_value numeric(18, 6) null,
      quantity_reference text null,
      notes text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runTypedQuery(`
    create unique index if not exists field_ref_drench_program_rule_id_core_scd2_current_idx
      on ${RULE_REF_TABLE} (rule_id)
      where is_current = true
  `);

  await runTypedQuery(`
    create unique index if not exists field_dim_drench_program_rule_profile_scd2_current_idx
      on ${RULE_DIM_TABLE} (rule_id)
      where is_current = true
  `);

  await runTypedQuery(`
    create unique index if not exists field_dim_drench_program_rule_profile_scd2_key_unique_idx
      on ${RULE_DIM_TABLE} (
        phenological_week,
        cycle_type,
        upper(regexp_replace(trim(variety_code), '\\s+', ' ', 'g')),
        upper(regexp_replace(trim(activity_id), '\\s+', ' ', 'g'))
      )
      where is_current = true
        and is_valid = true
  `);

  await runTypedQuery(`
    create index if not exists field_bridge_drench_program_rule_line_scd2_current_rule_idx
      on ${RULE_LINE_TABLE} (rule_id, line_order)
      where is_current = true
  `);
}

export async function initializeDrenchProgramMaster() {
  if (global.__dashboardDrenchProgramInitialized) return;
  await initializeDrenchProgramMasterInternal();
  global.__dashboardDrenchProgramInitialized = true;
}

async function getCurrentRuleRows() {
  await initializeDrenchProgramMaster();
  const result = await queryCamp<CurrentRuleRow>(
    `
      select
        rule.rule_id,
        rule.rule_code,
        rule.phenological_week,
        rule.cycle_type,
        rule.variety_code,
        rule.activity_id,
        rule.is_active,
        rule.notes,
        rule.valid_from,
        rule.valid_to,
        rule.loaded_at,
        rule.run_id,
        rule.actor_id,
        rule.change_reason
      from ${RULE_DIM_TABLE} rule
      inner join ${RULE_REF_TABLE} ref
        on ref.rule_id = rule.rule_id
       and ref.is_current = true
      where rule.is_current = true
      order by rule.phenological_week asc, rule.cycle_type asc, rule.variety_code asc
    `,
  );
  return result.rows;
}

async function getCurrentLineRows() {
  await initializeDrenchProgramMaster();
  const result = await queryCamp<CurrentLineRow>(
    `
      select
        line.line_id,
        line.rule_id,
        line.line_order,
        line.application_method,
        line.liters_per_bed,
        line.product_id,
        line.source_product_name,
        line.source_product_code,
        line.source_unit_code,
        line.quantity_value,
        line.quantity_reference,
        line.notes,
        line.is_active,
        line.valid_from,
        line.valid_to,
        line.loaded_at,
        line.run_id,
        line.actor_id,
        line.change_reason
      from ${RULE_LINE_TABLE} line
      where line.is_current = true
      order by line.rule_id asc, line.line_order asc
    `,
  );
  return result.rows;
}

function mapLineRows(
  rows: CurrentLineRow[],
  bodegaProducts: Map<string, Awaited<ReturnType<typeof listCurrentBodegaProducts>>[number]>,
) {
  const grouped = new Map<string, DrenchProgramLineRecord[]>();

  for (const row of rows) {
    const product = row.product_id ? bodegaProducts.get(row.product_id) : null;
    const item: DrenchProgramLineRecord = {
      lineId: row.line_id,
      lineOrder: Number(row.line_order ?? 0),
      applicationMethod: row.application_method,
      litersPerBed: toNumber(row.liters_per_bed),
      productId: row.product_id,
      productCode: product?.productCode ?? null,
      productName: product?.productName ?? null,
      sourceProductName: row.source_product_name,
      sourceProductCode: row.source_product_code,
      sourceUnitCode: row.source_unit_code,
      quantityValue: toNumber(row.quantity_value),
      quantityReference: row.quantity_reference,
      notes: row.notes,
      isActive: boolValue(row.is_active, true),
      validFrom: formatTimestamp(row.valid_from),
      validTo: formatTimestamp(row.valid_to),
      loadedAt: formatTimestamp(row.loaded_at),
      runId: row.run_id,
      actorId: row.actor_id,
      changeReason: row.change_reason,
    };

    const current = grouped.get(row.rule_id) ?? [];
    current.push(item);
    grouped.set(row.rule_id, current);
  }

  return grouped;
}

export async function listCurrentDrenchProgramRules() {
  await initializeDrenchProgramMaster();
  const [ruleRows, lineRows, bodegaProducts] = await Promise.all([
    getCurrentRuleRows(),
    getCurrentLineRows(),
    listCurrentBodegaProducts(),
  ]);

  const productMap = new Map(bodegaProducts.map((product) => [product.productId, product]));
  const lineMap = mapLineRows(lineRows, productMap);

  return ruleRows.map<DrenchProgramRuleRecord>((row) => ({
    ruleId: row.rule_id,
    ruleCode: row.rule_code,
    phenologicalWeek: Number(row.phenological_week ?? 0),
    cycleType: row.cycle_type,
    varietyCode: row.variety_code,
    activityId: row.activity_id,
    isActive: boolValue(row.is_active, true),
    notes: row.notes,
    lines: lineMap.get(row.rule_id) ?? [],
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  }));
}

export async function listCurrentDrenchAssignableProducts() {
  const products = await listCurrentBodegaProducts();
  return products
    .filter((product) => product.isActive && product.assignments.some((assignment) => assignment.activityId === DRENCH_ACTIVITY_ID))
    .sort((left, right) => left.productCode.localeCompare(right.productCode));
}

async function getCurrentRuleById(ruleId: string) {
  const rules = await listCurrentDrenchProgramRules();
  return rules.find((rule) => rule.ruleId === ruleId) ?? null;
}

async function ensureUniqueCurrentRuleKey(
  phenologicalWeek: number,
  cycleType: DrenchProgramCycleType,
  varietyCode: string,
  activityId: string,
  excludeRuleId?: string,
) {
  const rules = await listCurrentDrenchProgramRules();
  const found = rules.find((rule) =>
    rule.phenologicalWeek === phenologicalWeek
    && rule.cycleType === cycleType
    && normalizeCode(rule.varietyCode) === normalizeCode(varietyCode)
    && normalizeCode(rule.activityId) === normalizeCode(activityId)
    && rule.ruleId !== excludeRuleId,
  );

  if (found) {
    throw new Error(`Ya existe una regla vigente para ${buildRuleCode(phenologicalWeek, cycleType, varietyCode)}.`);
  }
}

export async function createDrenchProgramRule(input: DrenchProgramRuleInput, actorId: string) {
  await initializeDrenchProgramMaster();
  const sanitized = sanitizeRuleInput(input);
  await ensureUniqueCurrentRuleKey(
    sanitized.phenologicalWeek,
    sanitized.cycleType,
    sanitized.varietyCode,
    sanitized.activityId,
  );

  const ruleId = makeEntityId("drench_rule");
  const now = new Date();
  const runId = makeRunId("drench_rule_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";
  const ruleCode = buildRuleCode(sanitized.phenologicalWeek, sanitized.cycleType, sanitized.varietyCode);

  await withCampTransaction(async (client) => {
    await initializeDrenchProgramMasterInternal(client);

    await client.query(
      `
        insert into ${RULE_REF_TABLE} (
          record_id, rule_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), ruleId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${RULE_DIM_TABLE} (
          record_id, rule_id, valid_from, valid_to, is_current, rule_code, phenological_week, cycle_type,
          variety_code, activity_id, notes, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13)
      `,
      [
        makeRecordId(),
        ruleId,
        now,
        ruleCode,
        sanitized.phenologicalWeek,
        sanitized.cycleType,
        sanitized.varietyCode,
        sanitized.activityId,
        sanitized.notes,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );

    for (const line of sanitized.lines) {
      await client.query(
        `
          insert into ${RULE_LINE_TABLE} (
            record_id, line_id, rule_id, valid_from, valid_to, is_current, line_order,
            application_method, liters_per_bed, product_id, source_product_name, source_product_code, source_unit_code,
            quantity_value, quantity_reference, notes, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
          ) values ($1, $2, $3, $4, null, true, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, $4, $16, $17, $18)
        `,
        [
          makeRecordId(),
          makeEntityId("drench_line"),
          ruleId,
          now,
          line.lineOrder,
          line.applicationMethod,
          line.litersPerBed,
          line.productId,
          line.sourceProductName,
          line.sourceProductCode,
          line.sourceUnitCode,
          line.quantityValue,
          line.quantityReference,
          line.notes,
          line.isActive,
          runId,
          actorId,
          changeReason,
        ],
      );
    }
  });

  return getCurrentRuleById(ruleId);
}

export async function updateDrenchProgramRule(ruleId: string, input: DrenchProgramRuleInput, actorId: string) {
  await initializeDrenchProgramMaster();
  const current = await getCurrentRuleById(ruleId);
  if (!current) {
    throw new Error("No se encontró la regla vigente de drench que intentas editar.");
  }

  const sanitized = sanitizeRuleInput(input);
  await ensureUniqueCurrentRuleKey(
    sanitized.phenologicalWeek,
    sanitized.cycleType,
    sanitized.varietyCode,
    sanitized.activityId,
    ruleId,
  );

  const now = new Date();
  const runId = makeRunId("drench_rule_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";
  const ruleCode = buildRuleCode(sanitized.phenologicalWeek, sanitized.cycleType, sanitized.varietyCode);

  await withCampTransaction(async (client) => {
    await initializeDrenchProgramMasterInternal(client);

    await client.query(
      `update ${RULE_REF_TABLE} set is_current = false, valid_to = $2 where rule_id = $1 and is_current = true`,
      [ruleId, now],
    );
    await client.query(
      `update ${RULE_DIM_TABLE} set is_current = false, valid_to = $2 where rule_id = $1 and is_current = true`,
      [ruleId, now],
    );
    await client.query(
      `update ${RULE_LINE_TABLE} set is_current = false, valid_to = $2 where rule_id = $1 and is_current = true`,
      [ruleId, now],
    );

    await client.query(
      `
        insert into ${RULE_REF_TABLE} (
          record_id, rule_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), ruleId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${RULE_DIM_TABLE} (
          record_id, rule_id, valid_from, valid_to, is_current, rule_code, phenological_week, cycle_type,
          variety_code, activity_id, notes, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13)
      `,
      [
        makeRecordId(),
        ruleId,
        now,
        ruleCode,
        sanitized.phenologicalWeek,
        sanitized.cycleType,
        sanitized.varietyCode,
        sanitized.activityId,
        sanitized.notes,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );

    for (const line of sanitized.lines) {
      await client.query(
        `
          insert into ${RULE_LINE_TABLE} (
            record_id, line_id, rule_id, valid_from, valid_to, is_current, line_order,
            application_method, liters_per_bed, product_id, source_product_name, source_product_code, source_unit_code,
            quantity_value, quantity_reference, notes, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
          ) values ($1, $2, $3, $4, null, true, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, $4, $16, $17, $18)
        `,
        [
          makeRecordId(),
          makeEntityId("drench_line"),
          ruleId,
          now,
          line.lineOrder,
          line.applicationMethod,
          line.litersPerBed,
          line.productId,
          line.sourceProductName,
          line.sourceProductCode,
          line.sourceUnitCode,
          line.quantityValue,
          line.quantityReference,
          line.notes,
          line.isActive,
          runId,
          actorId,
          changeReason,
        ],
      );
    }
  });

  return getCurrentRuleById(ruleId);
}

export async function getCurrentDrenchProgramSummary() {
  await initializeDrenchProgramMaster();
  const [rules, lines] = await Promise.all([
    queryCamp<CountRow>(`select count(*)::int as total from ${RULE_DIM_TABLE} where is_current = true`),
    queryCamp<CountRow>(`select count(*)::int as total from ${RULE_LINE_TABLE} where is_current = true`),
  ]);

  return {
    rules: Number(rules.rows[0]?.total ?? 0),
    lines: Number(lines.rows[0]?.total ?? 0),
  };
}

export { DRENCH_ACTIVITY_ID };
