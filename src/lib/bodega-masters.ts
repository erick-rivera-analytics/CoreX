import crypto from "crypto";
import type { PoolClient, QueryResultRow } from "pg";

import {
  formatActivityUsageLabel,
  getCurrentBodegaSourceActivitiesById,
} from "@/lib/bodega-activity-source";
import { queryCamp, withCampTransaction } from "@/lib/camp-db";
import type {
  BodegaActiveComponentMode,
  BodegaActivityRecord,
  BodegaCategoryInput,
  BodegaCategoryLevel,
  BodegaCategoryRecord,
  BodegaPresentationConversionMode,
  BodegaPresentationInput,
  BodegaPresentationRecord,
  BodegaProductAssignmentInput,
  BodegaProductAssignmentRecord,
  BodegaProductInput,
  BodegaProductRecord,
  BodegaUnitDimension,
  BodegaUnitInput,
  BodegaUnitRecord,
} from "@/lib/bodega-master-types";

type CountRow = {
  total: number | string | null;
};

type CurrentUnitRow = {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  unit_symbol: string;
  unit_dimension: BodegaUnitDimension;
  decimal_precision: number | string | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

type CurrentCategoryRow = {
  category_id: string;
  category_code: string;
  category_name: string;
  category_level: BodegaCategoryLevel;
  parent_category_id: string | null;
  sort_order: number | string | null;
  category_description: string | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

type CurrentProductRow = {
  product_id: string;
  product_code: string;
  product_name: string;
  product_description: string | null;
  base_unit_id: string;
  unit_code: string;
  unit_name: string;
  category_id: string;
  active_component_mode: BodegaActiveComponentMode;
  active_component_name: string | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

type CurrentAssignmentRow = {
  product_id: string;
  activity_id: string;
  branch_order: number | string | null;
};

type CurrentPresentationRow = {
  presentation_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  commercial_name: string | null;
  presentation_code: string;
  presentation_name: string;
  package_name: string | null;
  presentation_quantity: number | string | null;
  presentation_unit_id: string;
  presentation_unit_code: string;
  presentation_unit_name: string;
  base_unit_id: string | null;
  base_unit_code: string | null;
  base_unit_name: string | null;
  equivalent_base_quantity: number | string | null;
  conversion_mode: BodegaPresentationConversionMode;
  allows_fractioning: boolean | null;
  operational_note: string | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

const UNIT_REF_TABLE = "public.bodega_ref_unit_id_core_scd2";
const UNIT_DIM_TABLE = "public.bodega_dim_unit_profile_scd2";
const CATEGORY_REF_TABLE = "public.bodega_ref_category_id_core_scd2";
const CATEGORY_DIM_TABLE = "public.bodega_dim_category_profile_scd2";
const PRODUCT_REF_TABLE = "public.bodega_ref_product_id_core_scd2";
const PRODUCT_DIM_TABLE = "public.bodega_dim_product_profile_scd2";
const PRODUCT_USAGE_TABLE = "public.bodega_bridge_product_usage_scd2";
const PRESENTATION_REF_TABLE = "public.bodega_ref_product_presentation_id_core_scd2";
const PRESENTATION_DIM_TABLE = "public.bodega_dim_product_presentation_profile_scd2";

declare global {
  var __dashboardBodegaMastersSetup: Promise<void> | undefined;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCode(value: string) {
  return normalizeLabel(value).toUpperCase();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeLabel(value ?? "");
  return normalized || null;
}

function toInt(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed);
}

function boolValue(value: boolean | null | undefined, fallback = true) {
  return value ?? fallback;
}

function roundQuantity(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const UNIT_CONVERSION_FACTORS: Record<string, number> = {
  KG: 1000,
  GR: 1,
  LT: 1000,
  CC: 1,
  GL: 3785.411784,
  GA: 3785.411784,
  M3: 1_000_000,
  P3: 28316.846592,
  PIE3: 28316.846592,
  MT: 1,
};

function makeRunId(prefix: string) {
  return `${prefix}_${new Date().toISOString()}`;
}

function makeRecordId() {
  return crypto.randomUUID();
}

function makeEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isUnitDimension(value: string): value is BodegaUnitDimension {
  return value === "Unidad" || value === "Peso" || value === "Volumen" || value === "Longitud";
}

function isCategoryLevel(value: string): value is BodegaCategoryLevel {
  return value === "family" || value === "subfamily";
}

function isActiveComponentMode(value: string): value is BodegaActiveComponentMode {
  return value === "applies" || value === "na";
}

function sanitizeUnitInput(input: BodegaUnitInput) {
  const code = normalizeCode(input.code);
  const name = normalizeLabel(input.name);
  const symbol = normalizeLabel(input.symbol);
  const dimension = input.dimension;
  const decimalPrecision = Math.max(toInt(input.decimalPrecision, 0), 0);
  const changeReason = normalizeOptionalText(input.changeReason);

  if (!code) {
    throw new Error("El codigo de la unidad es obligatorio.");
  }

  if (!name) {
    throw new Error("El nombre de la unidad es obligatorio.");
  }

  if (!symbol) {
    throw new Error("El simbolo de la unidad es obligatorio.");
  }

  if (!isUnitDimension(dimension)) {
    throw new Error("La dimension de la unidad no es valida.");
  }

  return {
    code,
    name,
    symbol,
    dimension,
    decimalPrecision,
    isActive: boolValue(input.isActive, true),
    changeReason,
  } satisfies BodegaUnitInput;
}

function sanitizeCategoryInput(input: BodegaCategoryInput) {
  const code = normalizeCode(input.code);
  const name = normalizeLabel(input.name);
  const level = input.level;
  const parentCategoryId = normalizeOptionalText(input.parentCategoryId) ?? null;
  const sortOrder = Math.max(toInt(input.sortOrder, 0), 0);
  const description = normalizeOptionalText(input.description);
  const changeReason = normalizeOptionalText(input.changeReason);

  if (!code) {
    throw new Error("El codigo de la categoria es obligatorio.");
  }

  if (!name) {
    throw new Error("El nombre de la categoria es obligatorio.");
  }

  if (!isCategoryLevel(level)) {
    throw new Error("El nivel de la categoria no es valido.");
  }

  return {
    code,
    name,
    level,
    parentCategoryId,
    sortOrder,
    description,
    isActive: boolValue(input.isActive, true),
    changeReason,
  } satisfies BodegaCategoryInput;
}

function sanitizeAssignments(assignments: BodegaProductAssignmentInput[]) {
  const sanitized = assignments
    .map((assignment, index) => ({
      activityId: normalizeCode(assignment.activityId),
      branchOrder: Math.max(toInt(assignment.branchOrder, index + 1), 1),
    }))
    .filter((assignment) => assignment.activityId)
    .sort((left, right) => left.branchOrder - right.branchOrder)
    .map((assignment, index) => ({
      ...assignment,
      branchOrder: index + 1,
    }));

  const duplicateKey = new Set<string>();
  for (const assignment of sanitized) {
    const key = assignment.activityId.toLowerCase();
    if (duplicateKey.has(key)) {
      throw new Error(`La actividad "${assignment.activityId}" esta repetida.`);
    }
    duplicateKey.add(key);
  }

  return sanitized;
}

function sanitizeProductInput(input: BodegaProductInput) {
  const productCode = normalizeCode(input.productCode);
  const productName = normalizeLabel(input.productName);
  const description = normalizeOptionalText(input.description);
  const baseUnitId = normalizeOptionalText(input.baseUnitId);
  const categoryId = normalizeOptionalText(input.categoryId);
  const activeComponentMode = input.activeComponentMode;
  const activeComponentName = normalizeOptionalText(input.activeComponentName);
  const assignments = sanitizeAssignments(input.assignments);
  const changeReason = normalizeOptionalText(input.changeReason);

  if (!productCode) {
    throw new Error("El codigo del producto es obligatorio.");
  }

  if (!productName) {
    throw new Error("El nombre oficial del producto es obligatorio.");
  }

  if (!baseUnitId) {
    throw new Error("La unidad base es obligatoria.");
  }

  if (!categoryId) {
    throw new Error("La categoria del producto es obligatoria.");
  }

  if (!isActiveComponentMode(activeComponentMode)) {
    throw new Error("El modo de componente activo no es valido.");
  }

  if (activeComponentMode === "applies" && !activeComponentName) {
    throw new Error("Debes detallar el componente activo cuando si aplica.");
  }

  return {
    productCode,
    productName,
    description,
    baseUnitId,
    categoryId,
    activeComponentMode,
    activeComponentName: activeComponentMode === "na" ? null : activeComponentName,
    isActive: boolValue(input.isActive, true),
    assignments,
    changeReason,
  } satisfies BodegaProductInput;
}

function isPresentationConversionMode(value: string): value is BodegaPresentationConversionMode {
  return value === "auto" || value === "manual";
}

function sanitizePresentationInput(input: BodegaPresentationInput) {
  const productId = normalizeOptionalText(input.productId);
  const commercialName = normalizeOptionalText(input.commercialName);
  const presentationCode = normalizeCode(input.presentationCode);
  const presentationName = normalizeLabel(input.presentationName);
  const packageName = normalizeOptionalText(input.packageName);
  const presentationUnitId = normalizeOptionalText(input.presentationUnitId);
  const operationalNote = normalizeOptionalText(input.operationalNote);
  const changeReason = normalizeOptionalText(input.changeReason);
  const equivalentBaseQuantity = input.equivalentBaseQuantity === null || input.equivalentBaseQuantity === undefined
    ? null
    : Number(input.equivalentBaseQuantity);
  const presentationQuantity = Number(input.presentationQuantity);

  if (!productId) {
    throw new Error("Debes seleccionar un producto maestro.");
  }

  if (!presentationCode) {
    throw new Error("El codigo de la presentacion es obligatorio.");
  }

  if (!presentationName) {
    throw new Error("El nombre de la presentacion es obligatorio.");
  }

  if (!presentationUnitId) {
    throw new Error("Debes seleccionar la unidad de contenido de la presentacion.");
  }

  if (!Number.isFinite(presentationQuantity) || presentationQuantity <= 0) {
    throw new Error("La cantidad de la presentacion debe ser mayor a cero.");
  }

  if (equivalentBaseQuantity !== null && (!Number.isFinite(equivalentBaseQuantity) || equivalentBaseQuantity <= 0)) {
    throw new Error("La conversion manual a unidad base debe ser mayor a cero.");
  }

  return {
    productId,
    commercialName,
    presentationCode,
    presentationName,
    packageName,
    presentationQuantity,
    presentationUnitId,
    equivalentBaseQuantity,
    allowsFractioning: boolValue(input.allowsFractioning, false),
    operationalNote,
    isActive: boolValue(input.isActive, true),
    changeReason,
  } satisfies BodegaPresentationInput;
}

async function ensureTables(client?: PoolClient) {
  const runQuery = (text: string) => client ? client.query(text) : queryCamp(text);
  const runTypedQuery = <T extends QueryResultRow>(text: string, values: unknown[] = []) => {
    if (client) {
      return client.query<T>(text, values);
    }
    return queryCamp<T>(text, values);
  };

  await runQuery(`
    create table if not exists ${UNIT_REF_TABLE} (
      record_id text primary key,
      unit_id text not null,
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

  await runQuery(`
    create table if not exists ${UNIT_DIM_TABLE} (
      record_id text primary key,
      unit_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      unit_code text not null,
      unit_name text not null,
      unit_symbol text not null,
      unit_dimension text not null,
      decimal_precision integer not null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create unique index if not exists bodega_ref_unit_id_core_scd2_current_idx
      on ${UNIT_REF_TABLE} (unit_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_unit_profile_scd2_current_idx
      on ${UNIT_DIM_TABLE} (unit_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_unit_profile_scd2_current_code_unique_idx
      on ${UNIT_DIM_TABLE} (lower(regexp_replace(trim(unit_code), '\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create table if not exists ${CATEGORY_REF_TABLE} (
      record_id text primary key,
      category_id text not null,
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

  await runQuery(`
    create table if not exists ${CATEGORY_DIM_TABLE} (
      record_id text primary key,
      category_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      category_code text not null,
      category_name text not null,
      category_level text not null,
      parent_category_id text null,
      sort_order integer not null,
      category_description text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create unique index if not exists bodega_ref_category_id_core_scd2_current_idx
      on ${CATEGORY_REF_TABLE} (category_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_category_profile_scd2_current_idx
      on ${CATEGORY_DIM_TABLE} (category_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_category_profile_scd2_current_code_unique_idx
      on ${CATEGORY_DIM_TABLE} (lower(regexp_replace(trim(category_code), '\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_category_profile_scd2_name_parent_unique_idx
      on ${CATEGORY_DIM_TABLE} (
        lower(regexp_replace(trim(category_name), '\s+', ' ', 'g')),
        category_level,
        coalesce(parent_category_id, '')
      )
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create table if not exists ${PRODUCT_REF_TABLE} (
      record_id text primary key,
      product_id text not null,
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

  await runQuery(`
    alter table ${PRODUCT_DIM_TABLE}
      drop column if exists commercial_name
  `);

  await runQuery(`
    create table if not exists ${PRODUCT_DIM_TABLE} (
      record_id text primary key,
      product_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      product_code text not null,
      product_name text not null,
      product_description text null,
      base_unit_id text not null,
      category_id text not null,
      active_component_mode text not null,
      active_component_name text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create table if not exists ${PRESENTATION_REF_TABLE} (
      record_id text primary key,
      presentation_id text not null,
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

  await runQuery(`
    create table if not exists ${PRESENTATION_DIM_TABLE} (
      record_id text primary key,
      presentation_id text not null,
      product_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      presentation_code text not null,
      presentation_name text not null,
      commercial_name text null,
      package_name text null,
      presentation_quantity numeric(18, 6) null,
      presentation_unit_id text null,
      equivalent_base_quantity numeric(18, 6) null,
      conversion_mode text null,
      base_unit_id text null,
      allows_fractioning boolean not null,
      operational_note text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    alter table ${PRESENTATION_DIM_TABLE}
      add column if not exists package_name text null
  `);

  await runQuery(`
    alter table ${PRESENTATION_DIM_TABLE}
      add column if not exists presentation_quantity numeric(18, 6) null
  `);

  await runQuery(`
    alter table ${PRESENTATION_DIM_TABLE}
      add column if not exists presentation_unit_id text null
  `);

  await runQuery(`
    alter table ${PRESENTATION_DIM_TABLE}
      add column if not exists conversion_mode text null
  `);

  await runQuery(`
    alter table ${PRESENTATION_DIM_TABLE}
      drop column if exists presentation_unit_name
  `);

  await runQuery(`
    create unique index if not exists bodega_ref_product_id_core_scd2_current_idx
      on ${PRODUCT_REF_TABLE} (product_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_product_profile_scd2_current_idx
      on ${PRODUCT_DIM_TABLE} (product_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_product_profile_scd2_current_code_unique_idx
      on ${PRODUCT_DIM_TABLE} (lower(regexp_replace(trim(product_code), '\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_product_profile_scd2_current_name_unique_idx
      on ${PRODUCT_DIM_TABLE} (lower(regexp_replace(trim(product_name), '\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create unique index if not exists bodega_ref_product_presentation_id_core_scd2_current_idx
      on ${PRESENTATION_REF_TABLE} (presentation_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_product_presentation_profile_scd2_current_idx
      on ${PRESENTATION_DIM_TABLE} (presentation_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists bodega_dim_product_presentation_profile_scd2_current_code_unique_idx
      on ${PRESENTATION_DIM_TABLE} (lower(regexp_replace(trim(presentation_code), '\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  const usageTableColumns = await runTypedQuery<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bodega_bridge_product_usage_scd2'
    `,
  );
  const existingUsageColumns = new Set(usageTableColumns.rows.map((row) => row.column_name));
  const needsUsageMigration = existingUsageColumns.size > 0 && !existingUsageColumns.has("activity_id");

  if (needsUsageMigration) {
    await runQuery(`drop table if exists ${PRODUCT_USAGE_TABLE}`);
  }

  await runQuery(`
    create table if not exists ${PRODUCT_USAGE_TABLE} (
      record_id text primary key,
      product_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      branch_order integer not null,
      activity_id text not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create index if not exists bodega_bridge_product_usage_scd2_current_product_idx
      on ${PRODUCT_USAGE_TABLE} (product_id, branch_order)
      where is_current = true
  `);

  await runQuery(`
    create unique index if not exists bodega_bridge_product_usage_scd2_current_branch_unique_idx
      on ${PRODUCT_USAGE_TABLE} (product_id, branch_order)
      where is_current = true
  `);

  await runQuery(`
    create unique index if not exists bodega_bridge_product_usage_scd2_current_activity_unique_idx
      on ${PRODUCT_USAGE_TABLE} (product_id, activity_id)
      where is_current = true
  `);
}

export async function initializeBodegaMasters() {
  if (!global.__dashboardBodegaMastersSetup) {
    global.__dashboardBodegaMastersSetup = ensureTables();
  }

  return global.__dashboardBodegaMastersSetup;
}

function mapUnitRow(row: CurrentUnitRow): BodegaUnitRecord {
  return {
    unitId: row.unit_id,
    code: row.unit_code,
    name: row.unit_name,
    symbol: row.unit_symbol,
    dimension: row.unit_dimension,
    decimalPrecision: toInt(row.decimal_precision, 0),
    isActive: boolValue(row.is_active, true),
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  };
}

function buildCategoryPath(
  row: CurrentCategoryRow,
  byId: Map<string, CurrentCategoryRow>,
) {
  const labels: string[] = [];
  let cursor: CurrentCategoryRow | undefined = row;
  let guard = 0;

  while (cursor && guard < 5) {
    labels.unshift(cursor.category_name);
    cursor = cursor.parent_category_id ? byId.get(cursor.parent_category_id) : undefined;
    guard += 1;
  }

  return labels.join(" > ");
}

function mapCategoryRows(rows: CurrentCategoryRow[]): BodegaCategoryRecord[] {
  const byId = new Map(rows.map((row) => [row.category_id, row]));

  return rows.map((row) => ({
    categoryId: row.category_id,
    code: row.category_code,
    name: row.category_name,
    level: row.category_level,
    parentCategoryId: row.parent_category_id,
    parentCategoryName: row.parent_category_id ? byId.get(row.parent_category_id)?.category_name ?? null : null,
    pathLabel: buildCategoryPath(row, byId),
    sortOrder: toInt(row.sort_order, 0),
    description: row.category_description,
    isActive: boolValue(row.is_active, true),
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  }));
}

function mapAssignments(
  rows: CurrentAssignmentRow[],
  activityMap: Map<string, BodegaActivityRecord>,
): Map<string, BodegaProductAssignmentRecord[]> {
  const grouped = new Map<string, BodegaProductAssignmentRecord[]>();

  for (const row of rows) {
    const items = grouped.get(row.product_id) ?? [];
    const activity = activityMap.get(row.activity_id);
    const activityName = activity?.activityName ?? row.activity_id;
    items.push({
      activityId: row.activity_id,
      activityName,
      costArea: activity?.costArea ?? null,
      subCostCenter: activity?.subCostCenter ?? null,
      activityType: activity?.activityType ?? null,
      branchOrder: toInt(row.branch_order, 0),
      usageLabel: formatActivityUsageLabel({
        activityId: row.activity_id,
        activityName,
        costArea: activity?.costArea ?? null,
        subCostCenter: activity?.subCostCenter ?? null,
      }),
    });
    grouped.set(row.product_id, items);
  }

  for (const items of grouped.values()) {
    items.sort((left, right) => left.branchOrder - right.branchOrder);
  }

  return grouped;
}

async function getCurrentCategoryRows() {
  await initializeBodegaMasters();

  const result = await queryCamp<CurrentCategoryRow>(
    `
      select
        category_id,
        category_code,
        category_name,
        category_level,
        parent_category_id,
        sort_order,
        category_description,
        is_active,
        valid_from,
        valid_to,
        loaded_at,
        run_id,
        actor_id,
        change_reason
      from ${CATEGORY_DIM_TABLE}
      where is_current = true
      order by
        case category_level
          when 'type' then 1
          when 'family' then 2
          else 3
        end,
        sort_order asc,
        category_name asc
    `,
  );

  return result.rows;
}

async function ensureUniqueCurrentUnitCode(code: string, excludeUnitId?: string) {
  const result = await queryCamp<{ unit_id: string }>(
    `
      select unit_id
      from ${UNIT_DIM_TABLE}
      where is_current = true
        and lower(regexp_replace(trim(unit_code), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
        ${excludeUnitId ? "and unit_id <> $2" : ""}
      limit 1
    `,
    excludeUnitId ? [code, excludeUnitId] : [code],
  );

  if (result.rows.length > 0) {
    throw new Error(`Ya existe una unidad activa con el codigo "${code}".`);
  }
}

async function ensureUniqueCurrentCategoryCode(code: string, excludeCategoryId?: string) {
  const result = await queryCamp<{ category_id: string }>(
    `
      select category_id
      from ${CATEGORY_DIM_TABLE}
      where is_current = true
        and lower(regexp_replace(trim(category_code), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
        ${excludeCategoryId ? "and category_id <> $2" : ""}
      limit 1
    `,
    excludeCategoryId ? [code, excludeCategoryId] : [code],
  );

  if (result.rows.length > 0) {
    throw new Error(`Ya existe una categoria activa con el codigo "${code}".`);
  }
}

async function ensureUniqueCurrentProductCode(code: string, excludeProductId?: string) {
  const result = await queryCamp<{ product_id: string }>(
    `
      select product_id
      from ${PRODUCT_DIM_TABLE}
      where is_current = true
        and lower(regexp_replace(trim(product_code), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
        ${excludeProductId ? "and product_id <> $2" : ""}
      limit 1
    `,
    excludeProductId ? [code, excludeProductId] : [code],
  );

  if (result.rows.length > 0) {
    throw new Error(`Ya existe un producto activo con el codigo "${code}".`);
  }
}

async function getCurrentUnitById(unitId: string) {
  const result = await queryCamp<CurrentUnitRow>(
    `
      select
        unit_id,
        unit_code,
        unit_name,
        unit_symbol,
        unit_dimension,
        decimal_precision,
        is_active,
        valid_from,
        valid_to,
        loaded_at,
        run_id,
        actor_id,
        change_reason
      from ${UNIT_DIM_TABLE}
      where unit_id = $1
        and is_current = true
      limit 1
    `,
    [unitId],
  );

  return result.rows[0] ? mapUnitRow(result.rows[0]) : null;
}

async function getCurrentCategoryById(categoryId: string) {
  const rows = await getCurrentCategoryRows();
  const mapped = mapCategoryRows(rows);
  return mapped.find((row) => row.categoryId === categoryId) ?? null;
}

async function validateCategoryParent(
  level: BodegaCategoryLevel,
  parentCategoryId: string | null,
) {
  if (level === "family") {
    if (parentCategoryId) {
      throw new Error("Una familia raiz no puede tener categoria superior.");
    }
    return null;
  }

  if (!parentCategoryId) {
    throw new Error("Debes seleccionar una familia superior para esta subfamilia.");
  }

  const parent = await getCurrentCategoryById(parentCategoryId);
  if (!parent) {
    throw new Error("La categoria superior seleccionada no existe o ya no esta activa.");
  }

  if (parent.level !== "family") {
    throw new Error("Una subfamilia solo puede colgar de una familia.");
  }

  return parent;
}

export async function listCurrentBodegaUnits() {
  await initializeBodegaMasters();

  const result = await queryCamp<CurrentUnitRow>(
    `
      select
        unit_id,
        unit_code,
        unit_name,
        unit_symbol,
        unit_dimension,
        decimal_precision,
        is_active,
        valid_from,
        valid_to,
        loaded_at,
        run_id,
        actor_id,
        change_reason
      from ${UNIT_DIM_TABLE}
      where is_current = true
      order by unit_code asc
    `,
  );

  return result.rows.map(mapUnitRow);
}

export async function createBodegaUnit(input: BodegaUnitInput, actorId: string) {
  await initializeBodegaMasters();

  const sanitized = sanitizeUnitInput(input);
  await ensureUniqueCurrentUnitCode(sanitized.code);

  const now = new Date();
  const unitId = makeEntityId("bunit");
  const runId = makeRunId("bodega_unit_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `
        insert into ${UNIT_REF_TABLE} (
          record_id, unit_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), unitId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${UNIT_DIM_TABLE} (
          record_id, unit_id, valid_from, valid_to, is_current, unit_code, unit_name, unit_symbol,
          unit_dimension, decimal_precision, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, true, $3, $10, $11, $12)
      `,
      [
        makeRecordId(),
        unitId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.symbol,
        sanitized.dimension,
        sanitized.decimalPrecision,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentUnitById(unitId);
}

export async function updateBodegaUnit(unitId: string, input: BodegaUnitInput, actorId: string) {
  await initializeBodegaMasters();

  const current = await getCurrentUnitById(unitId);
  if (!current) {
    throw new Error("No se encontro la unidad activa que intentas editar.");
  }

  const sanitized = sanitizeUnitInput(input);
  await ensureUniqueCurrentUnitCode(sanitized.code, unitId);

  const now = new Date();
  const runId = makeRunId("bodega_unit_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `update ${UNIT_REF_TABLE} set is_current = false, valid_to = $2 where unit_id = $1 and is_current = true`,
      [unitId, now],
    );
    await client.query(
      `update ${UNIT_DIM_TABLE} set is_current = false, valid_to = $2 where unit_id = $1 and is_current = true`,
      [unitId, now],
    );

    await client.query(
      `
        insert into ${UNIT_REF_TABLE} (
          record_id, unit_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), unitId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${UNIT_DIM_TABLE} (
          record_id, unit_id, valid_from, valid_to, is_current, unit_code, unit_name, unit_symbol,
          unit_dimension, decimal_precision, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, true, $3, $10, $11, $12)
      `,
      [
        makeRecordId(),
        unitId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.symbol,
        sanitized.dimension,
        sanitized.decimalPrecision,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentUnitById(unitId);
}

export async function listCurrentBodegaCategories() {
  const rows = await getCurrentCategoryRows();
  return mapCategoryRows(rows);
}

export async function createBodegaCategory(input: BodegaCategoryInput, actorId: string) {
  await initializeBodegaMasters();

  const sanitized = sanitizeCategoryInput(input);
  await ensureUniqueCurrentCategoryCode(sanitized.code);
  await validateCategoryParent(sanitized.level, sanitized.parentCategoryId ?? null);

  const now = new Date();
  const categoryId = makeEntityId("bcat");
  const runId = makeRunId("bodega_category_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `
        insert into ${CATEGORY_REF_TABLE} (
          record_id, category_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), categoryId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${CATEGORY_DIM_TABLE} (
          record_id, category_id, valid_from, valid_to, is_current, category_code, category_name, category_level,
          parent_category_id, sort_order, category_description, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13)
      `,
      [
        makeRecordId(),
        categoryId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.level,
        sanitized.parentCategoryId ?? null,
        sanitized.sortOrder,
        sanitized.description,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentCategoryById(categoryId);
}

export async function updateBodegaCategory(categoryId: string, input: BodegaCategoryInput, actorId: string) {
  await initializeBodegaMasters();

  const current = await getCurrentCategoryById(categoryId);
  if (!current) {
    throw new Error("No se encontro la categoria activa que intentas editar.");
  }

  const sanitized = sanitizeCategoryInput(input);
  await ensureUniqueCurrentCategoryCode(sanitized.code, categoryId);
  await validateCategoryParent(sanitized.level, sanitized.parentCategoryId ?? null);

  const now = new Date();
  const runId = makeRunId("bodega_category_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `update ${CATEGORY_REF_TABLE} set is_current = false, valid_to = $2 where category_id = $1 and is_current = true`,
      [categoryId, now],
    );
    await client.query(
      `update ${CATEGORY_DIM_TABLE} set is_current = false, valid_to = $2 where category_id = $1 and is_current = true`,
      [categoryId, now],
    );

    await client.query(
      `
        insert into ${CATEGORY_REF_TABLE} (
          record_id, category_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), categoryId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${CATEGORY_DIM_TABLE} (
          record_id, category_id, valid_from, valid_to, is_current, category_code, category_name, category_level,
          parent_category_id, sort_order, category_description, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13)
      `,
      [
        makeRecordId(),
        categoryId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.level,
        sanitized.parentCategoryId ?? null,
        sanitized.sortOrder,
        sanitized.description,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentCategoryById(categoryId);
}

async function ensureCurrentUnitExists(unitId: string) {
  const unit = await getCurrentUnitById(unitId);
  if (!unit) {
    throw new Error("La unidad base seleccionada no existe o ya no esta activa.");
  }
  return unit;
}

async function ensureCurrentCategoryExists(categoryId: string) {
  const category = await getCurrentCategoryById(categoryId);
  if (!category) {
    throw new Error("La categoria seleccionada no existe o ya no esta activa.");
  }
  return category;
}

async function ensureCurrentActivitiesExist(activityIds: string[]) {
  const activityMap = await getCurrentBodegaSourceActivitiesById(activityIds);
  const missing = activityIds.filter((activityId) => !activityMap.has(activityId));

  if (missing.length) {
    throw new Error(`Las siguientes actividades no existen o ya no estan vigentes: ${missing.join(", ")}.`);
  }

  return activityMap;
}

async function getCurrentProductRows() {
  await initializeBodegaMasters();

  const result = await queryCamp<CurrentProductRow>(
    `
      select
        dim.product_id,
        dim.product_code,
        dim.product_name,
        dim.product_description,
        dim.base_unit_id,
        units.unit_code,
        units.unit_name,
        dim.category_id,
        dim.active_component_mode,
        dim.active_component_name,
        dim.is_active,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${PRODUCT_DIM_TABLE} dim
      inner join ${PRODUCT_REF_TABLE} ref
        on ref.product_id = dim.product_id
       and ref.is_current = true
      inner join ${UNIT_DIM_TABLE} units
        on units.unit_id = dim.base_unit_id
       and units.is_current = true
      where dim.is_current = true
      order by dim.product_code asc, dim.product_name asc
    `,
  );

  return result.rows;
}

async function getCurrentAssignments() {
  const result = await queryCamp<CurrentAssignmentRow>(
    `
      select
        product_id,
        activity_id,
        branch_order
      from ${PRODUCT_USAGE_TABLE}
      where is_current = true
      order by product_id asc, branch_order asc
    `,
  );

  return result.rows;
}

async function getCurrentProductById(productId: string) {
  const [products, categories, assignments] = await Promise.all([
    getCurrentProductRows(),
    getCurrentCategoryRows(),
    getCurrentAssignments(),
  ]);

  const categoryMap = new Map(mapCategoryRows(categories).map((category) => [category.categoryId, category]));
  const activityMap = await getCurrentBodegaSourceActivitiesById(assignments.map((assignment) => assignment.activity_id));
  const assignmentMap = mapAssignments(assignments, activityMap);
  const row = products.find((item) => item.product_id === productId);

  if (!row) {
    return null;
  }

  const category = categoryMap.get(row.category_id);

  return {
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    description: row.product_description,
    baseUnitId: row.base_unit_id,
    baseUnitCode: row.unit_code,
    baseUnitName: row.unit_name,
    categoryId: row.category_id,
    categoryPathLabel: category?.pathLabel ?? row.category_id,
    categoryLeafName: category?.name ?? row.category_id,
    activeComponentMode: row.active_component_mode,
    activeComponentName: row.active_component_name,
    isActive: boolValue(row.is_active, true),
    assignments: assignmentMap.get(row.product_id) ?? [],
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  } satisfies BodegaProductRecord;
}

export async function listCurrentBodegaProducts() {
  const [products, categories, assignments] = await Promise.all([
    getCurrentProductRows(),
    getCurrentCategoryRows(),
    getCurrentAssignments(),
  ]);

  const categoryMap = new Map(mapCategoryRows(categories).map((category) => [category.categoryId, category]));
  const activityMap = await getCurrentBodegaSourceActivitiesById(assignments.map((assignment) => assignment.activity_id));
  const assignmentMap = mapAssignments(assignments, activityMap);

  return products.map((row) => {
    const category = categoryMap.get(row.category_id);

    return {
      productId: row.product_id,
      productCode: row.product_code,
      productName: row.product_name,
      description: row.product_description,
      baseUnitId: row.base_unit_id,
      baseUnitCode: row.unit_code,
      baseUnitName: row.unit_name,
      categoryId: row.category_id,
      categoryPathLabel: category?.pathLabel ?? row.category_id,
      categoryLeafName: category?.name ?? row.category_id,
      activeComponentMode: row.active_component_mode,
      activeComponentName: row.active_component_name,
      isActive: boolValue(row.is_active, true),
      assignments: assignmentMap.get(row.product_id) ?? [],
      validFrom: formatTimestamp(row.valid_from),
      validTo: formatTimestamp(row.valid_to),
      loadedAt: formatTimestamp(row.loaded_at),
      runId: row.run_id,
      actorId: row.actor_id,
      changeReason: row.change_reason,
    } satisfies BodegaProductRecord;
  });
}

export async function createBodegaProduct(input: BodegaProductInput, actorId: string) {
  await initializeBodegaMasters();

  const sanitized = sanitizeProductInput(input);
  await ensureUniqueCurrentProductCode(sanitized.productCode);
  await ensureCurrentUnitExists(sanitized.baseUnitId);
  await ensureCurrentCategoryExists(sanitized.categoryId);
  await ensureCurrentActivitiesExist(sanitized.assignments.map((assignment) => assignment.activityId));

  const now = new Date();
  const productId = makeEntityId("bprod");
  const runId = makeRunId("bodega_product_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `
        insert into ${PRODUCT_REF_TABLE} (
          record_id, product_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), productId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${PRODUCT_DIM_TABLE} (
          record_id, product_id, valid_from, valid_to, is_current, product_code, product_name,
          product_description, base_unit_id, category_id, active_component_mode, active_component_name, is_active,
          is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, $11, true, $3, $12, $13, $14)
      `,
      [
        makeRecordId(),
        productId,
        now,
        sanitized.productCode,
        sanitized.productName,
        sanitized.description,
        sanitized.baseUnitId,
        sanitized.categoryId,
        sanitized.activeComponentMode,
        sanitized.activeComponentName,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );

    for (const assignment of sanitized.assignments) {
      await client.query(
        `
          insert into ${PRODUCT_USAGE_TABLE} (
            record_id, product_id, valid_from, valid_to, is_current, branch_order, activity_id,
            is_valid, loaded_at, run_id, actor_id, change_reason
          ) values ($1, $2, $3, null, true, $4, $5, true, $3, $6, $7, $8)
        `,
        [
          makeRecordId(),
          productId,
          now,
          assignment.branchOrder,
          assignment.activityId,
          runId,
          actorId,
          changeReason,
        ],
      );
    }
  });

  return getCurrentProductById(productId);
}

export async function updateBodegaProduct(productId: string, input: BodegaProductInput, actorId: string) {
  await initializeBodegaMasters();

  const current = await getCurrentProductById(productId);
  if (!current) {
    throw new Error("No se encontro el producto activo que intentas editar.");
  }

  const sanitized = sanitizeProductInput(input);
  await ensureUniqueCurrentProductCode(sanitized.productCode, productId);
  await ensureCurrentUnitExists(sanitized.baseUnitId);
  await ensureCurrentCategoryExists(sanitized.categoryId);
  await ensureCurrentActivitiesExist(sanitized.assignments.map((assignment) => assignment.activityId));

  const now = new Date();
  const runId = makeRunId("bodega_product_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `update ${PRODUCT_REF_TABLE} set is_current = false, valid_to = $2 where product_id = $1 and is_current = true`,
      [productId, now],
    );
    await client.query(
      `update ${PRODUCT_DIM_TABLE} set is_current = false, valid_to = $2 where product_id = $1 and is_current = true`,
      [productId, now],
    );
    await client.query(
      `update ${PRODUCT_USAGE_TABLE} set is_current = false, valid_to = $2 where product_id = $1 and is_current = true`,
      [productId, now],
    );

    await client.query(
      `
        insert into ${PRODUCT_REF_TABLE} (
          record_id, product_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), productId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${PRODUCT_DIM_TABLE} (
          record_id, product_id, valid_from, valid_to, is_current, product_code, product_name,
          product_description, base_unit_id, category_id, active_component_mode, active_component_name, is_active,
          is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, $11, true, $3, $12, $13, $14)
      `,
      [
        makeRecordId(),
        productId,
        now,
        sanitized.productCode,
        sanitized.productName,
        sanitized.description,
        sanitized.baseUnitId,
        sanitized.categoryId,
        sanitized.activeComponentMode,
        sanitized.activeComponentName,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );

    for (const assignment of sanitized.assignments) {
      await client.query(
        `
          insert into ${PRODUCT_USAGE_TABLE} (
            record_id, product_id, valid_from, valid_to, is_current, branch_order, activity_id,
            is_valid, loaded_at, run_id, actor_id, change_reason
          ) values ($1, $2, $3, null, true, $4, $5, true, $3, $6, $7, $8)
        `,
        [
          makeRecordId(),
          productId,
          now,
          assignment.branchOrder,
          assignment.activityId,
          runId,
          actorId,
          changeReason,
        ],
      );
    }
  });

  return getCurrentProductById(productId);
}

async function ensureUniqueCurrentPresentationCode(code: string, excludePresentationId?: string) {
  const result = await queryCamp<{ presentation_id: string }>(
    `
      select presentation_id
      from ${PRESENTATION_DIM_TABLE}
      where is_current = true
        and is_valid = true
        and lower(regexp_replace(trim(presentation_code), '\s+', ' ', 'g')) = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
        and ($2::text is null or presentation_id <> $2)
      limit 1
    `,
    [code, excludePresentationId ?? null],
  );

  if (result.rows.length) {
    throw new Error(`Ya existe una presentacion activa con el codigo "${code}".`);
  }
}

function resolvePresentationConversion(
  presentationUnit: BodegaUnitRecord,
  baseUnit: BodegaUnitRecord,
  presentationQuantity: number,
  manualEquivalentBaseQuantity: number | null,
) {
  if (presentationUnit.unitId === baseUnit.unitId) {
    return {
      equivalentBaseQuantity: roundQuantity(presentationQuantity),
      conversionMode: "auto" as const,
    };
  }

  if (presentationUnit.dimension === baseUnit.dimension) {
    const sourceFactor = UNIT_CONVERSION_FACTORS[presentationUnit.code];
    const targetFactor = UNIT_CONVERSION_FACTORS[baseUnit.code];
    if (sourceFactor && targetFactor) {
      return {
        equivalentBaseQuantity: roundQuantity((presentationQuantity * sourceFactor) / targetFactor),
        conversionMode: "auto" as const,
      };
    }
  }

  if (manualEquivalentBaseQuantity !== null) {
    return {
      equivalentBaseQuantity: roundQuantity(manualEquivalentBaseQuantity),
      conversionMode: "manual" as const,
    };
  }

  throw new Error(
    `No existe conversion automatica entre ${presentationUnit.code} y ${baseUnit.code}. Debes registrar la equivalencia manual a unidad base antes de guardar.`,
  );
}

async function getCurrentPresentationRows() {
  await initializeBodegaMasters();

  const result = await queryCamp<CurrentPresentationRow>(
    `
      select
        pres.presentation_id,
        pres.product_id,
        prod.product_code,
        prod.product_name,
        pres.commercial_name,
        pres.presentation_code,
        pres.presentation_name,
        pres.package_name,
        pres.presentation_quantity,
        pres.presentation_unit_id,
        pu.unit_code as presentation_unit_code,
        pu.unit_name as presentation_unit_name,
        pres.base_unit_id,
        bu.unit_code as base_unit_code,
        bu.unit_name as base_unit_name,
        pres.equivalent_base_quantity,
        pres.conversion_mode,
        pres.allows_fractioning,
        pres.operational_note,
        pres.is_active,
        pres.valid_from,
        pres.valid_to,
        pres.loaded_at,
        pres.run_id,
        pres.actor_id,
        pres.change_reason
      from ${PRESENTATION_DIM_TABLE} pres
      inner join ${PRESENTATION_REF_TABLE} pref
        on pref.presentation_id = pres.presentation_id
       and pref.is_current = true
      inner join ${PRODUCT_DIM_TABLE} prod
        on prod.product_id = pres.product_id
       and prod.is_current = true
      inner join ${UNIT_DIM_TABLE} pu
        on pu.unit_id = pres.presentation_unit_id
       and pu.is_current = true
      left join ${UNIT_DIM_TABLE} bu
        on bu.unit_id = pres.base_unit_id
       and bu.is_current = true
      where pres.is_current = true
      order by prod.product_code asc, pres.presentation_code asc
    `,
  );

  return result.rows;
}

function mapPresentationRow(row: CurrentPresentationRow): BodegaPresentationRecord {
  const conversionMode = isPresentationConversionMode(row.conversion_mode)
    ? row.conversion_mode
    : "manual";

  return {
    presentationId: row.presentation_id,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    commercialName: row.commercial_name,
    presentationCode: row.presentation_code,
    presentationName: row.presentation_name,
    packageName: row.package_name,
    presentationQuantity: Number(row.presentation_quantity ?? 0),
    presentationUnitId: row.presentation_unit_id,
    presentationUnitCode: row.presentation_unit_code,
    presentationUnitName: row.presentation_unit_name,
    baseUnitId: row.base_unit_id,
    baseUnitCode: row.base_unit_code,
    baseUnitName: row.base_unit_name,
    equivalentBaseQuantity: Number(row.equivalent_base_quantity ?? 0),
    conversionMode,
    allowsFractioning: boolValue(row.allows_fractioning, false),
    operationalNote: row.operational_note,
    isActive: boolValue(row.is_active, true),
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  };
}

async function getCurrentPresentationById(presentationId: string) {
  const rows = await getCurrentPresentationRows();
  const row = rows.find((item) => item.presentation_id === presentationId);
  return row ? mapPresentationRow(row) : null;
}

export async function listCurrentBodegaPresentations() {
  const rows = await getCurrentPresentationRows();
  return rows.map(mapPresentationRow);
}

export async function createBodegaPresentation(input: BodegaPresentationInput, actorId: string) {
  await initializeBodegaMasters();

  const sanitized = sanitizePresentationInput(input);
  await ensureUniqueCurrentPresentationCode(sanitized.presentationCode);
  const product = await getCurrentProductById(sanitized.productId);
  if (!product) {
    throw new Error("El producto maestro seleccionado no existe o ya no esta activo.");
  }
  const presentationUnit = await ensureCurrentUnitExists(sanitized.presentationUnitId);
  const baseUnit = await ensureCurrentUnitExists(product.baseUnitId);
  const resolved = resolvePresentationConversion(
    presentationUnit,
    baseUnit,
    sanitized.presentationQuantity,
    sanitized.equivalentBaseQuantity ?? null,
  );

  const now = new Date();
  const presentationId = makeEntityId("bpres");
  const runId = makeRunId("bodega_presentation_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `
        insert into ${PRESENTATION_REF_TABLE} (
          record_id, presentation_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), presentationId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${PRESENTATION_DIM_TABLE} (
          record_id, presentation_id, product_id, valid_from, valid_to, is_current, presentation_code, presentation_name,
          commercial_name, package_name, presentation_quantity, presentation_unit_id, equivalent_base_quantity, conversion_mode,
          base_unit_id, allows_fractioning, operational_note, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, $4, null, true, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $4, $17, $18, $19)
      `,
      [
        makeRecordId(),
        presentationId,
        product.productId,
        now,
        sanitized.presentationCode,
        sanitized.presentationName,
        sanitized.commercialName,
        sanitized.packageName,
        sanitized.presentationQuantity,
        sanitized.presentationUnitId,
        resolved.equivalentBaseQuantity,
        resolved.conversionMode,
        product.baseUnitId,
        sanitized.allowsFractioning,
        sanitized.operationalNote,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentPresentationById(presentationId);
}

export async function updateBodegaPresentation(presentationId: string, input: BodegaPresentationInput, actorId: string) {
  await initializeBodegaMasters();

  const current = await getCurrentPresentationById(presentationId);
  if (!current) {
    throw new Error("No se encontro la presentacion activa que intentas editar.");
  }

  const sanitized = sanitizePresentationInput(input);
  await ensureUniqueCurrentPresentationCode(sanitized.presentationCode, presentationId);
  const product = await getCurrentProductById(sanitized.productId);
  if (!product) {
    throw new Error("El producto maestro seleccionado no existe o ya no esta activo.");
  }
  const presentationUnit = await ensureCurrentUnitExists(sanitized.presentationUnitId);
  const baseUnit = await ensureCurrentUnitExists(product.baseUnitId);
  const resolved = resolvePresentationConversion(
    presentationUnit,
    baseUnit,
    sanitized.presentationQuantity,
    sanitized.equivalentBaseQuantity ?? null,
  );

  const now = new Date();
  const runId = makeRunId("bodega_presentation_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withCampTransaction(async (client) => {
    await client.query(
      `update ${PRESENTATION_REF_TABLE} set is_current = false, valid_to = $2 where presentation_id = $1 and is_current = true`,
      [presentationId, now],
    );
    await client.query(
      `update ${PRESENTATION_DIM_TABLE} set is_current = false, valid_to = $2 where presentation_id = $1 and is_current = true`,
      [presentationId, now],
    );

    await client.query(
      `
        insert into ${PRESENTATION_REF_TABLE} (
          record_id, presentation_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), presentationId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${PRESENTATION_DIM_TABLE} (
          record_id, presentation_id, product_id, valid_from, valid_to, is_current, presentation_code, presentation_name,
          commercial_name, package_name, presentation_quantity, presentation_unit_id, equivalent_base_quantity, conversion_mode,
          base_unit_id, allows_fractioning, operational_note, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, $4, null, true, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $4, $17, $18, $19)
      `,
      [
        makeRecordId(),
        presentationId,
        product.productId,
        now,
        sanitized.presentationCode,
        sanitized.presentationName,
        sanitized.commercialName,
        sanitized.packageName,
        sanitized.presentationQuantity,
        sanitized.presentationUnitId,
        resolved.equivalentBaseQuantity,
        resolved.conversionMode,
        product.baseUnitId,
        sanitized.allowsFractioning,
        sanitized.operationalNote,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentPresentationById(presentationId);
}

export async function getBodegaMasterCounts() {
  await initializeBodegaMasters();

  const [units, categories, products, presentations] = await Promise.all([
    queryCamp<CountRow>(`select count(*)::int as total from ${UNIT_DIM_TABLE} where is_current = true`),
    queryCamp<CountRow>(`select count(*)::int as total from ${CATEGORY_DIM_TABLE} where is_current = true`),
    queryCamp<CountRow>(`select count(*)::int as total from ${PRODUCT_DIM_TABLE} where is_current = true`),
    queryCamp<CountRow>(`select count(*)::int as total from ${PRESENTATION_DIM_TABLE} where is_current = true`),
  ]);

  return {
    units: Number(units.rows[0]?.total ?? 0),
    categories: Number(categories.rows[0]?.total ?? 0),
    products: Number(products.rows[0]?.total ?? 0),
    presentations: Number(presentations.rows[0]?.total ?? 0),
  };
}
