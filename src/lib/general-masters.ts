import crypto from "crypto";
import type { PoolClient } from "pg";

import { queryGeneral, withGeneralTransaction } from "@/lib/general-db";
import type {
  GeneralSimpleMasterInput,
  GeneralSimpleMasterKind,
  GeneralSimpleMasterRecord,
} from "@/lib/general-master-types";

type SimpleMasterConfig = {
  kind: GeneralSimpleMasterKind;
  entityPrefix: string;
  refTable: string;
  dimTable: string;
};

type CurrentSimpleRow = {
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

const SIMPLE_MASTER_CONFIGS: SimpleMasterConfig[] = [
  {
    kind: "varieties",
    entityPrefix: "gvar",
    refTable: "public.gnl_ref_variety_id_core_scd2",
    dimTable: "public.gnl_dim_variety_profile_scd2",
  },
  {
    kind: "farms",
    entityPrefix: "gfrm",
    refTable: "public.gnl_ref_farm_id_core_scd2",
    dimTable: "public.gnl_dim_farm_profile_scd2",
  },
];

declare global {
  var __dashboardGeneralMastersSetup: Promise<void> | undefined;
}

function getSimpleMasterConfig(kind: GeneralSimpleMasterKind) {
  const config = SIMPLE_MASTER_CONFIGS.find((item) => item.kind === kind);
  if (!config) {
    throw new Error(`No existe configuracion para el maestro ${kind}.`);
  }
  return config;
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

function makeEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sanitizeSimpleMasterInput(input: GeneralSimpleMasterInput) {
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
  } satisfies GeneralSimpleMasterInput;
}

async function ensureSimpleMasterTables(client?: PoolClient) {
  const runQuery = (text: string) => client ? client.query(text) : queryGeneral(text);

  for (const config of SIMPLE_MASTER_CONFIGS) {
    await runQuery(`
      create table if not exists ${config.refTable} (
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
      create table if not exists ${config.dimTable} (
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
      create unique index if not exists ${config.refTable.split(".")[1]}_current_idx
        on ${config.refTable} (entity_id)
        where is_current
    `);

    await runQuery(`
      create unique index if not exists ${config.dimTable.split(".")[1]}_current_idx
        on ${config.dimTable} (entity_id)
        where is_current
    `);

    await runQuery(`
      create unique index if not exists ${config.dimTable.split(".")[1]}_current_code_unique_idx
        on ${config.dimTable} (lower(regexp_replace(trim(entity_code), '\\s+', ' ', 'g')))
        where is_current = true
          and is_valid = true
    `);

    await runQuery(`
      create index if not exists ${config.dimTable.split(".")[1]}_name_idx
        on ${config.dimTable} (lower(regexp_replace(trim(entity_name), '\\s+', ' ', 'g')))
    `);
  }
}

export async function initializeGeneralMasters() {
  if (!global.__dashboardGeneralMastersSetup) {
    global.__dashboardGeneralMastersSetup = ensureSimpleMasterTables();
  }

  return global.__dashboardGeneralMastersSetup;
}

async function ensureUniqueCurrentSimpleMasterCode(
  kind: GeneralSimpleMasterKind,
  code: string,
  excludeEntityId?: string,
) {
  const config = getSimpleMasterConfig(kind);
  const result = await queryGeneral<{ entity_id: string }>(
    `
      select entity_id
      from ${config.dimTable}
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
    throw new Error(`Ya existe un registro activo con el codigo "${code}".`);
  }
}

function mapSimpleMasterRow(kind: GeneralSimpleMasterKind, row: CurrentSimpleRow): GeneralSimpleMasterRecord {
  return {
    kind,
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

async function getCurrentSimpleMasterRows(kind: GeneralSimpleMasterKind) {
  await initializeGeneralMasters();
  const config = getSimpleMasterConfig(kind);
  const result = await queryGeneral<CurrentSimpleRow>(
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
      from ${config.dimTable} dim
      inner join ${config.refTable} ref
        on ref.entity_id = dim.entity_id
       and ref.is_current = true
       and ref.is_valid = true
      where dim.is_current = true
        and dim.is_valid = true
      order by lower(dim.entity_name) asc
    `,
  );

  return result.rows;
}

async function getCurrentSimpleMasterById(kind: GeneralSimpleMasterKind, entityId: string) {
  const row = (await getCurrentSimpleMasterRows(kind)).find((item) => item.entity_id === entityId);
  return row ? mapSimpleMasterRow(kind, row) : null;
}

export async function listCurrentGeneralSimpleMasterRecords(kind: GeneralSimpleMasterKind) {
  const rows = await getCurrentSimpleMasterRows(kind);
  return rows.map((row) => mapSimpleMasterRow(kind, row));
}

export async function createGeneralSimpleMasterRecord(
  kind: GeneralSimpleMasterKind,
  input: GeneralSimpleMasterInput,
  actorId: string,
) {
  await initializeGeneralMasters();

  const config = getSimpleMasterConfig(kind);
  const sanitized = sanitizeSimpleMasterInput(input);
  await ensureUniqueCurrentSimpleMasterCode(kind, sanitized.code);

  const now = new Date();
  const entityId = makeEntityId(config.entityPrefix);
  const runId = makeRunId(`general_${kind}_create`);
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withGeneralTransaction(async (client) => {
    await client.query(
      `
        insert into ${config.refTable} (
          record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), entityId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${config.dimTable} (
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

  return getCurrentSimpleMasterById(kind, entityId);
}

export async function updateGeneralSimpleMasterRecord(
  kind: GeneralSimpleMasterKind,
  entityId: string,
  input: GeneralSimpleMasterInput,
  actorId: string,
) {
  await initializeGeneralMasters();

  const config = getSimpleMasterConfig(kind);
  const current = await getCurrentSimpleMasterById(kind, entityId);
  if (!current) {
    throw new Error("No se encontro el registro activo que intentas editar.");
  }

  const sanitized = sanitizeSimpleMasterInput(input);
  await ensureUniqueCurrentSimpleMasterCode(kind, sanitized.code, entityId);

  const now = new Date();
  const runId = makeRunId(`general_${kind}_update`);
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withGeneralTransaction(async (client) => {
    await client.query(
      `update ${config.refTable} set is_current = false, valid_to = $2 where entity_id = $1 and is_current = true`,
      [entityId, now],
    );
    await client.query(
      `update ${config.dimTable} set is_current = false, valid_to = $2 where entity_id = $1 and is_current = true`,
      [entityId, now],
    );

    await client.query(
      `
        insert into ${config.refTable} (
          record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), entityId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${config.dimTable} (
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

  return getCurrentSimpleMasterById(kind, entityId);
}
