import crypto from "crypto";
import type { PoolClient } from "pg";

import { queryCamp, withCampTransaction } from "@/lib/camp-db";
import type {
  CampoDrenchProductInput,
  CampoDrenchProductRecord,
} from "@/lib/campo-drench-product-types";

const REF_TABLE = "public.field_ref_drench_product_id_core_scd2";
const DIM_TABLE = "public.field_dim_drench_product_profile_scd2";

declare global {
  var __dashboardCampoDrenchProductSetup: Promise<void> | undefined;
}

type DrenchProductRow = {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit_name: string | null;
  utilization: string | null;
  warehouse_availability: string | null;
  application_day: string | null;
  application_ph: string | null;
  reentry_hours: string | null;
  application_reason_1: string | null;
  application_reason_2: string | null;
  application_reason_3: string | null;
  application_reason_4: string | null;
  active_ingredient: string | null;
  toxicological_category: string | null;
  toxicological_description: string | null;
  agrochemical_order: string | null;
  predisposition: string | null;
  reference_dose: string | null;
  withholding_period: string | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeOptional(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function normalizeCode(value: unknown) {
  const cleaned = cleanText(value).toUpperCase();
  return cleaned || null;
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toISOString() : null;
}

function makeRecordId() {
  return crypto.randomUUID();
}

function makeProductId() {
  return `drench_product_${crypto.randomUUID()}`;
}

function makeRunId(prefix: string) {
  return `${prefix}_${new Date().toISOString()}`;
}

function sanitizeProductInput(input: CampoDrenchProductInput): CampoDrenchProductInput {
  const productName = cleanText(input.productName);

  if (!productName) {
    throw new Error("El nombre del producto es obligatorio.");
  }

  return {
    productName,
    productCode: normalizeCode(input.productCode),
    unit: normalizeOptional(input.unit),
    utilization: normalizeOptional(input.utilization),
    warehouseAvailability: normalizeOptional(input.warehouseAvailability),
    applicationDay: normalizeOptional(input.applicationDay),
    applicationPh: normalizeOptional(input.applicationPh),
    reentryHours: normalizeOptional(input.reentryHours),
    applicationReason1: normalizeOptional(input.applicationReason1),
    applicationReason2: normalizeOptional(input.applicationReason2),
    applicationReason3: normalizeOptional(input.applicationReason3),
    applicationReason4: normalizeOptional(input.applicationReason4),
    activeIngredient: normalizeOptional(input.activeIngredient),
    toxicologicalCategory: normalizeOptional(input.toxicologicalCategory),
    toxicologicalDescription: normalizeOptional(input.toxicologicalDescription),
    agrochemicalOrder: normalizeOptional(input.agrochemicalOrder),
    predisposition: normalizeOptional(input.predisposition),
    referenceDose: normalizeOptional(input.referenceDose),
    withholdingPeriod: normalizeOptional(input.withholdingPeriod),
    changeReason: normalizeOptional(input.changeReason),
  };
}

function mapRow(row: DrenchProductRow): CampoDrenchProductRecord {
  return {
    productId: row.product_id,
    productName: row.product_name,
    productCode: row.product_code,
    unit: row.unit_name,
    utilization: row.utilization,
    warehouseAvailability: row.warehouse_availability,
    applicationDay: row.application_day,
    applicationPh: row.application_ph,
    reentryHours: row.reentry_hours,
    applicationReason1: row.application_reason_1,
    applicationReason2: row.application_reason_2,
    applicationReason3: row.application_reason_3,
    applicationReason4: row.application_reason_4,
    activeIngredient: row.active_ingredient,
    toxicologicalCategory: row.toxicological_category,
    toxicologicalDescription: row.toxicological_description,
    agrochemicalOrder: row.agrochemical_order,
    predisposition: row.predisposition,
    referenceDose: row.reference_dose,
    withholdingPeriod: row.withholding_period,
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  };
}

async function ensureTables(client?: PoolClient) {
  const runQuery = (text: string) => client ? client.query(text) : queryCamp(text);

  await runQuery(`
    create table if not exists ${REF_TABLE} (
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
    create table if not exists ${DIM_TABLE} (
      record_id text primary key,
      product_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      product_name text not null,
      product_code text null,
      unit_name text null,
      utilization text null,
      warehouse_availability text null,
      application_day text null,
      application_ph text null,
      reentry_hours text null,
      application_reason_1 text null,
      application_reason_2 text null,
      application_reason_3 text null,
      application_reason_4 text null,
      active_ingredient text null,
      toxicological_category text null,
      toxicological_description text null,
      agrochemical_order text null,
      predisposition text null,
      reference_dose text null,
      withholding_period text null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create unique index if not exists field_ref_drench_product_id_core_scd2_current_idx
      on ${REF_TABLE} (product_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists field_dim_drench_product_profile_scd2_current_idx
      on ${DIM_TABLE} (product_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists field_dim_drench_product_profile_scd2_current_name_idx
      on ${DIM_TABLE} (lower(regexp_replace(trim(product_name), '\\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create unique index if not exists field_dim_drench_product_profile_scd2_current_code_idx
      on ${DIM_TABLE} (lower(product_code))
      where is_current = true
        and is_valid = true
        and product_code is not null
        and trim(product_code) <> ''
  `);
}

async function insertProductVersion(
  client: PoolClient,
  {
    productId,
    input,
    now,
    runId,
    actorId,
    changeReason,
  }: {
    productId: string;
    input: CampoDrenchProductInput;
    now: Date;
    runId: string;
    actorId: string;
    changeReason: string;
  },
) {
  await client.query(
    `
      insert into ${REF_TABLE} (
        record_id,
        product_id,
        valid_from,
        valid_to,
        is_current,
        is_valid,
        loaded_at,
        run_id,
        actor_id,
        change_reason
      )
      values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
    `,
    [makeRecordId(), productId, now, runId, actorId, changeReason],
  );

  await client.query(
    `
      insert into ${DIM_TABLE} (
        record_id,
        product_id,
        valid_from,
        valid_to,
        is_current,
        product_name,
        product_code,
        unit_name,
        utilization,
        warehouse_availability,
        application_day,
        application_ph,
        reentry_hours,
        application_reason_1,
        application_reason_2,
        application_reason_3,
        application_reason_4,
        active_ingredient,
        toxicological_category,
        toxicological_description,
        agrochemical_order,
        predisposition,
        reference_dose,
        withholding_period,
        is_valid,
        loaded_at,
        run_id,
        actor_id,
        change_reason
      )
      values (
        $1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, true, $3, $23, $24, $25
      )
    `,
    [
      makeRecordId(),
      productId,
      now,
      input.productName,
      input.productCode,
      input.unit,
      input.utilization,
      input.warehouseAvailability,
      input.applicationDay,
      input.applicationPh,
      input.reentryHours,
      input.applicationReason1,
      input.applicationReason2,
      input.applicationReason3,
      input.applicationReason4,
      input.activeIngredient,
      input.toxicologicalCategory,
      input.toxicologicalDescription,
      input.agrochemicalOrder,
      input.predisposition,
      input.referenceDose,
      input.withholdingPeriod,
      runId,
      actorId,
      changeReason,
    ],
  );
}

export async function initializeCampoDrenchProductMaster() {
  if (!global.__dashboardCampoDrenchProductSetup) {
    global.__dashboardCampoDrenchProductSetup = ensureTables();
  }

  return global.__dashboardCampoDrenchProductSetup;
}

async function ensureUniqueCurrentProduct(input: CampoDrenchProductInput, excludeProductId?: string) {
  const normalizedCode = input.productCode ? input.productCode.toLowerCase() : null;
  const values = excludeProductId
    ? [input.productName, normalizedCode, excludeProductId]
    : [input.productName, normalizedCode];

  const codeClause = normalizedCode
    ? `or lower(product_code) = $2`
    : "";
  const excludeClause = excludeProductId
    ? `and product_id <> $${values.length}`
    : "";

  const result = await queryCamp<{ product_id: string }>(
    `
      select product_id
      from ${DIM_TABLE}
      where is_current = true
        and is_valid = true
        and (
          lower(regexp_replace(trim(product_name), '\\s+', ' ', 'g'))
            = lower(regexp_replace(trim($1), '\\s+', ' ', 'g'))
          ${codeClause}
        )
        ${excludeClause}
      limit 1
    `,
    values,
  );

  if (result.rows.length > 0) {
    throw new Error("Ya existe un producto Drench activo con ese nombre o codigo.");
  }
}

export async function listCurrentCampoDrenchProducts() {
  await initializeCampoDrenchProductMaster();

  const result = await queryCamp<DrenchProductRow>(
    `
      select
        dim.product_id,
        dim.product_name,
        dim.product_code,
        dim.unit_name,
        dim.utilization,
        dim.warehouse_availability,
        dim.application_day,
        dim.application_ph,
        dim.reentry_hours,
        dim.application_reason_1,
        dim.application_reason_2,
        dim.application_reason_3,
        dim.application_reason_4,
        dim.active_ingredient,
        dim.toxicological_category,
        dim.toxicological_description,
        dim.agrochemical_order,
        dim.predisposition,
        dim.reference_dose,
        dim.withholding_period,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${DIM_TABLE} dim
      inner join ${REF_TABLE} ref
        on ref.product_id = dim.product_id
       and ref.is_current = true
       and ref.is_valid = true
      where dim.is_current = true
        and dim.is_valid = true
      order by lower(dim.product_name) asc
    `,
  );

  return result.rows.map(mapRow);
}

async function getCurrentProductById(productId: string) {
  const result = await queryCamp<DrenchProductRow>(
    `
      select
        product_id,
        product_name,
        product_code,
        unit_name,
        utilization,
        warehouse_availability,
        application_day,
        application_ph,
        reentry_hours,
        application_reason_1,
        application_reason_2,
        application_reason_3,
        application_reason_4,
        active_ingredient,
        toxicological_category,
        toxicological_description,
        agrochemical_order,
        predisposition,
        reference_dose,
        withholding_period,
        valid_from,
        valid_to,
        loaded_at,
        run_id,
        actor_id,
        change_reason
      from ${DIM_TABLE}
      where product_id = $1
        and is_current = true
        and is_valid = true
      limit 1
    `,
    [productId],
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function createCampoDrenchProduct(input: CampoDrenchProductInput, actorId: string) {
  await initializeCampoDrenchProductMaster();
  const sanitized = sanitizeProductInput(input);
  await ensureUniqueCurrentProduct(sanitized);

  const now = new Date();
  const runId = makeRunId("campo_drench_product_create");
  const productId = makeProductId();
  const changeReason = sanitized.changeReason ?? "MANUAL_CREATE";

  await withCampTransaction(async (client) => {
    await ensureTables(client);
    await insertProductVersion(client, {
      productId,
      input: sanitized,
      now,
      runId,
      actorId,
      changeReason,
    });
  });

  return getCurrentProductById(productId);
}

export async function updateCampoDrenchProduct(
  productId: string,
  input: CampoDrenchProductInput,
  actorId: string,
) {
  await initializeCampoDrenchProductMaster();
  const current = await getCurrentProductById(productId);

  if (!current) {
    throw new Error("No se encontro el producto Drench solicitado.");
  }

  const sanitized = sanitizeProductInput(input);
  await ensureUniqueCurrentProduct(sanitized, productId);

  const now = new Date();
  const runId = makeRunId("campo_drench_product_update");
  const changeReason = sanitized.changeReason ?? "MANUAL_UPDATE";

  await withCampTransaction(async (client) => {
    await client.query(
      `
        update ${REF_TABLE}
        set is_current = false,
            valid_to = $2
        where product_id = $1
          and is_current = true
      `,
      [productId, now],
    );

    await client.query(
      `
        update ${DIM_TABLE}
        set is_current = false,
            valid_to = $2
        where product_id = $1
          and is_current = true
      `,
      [productId, now],
    );

    await insertProductVersion(client, {
      productId,
      input: sanitized,
      now,
      runId,
      actorId,
      changeReason,
    });
  });

  return getCurrentProductById(productId);
}
