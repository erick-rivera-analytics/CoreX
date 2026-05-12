import crypto from "crypto";
import type { PoolClient } from "pg";

import { queryPostharvest, withPostharvestTransaction } from "@/lib/postcosecha-db";
import type {
  PostharvestDestinationInput,
  PostharvestDestinationRecord,
} from "@/lib/postcosecha-destination-types";

type CurrentDestinationRow = {
  entity_id: string;
  entity_code: string;
  entity_name: string;
  entity_description: string | null;
  external_ref_code: string | null;
  contact_email: string | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

const REF_TABLE = "public.postharvest_ref_destination_id_core_scd2";
const DIM_TABLE = "public.postharvest_dim_destination_profile_scd2";
const ENTITY_PREFIX = "phdst";

declare global {
  var __dashboardPostharvestDestinationsSetup: Promise<void> | undefined;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCode(value: string) {
  return normalizeText(value).toUpperCase();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  return normalized || null;
}

function normalizeOptionalEmail(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value)?.toLowerCase() ?? null;
  return normalized || null;
}

function boolValue(value: boolean | null | undefined, fallback = true) {
  return value ?? fallback;
}

function makeRunId(prefix: string) {
  return `${prefix}_${new Date().toISOString()}`;
}

function makeRecordId() {
  return crypto.randomUUID();
}

function makeEntityId() {
  return `${ENTITY_PREFIX}_${crypto.randomUUID()}`;
}

function sanitizeDestinationInput(input: PostharvestDestinationInput) {
  const code = normalizeCode(input.code);
  const name = normalizeText(input.name);
  const description = normalizeOptionalText(input.description);
  const externalRefCode = normalizeOptionalText(input.externalRefCode);
  const contactEmail = normalizeOptionalEmail(input.contactEmail);
  const changeReason = normalizeOptionalText(input.changeReason);

  if (!code) {
    throw new Error("El codigo es obligatorio.");
  }

  if (!name) {
    throw new Error("El nombre es obligatorio.");
  }

  return {
    code,
    name,
    description,
    externalRefCode,
    contactEmail,
    isActive: boolValue(input.isActive, true),
    changeReason,
  } satisfies PostharvestDestinationInput;
}

async function ensurePostharvestDestinationTables(client?: PoolClient) {
  const runQuery = (text: string) => client ? client.query(text) : queryPostharvest(text);

  await runQuery(`
    create table if not exists ${REF_TABLE} (
      record_id text primary key,
      entity_id text not null,
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
      entity_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      entity_code text not null,
      entity_name text not null,
      entity_description text null,
      external_ref_code text null,
      contact_email text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create unique index if not exists postharvest_ref_destination_id_core_scd2_current_idx
      on ${REF_TABLE} (entity_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists postharvest_dim_destination_profile_scd2_current_idx
      on ${DIM_TABLE} (entity_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists postharvest_dim_destination_profile_scd2_current_code_unique_idx
      on ${DIM_TABLE} (lower(regexp_replace(trim(entity_code), '\\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create index if not exists postharvest_dim_destination_profile_scd2_name_idx
      on ${DIM_TABLE} (lower(regexp_replace(trim(entity_name), '\\s+', ' ', 'g')))
  `);
}

export async function initializePostharvestDestinations() {
  if (!global.__dashboardPostharvestDestinationsSetup) {
    global.__dashboardPostharvestDestinationsSetup = ensurePostharvestDestinationTables();
  }

  return global.__dashboardPostharvestDestinationsSetup;
}

function mapDestinationRow(row: CurrentDestinationRow): PostharvestDestinationRecord {
  return {
    kind: "postharvest-destination",
    entityId: row.entity_id,
    code: row.entity_code,
    name: row.entity_name,
    description: row.entity_description,
    externalRefCode: row.external_ref_code,
    contactEmail: row.contact_email,
    isActive: boolValue(row.is_active, true),
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  };
}

async function ensureUniqueCurrentDestinationCode(code: string, excludeEntityId?: string) {
  const result = await queryPostharvest<{ entity_id: string }>(
    `
      select entity_id
      from ${DIM_TABLE}
      where is_current = true
        and is_valid = true
        and lower(regexp_replace(trim(entity_code), '\\s+', ' ', 'g'))
          = lower(regexp_replace(trim($1), '\\s+', ' ', 'g'))
        and ($2::text is null or entity_id <> $2)
      limit 1
    `,
    [code, excludeEntityId ?? null],
  );

  if (result.rows.length > 0) {
    throw new Error(`Ya existe un destino activo con el codigo "${code}".`);
  }
}

async function getCurrentDestinationById(entityId: string) {
  const result = await queryPostharvest<CurrentDestinationRow>(
    `
      select
        dim.entity_id,
        dim.entity_code,
        dim.entity_name,
        dim.entity_description,
        dim.external_ref_code,
        dim.contact_email,
        dim.is_active,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${DIM_TABLE} dim
      inner join ${REF_TABLE} ref
        on ref.entity_id = dim.entity_id
       and ref.is_current = true
       and ref.is_valid = true
      where dim.entity_id = $1
        and dim.is_current = true
        and dim.is_valid = true
      limit 1
    `,
    [entityId],
  );

  return result.rows[0] ? mapDestinationRow(result.rows[0]) : null;
}

export async function listCurrentPostharvestDestinations() {
  await initializePostharvestDestinations();

  const result = await queryPostharvest<CurrentDestinationRow>(
    `
      select
        dim.entity_id,
        dim.entity_code,
        dim.entity_name,
        dim.entity_description,
        dim.external_ref_code,
        dim.contact_email,
        dim.is_active,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${DIM_TABLE} dim
      inner join ${REF_TABLE} ref
        on ref.entity_id = dim.entity_id
       and ref.is_current = true
       and ref.is_valid = true
      where dim.is_current = true
        and dim.is_valid = true
      order by lower(dim.entity_name) asc
    `,
  );

  return result.rows.map(mapDestinationRow);
}

export async function createPostharvestDestination(
  input: PostharvestDestinationInput,
  actorId: string,
) {
  await initializePostharvestDestinations();

  const sanitized = sanitizeDestinationInput(input);
  await ensureUniqueCurrentDestinationCode(sanitized.code);

  const now = new Date();
  const entityId = makeEntityId();
  const runId = makeRunId("postharvest_destination_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withPostharvestTransaction(async (client) => {
    await client.query(
      `
        insert into ${REF_TABLE} (
          record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), entityId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${DIM_TABLE} (
          record_id, entity_id, valid_from, valid_to, is_current, entity_code, entity_name, entity_description,
          external_ref_code, contact_email, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, true, $3, $10, $11, $12)
      `,
      [
        makeRecordId(),
        entityId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.description,
        sanitized.externalRefCode,
        sanitized.contactEmail,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentDestinationById(entityId);
}

export async function updatePostharvestDestination(
  entityId: string,
  input: PostharvestDestinationInput,
  actorId: string,
) {
  await initializePostharvestDestinations();

  const current = await getCurrentDestinationById(entityId);
  if (!current) {
    throw new Error("No se encontro el destino activo que intentas editar.");
  }

  const sanitized = sanitizeDestinationInput(input);
  await ensureUniqueCurrentDestinationCode(sanitized.code, entityId);

  const now = new Date();
  const runId = makeRunId("postharvest_destination_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withPostharvestTransaction(async (client) => {
    await client.query(
      `update ${REF_TABLE} set is_current = false, valid_to = $2 where entity_id = $1 and is_current = true`,
      [entityId, now],
    );
    await client.query(
      `update ${DIM_TABLE} set is_current = false, valid_to = $2 where entity_id = $1 and is_current = true`,
      [entityId, now],
    );

    await client.query(
      `
        insert into ${REF_TABLE} (
          record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), entityId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${DIM_TABLE} (
          record_id, entity_id, valid_from, valid_to, is_current, entity_code, entity_name, entity_description,
          external_ref_code, contact_email, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, true, $3, $10, $11, $12)
      `,
      [
        makeRecordId(),
        entityId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.description,
        sanitized.externalRefCode,
        sanitized.contactEmail,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentDestinationById(entityId);
}
