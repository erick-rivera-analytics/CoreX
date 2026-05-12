import crypto from "crypto";
import type { PoolClient } from "pg";

import { queryCommercial, withCommercialTransaction } from "@/lib/commercial-db";
import type {
  ClaimProblemLevel,
  ClaimProblemScope,
  QualityClaimProblemInput,
  QualityClaimProblemRecord,
  QualitySimpleMasterInput,
  QualitySimpleMasterKind,
  QualitySimpleMasterRecord,
} from "@/lib/quality-master-types";

type SimpleMasterConfig = {
  kind: QualitySimpleMasterKind;
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

type CurrentClaimProblemRow = {
  problem_id: string;
  problem_code: string;
  problem_name: string;
  problem_level: ClaimProblemLevel;
  problem_scope: ClaimProblemScope;
  parent_problem_id: string | null;
  problem_description: string | null;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

type CurrentClaimProblemParentRow = {
  problem_id: string;
  parent_problem_id: string;
  parent_problem_name: string | null;
};

const SIMPLE_MASTER_CONFIGS: SimpleMasterConfig[] = [
  {
    kind: "account-executives",
    entityPrefix: "sexec",
    refTable: "public.sls_ref_account_executive_id_core_scd2",
    dimTable: "public.sls_dim_account_executive_profile_scd2",
  },
  {
    kind: "customers",
    entityPrefix: "scust",
    refTable: "public.sls_ref_customer_id_core_scd2",
    dimTable: "public.sls_dim_customer_profile_scd2",
  },
  {
    kind: "commercializers",
    entityPrefix: "scomm",
    refTable: "public.sls_ref_commercializer_id_core_scd2",
    dimTable: "public.sls_dim_commercializer_profile_scd2",
  },
];

const CLAIM_PROBLEM_REF_TABLE = "public.sls_ref_claim_problem_id_core_scd2";
const CLAIM_PROBLEM_DIM_TABLE = "public.sls_dim_claim_problem_profile_scd2";
const CLAIM_PROBLEM_PARENT_TABLE = "public.sls_bridge_claim_problem_parent_cur";

declare global {
  var __dashboardQualityMastersSetup: Promise<void> | undefined;
}

function getSimpleMasterConfig(kind: QualitySimpleMasterKind) {
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

function isClaimProblemLevel(value: string): value is ClaimProblemLevel {
  return value === "family" || value === "subfamily";
}

function isClaimProblemScope(value: string): value is ClaimProblemScope {
  return value === "quality" || value === "commercial" || value === "all";
}

function slugifyCodeFragment(value: string) {
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return ascii || "ITEM";
}

function buildClaimProblemCode(level: ClaimProblemLevel, scope: ClaimProblemScope, name: string) {
  const scopePart = {
    quality: "QLT",
    commercial: "COM",
    all: "ALL",
  }[scope];

  const levelPart = level === "family" ? "FAM" : "ITM";
  const slug = slugifyCodeFragment(name).slice(0, 64);

  return `CLM_${scopePart}_${levelPart}_${slug}`;
}

function uniqueNonEmptyTexts(values: Array<string | null | undefined>) {
  const normalizedValues = values
    .map((value) => normalizeOptionalText(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalizedValues));
}

function sanitizeSimpleMasterInput(input: QualitySimpleMasterInput) {
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
  } satisfies QualitySimpleMasterInput;
}

function sanitizeClaimProblemInput(input: QualityClaimProblemInput) {
  const name = normalizeText(input.name);
  const level = input.level;
  const scope = input.scope;
  const parentProblemIds = uniqueNonEmptyTexts(input.parentProblemIds ?? []);
  const description = normalizeOptionalText(input.description);
  const changeReason = normalizeOptionalText(input.changeReason);
  const code = buildClaimProblemCode(level, scope, name);

  if (!name) {
    throw new Error("El nombre del problema es obligatorio.");
  }

  if (!isClaimProblemLevel(level)) {
    throw new Error("El nivel del problema no es valido.");
  }

  if (!isClaimProblemScope(scope)) {
    throw new Error("El alcance del problema no es valido.");
  }

  if (level === "family" && parentProblemIds.length > 0) {
    throw new Error("Los tipos de problema no pueden tener un problema superior.");
  }

  if (level === "subfamily" && parentProblemIds.length === 0) {
    throw new Error("Debes seleccionar al menos un tipo de problema superior.");
  }

  return {
    code,
    name,
    level,
    scope,
    parentProblemIds: level === "family" ? [] : parentProblemIds,
    description,
    isActive: boolValue(input.isActive, true),
    changeReason,
  };
}

async function ensureSimpleMasterTables(client?: PoolClient) {
  const runQuery = (text: string) => client ? client.query(text) : queryCommercial(text);

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

async function ensureClaimProblemTables(client?: PoolClient) {
  const runQuery = (text: string) => client ? client.query(text) : queryCommercial(text);

  await runQuery(`
    create table if not exists ${CLAIM_PROBLEM_REF_TABLE} (
      record_id text primary key,
      problem_id text not null,
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
    create table if not exists ${CLAIM_PROBLEM_DIM_TABLE} (
      record_id text primary key,
      problem_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      problem_code text not null,
      problem_name text not null,
      problem_level text not null,
      problem_scope text not null,
      parent_problem_id text null,
      sort_order integer not null default 0,
      problem_description text null,
      is_active boolean not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create table if not exists ${CLAIM_PROBLEM_PARENT_TABLE} (
      problem_id text not null,
      parent_problem_id text not null,
      created_at timestamp without time zone not null,
      created_by text not null
    )
  `);

  await runQuery(`
    create unique index if not exists sls_ref_claim_problem_id_core_scd2_current_idx
      on ${CLAIM_PROBLEM_REF_TABLE} (problem_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists sls_dim_claim_problem_profile_scd2_current_idx
      on ${CLAIM_PROBLEM_DIM_TABLE} (problem_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists sls_dim_claim_problem_profile_scd2_current_code_unique_idx
      on ${CLAIM_PROBLEM_DIM_TABLE} (lower(regexp_replace(trim(problem_code), '\\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);

  await runQuery(`
    create unique index if not exists sls_bridge_claim_problem_parent_cur_unique_idx
      on ${CLAIM_PROBLEM_PARENT_TABLE} (problem_id, parent_problem_id)
  `);
}

export async function initializeQualityMasters() {
  if (!global.__dashboardQualityMastersSetup) {
    global.__dashboardQualityMastersSetup = (async () => {
      await ensureSimpleMasterTables();
      await ensureClaimProblemTables();
    })();
  }

  return global.__dashboardQualityMastersSetup;
}

async function ensureUniqueCurrentSimpleMasterCode(
  kind: QualitySimpleMasterKind,
  code: string,
  excludeEntityId?: string,
) {
  const config = getSimpleMasterConfig(kind);
  const result = await queryCommercial<{ entity_id: string }>(
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

async function ensureUniqueCurrentClaimProblemCode(code: string, excludeProblemId?: string) {
  const result = await queryCommercial<{ problem_id: string }>(
    `
      select problem_id
      from ${CLAIM_PROBLEM_DIM_TABLE}
      where is_current = true
        and is_valid = true
        and lower(regexp_replace(trim(problem_code), '\\s+', ' ', 'g'))
          = lower(regexp_replace(trim($1), '\\s+', ' ', 'g'))
        and ($2::text is null or problem_id <> $2)
      limit 1
    `,
    [code, excludeProblemId ?? null],
  );

  if (result.rows.length > 0) {
    throw new Error(`Ya existe un problema activo con el codigo "${code}".`);
  }
}

function mapSimpleMasterRow(kind: QualitySimpleMasterKind, row: CurrentSimpleRow): QualitySimpleMasterRecord {
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

function buildClaimProblemPathLabel(name: string, parentProblemName: string | null) {
  return [parentProblemName, name].filter(Boolean).join(" > ");
}

function mapClaimProblemRows(
  rows: CurrentClaimProblemRow[],
  parentRows: CurrentClaimProblemParentRow[],
) {
  const nameMap = new Map(rows.map((row) => [row.problem_id, row.problem_name]));
  const parentIdsByProblemId = new Map<string, string[]>();

  for (const row of parentRows) {
    const current = parentIdsByProblemId.get(row.problem_id) ?? [];
    current.push(row.parent_problem_id);
    parentIdsByProblemId.set(row.problem_id, Array.from(new Set(current)));
  }

  const mappedRecords: QualityClaimProblemRecord[] = [];

  for (const row of rows) {
    const parentProblemIds = parentIdsByProblemId.get(row.problem_id)
      ?? uniqueNonEmptyTexts([row.parent_problem_id]);

    if (row.problem_level === "family") {
      mappedRecords.push({
        nodeKey: row.problem_id,
        problemId: row.problem_id,
        code: row.problem_code,
        name: row.problem_name,
        level: row.problem_level,
        scope: row.problem_scope,
        parentProblemId: null,
        parentProblemName: null,
        parentProblemIds: [],
        description: row.problem_description,
        isActive: boolValue(row.is_active, true),
        pathLabel: row.problem_name,
        validFrom: formatTimestamp(row.valid_from),
        validTo: formatTimestamp(row.valid_to),
        loadedAt: formatTimestamp(row.loaded_at),
        runId: row.run_id,
        actorId: row.actor_id,
        changeReason: row.change_reason,
      });
      continue;
    }

    if (parentProblemIds.length === 0) {
      mappedRecords.push({
        nodeKey: row.problem_id,
        problemId: row.problem_id,
        code: row.problem_code,
        name: row.problem_name,
        level: row.problem_level,
        scope: row.problem_scope,
        parentProblemId: null,
        parentProblemName: null,
        parentProblemIds: [],
        description: row.problem_description,
        isActive: boolValue(row.is_active, true),
        pathLabel: row.problem_name,
        validFrom: formatTimestamp(row.valid_from),
        validTo: formatTimestamp(row.valid_to),
        loadedAt: formatTimestamp(row.loaded_at),
        runId: row.run_id,
        actorId: row.actor_id,
        changeReason: row.change_reason,
      });
      continue;
    }

    for (const parentProblemId of parentProblemIds) {
      const parentProblemName = nameMap.get(parentProblemId) ?? null;
      mappedRecords.push({
        nodeKey: `${row.problem_id}:${parentProblemId}`,
        problemId: row.problem_id,
        code: row.problem_code,
        name: row.problem_name,
        level: row.problem_level,
        scope: row.problem_scope,
        parentProblemId,
        parentProblemName,
        parentProblemIds,
        description: row.problem_description,
        isActive: boolValue(row.is_active, true),
        pathLabel: buildClaimProblemPathLabel(row.problem_name, parentProblemName),
        validFrom: formatTimestamp(row.valid_from),
        validTo: formatTimestamp(row.valid_to),
        loadedAt: formatTimestamp(row.loaded_at),
        runId: row.run_id,
        actorId: row.actor_id,
        changeReason: row.change_reason,
      });
    }
  }

  return mappedRecords.sort((left, right) =>
    left.pathLabel.localeCompare(right.pathLabel, "es", { sensitivity: "base" }),
  );
}

async function getCurrentSimpleMasterRows(kind: QualitySimpleMasterKind) {
  await initializeQualityMasters();
  const config = getSimpleMasterConfig(kind);
  const result = await queryCommercial<CurrentSimpleRow>(
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

async function getCurrentClaimProblemRows() {
  await initializeQualityMasters();
  const result = await queryCommercial<CurrentClaimProblemRow>(
    `
      select
        dim.problem_id,
        dim.problem_code,
        dim.problem_name,
        dim.problem_level,
        dim.problem_scope,
        dim.parent_problem_id,
        dim.problem_description,
        dim.is_active,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${CLAIM_PROBLEM_DIM_TABLE} dim
      inner join ${CLAIM_PROBLEM_REF_TABLE} ref
        on ref.problem_id = dim.problem_id
       and ref.is_current = true
       and ref.is_valid = true
      where dim.is_current = true
        and dim.is_valid = true
      order by lower(dim.problem_name) asc
    `,
  );

  return result.rows;
}

async function getCurrentClaimProblemParentRows() {
  await initializeQualityMasters();
  const result = await queryCommercial<CurrentClaimProblemParentRow>(
    `
      select
        bridge.problem_id,
        bridge.parent_problem_id,
        parent.problem_name as parent_problem_name
      from ${CLAIM_PROBLEM_PARENT_TABLE} bridge
      left join ${CLAIM_PROBLEM_DIM_TABLE} parent
        on parent.problem_id = bridge.parent_problem_id
       and parent.is_current = true
       and parent.is_valid = true
      order by bridge.problem_id, bridge.parent_problem_id
    `,
  );

  return result.rows;
}

async function getCurrentSimpleMasterById(kind: QualitySimpleMasterKind, entityId: string) {
  const row = (await getCurrentSimpleMasterRows(kind)).find((item) => item.entity_id === entityId);
  return row ? mapSimpleMasterRow(kind, row) : null;
}

async function getCurrentClaimProblemById(problemId: string) {
  return (await listCurrentQualityClaimProblems()).find((item) => item.problemId === problemId) ?? null;
}

export async function listCurrentQualitySimpleMasterRecords(kind: QualitySimpleMasterKind) {
  const rows = await getCurrentSimpleMasterRows(kind);
  return rows.map((row) => mapSimpleMasterRow(kind, row));
}

export async function listCurrentQualityClaimProblems() {
  const [rows, parentRows] = await Promise.all([
    getCurrentClaimProblemRows(),
    getCurrentClaimProblemParentRows(),
  ]);

  return mapClaimProblemRows(rows, parentRows);
}

export async function createQualitySimpleMasterRecord(
  kind: QualitySimpleMasterKind,
  input: QualitySimpleMasterInput,
  actorId: string,
) {
  await initializeQualityMasters();

  const config = getSimpleMasterConfig(kind);
  const sanitized = sanitizeSimpleMasterInput(input);
  await ensureUniqueCurrentSimpleMasterCode(kind, sanitized.code);

  const now = new Date();
  const entityId = makeEntityId(config.entityPrefix);
  const runId = makeRunId(`quality_${kind}_create`);
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withCommercialTransaction(async (client) => {
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

export async function updateQualitySimpleMasterRecord(
  kind: QualitySimpleMasterKind,
  entityId: string,
  input: QualitySimpleMasterInput,
  actorId: string,
) {
  await initializeQualityMasters();

  const config = getSimpleMasterConfig(kind);
  const current = await getCurrentSimpleMasterById(kind, entityId);
  if (!current) {
    throw new Error("No se encontro el registro activo que intentas editar.");
  }

  const sanitized = sanitizeSimpleMasterInput(input);
  await ensureUniqueCurrentSimpleMasterCode(kind, sanitized.code, entityId);

  const now = new Date();
  const runId = makeRunId(`quality_${kind}_update`);
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withCommercialTransaction(async (client) => {
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

async function ensureCurrentClaimProblemParentsExist(problemIds: string[]) {
  const uniqueIds = Array.from(new Set(problemIds));
  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await getCurrentClaimProblemRows();
  const rowsById = new Map(rows.map((row) => [row.problem_id, row]));

  return uniqueIds.map((problemId) => {
    const current = rowsById.get(problemId);

    if (!current) {
      throw new Error("Uno de los tipos de problema seleccionados ya no existe o no esta activo.");
    }

    if (current.problem_level !== "family") {
      throw new Error("Solo puedes asociar un problema a tipos superiores.");
    }

    return current;
  });
}

async function replaceClaimProblemParentLinks(
  client: PoolClient,
  problemId: string,
  parentProblemIds: string[],
  actorId: string,
) {
  await client.query(
    `delete from ${CLAIM_PROBLEM_PARENT_TABLE} where problem_id = $1`,
    [problemId],
  );

  for (const parentProblemId of parentProblemIds) {
    await client.query(
      `
        insert into ${CLAIM_PROBLEM_PARENT_TABLE} (
          problem_id, parent_problem_id, created_at, created_by
        ) values ($1, $2, $3, $4)
      `,
      [problemId, parentProblemId, new Date(), actorId],
    );
  }
}

export async function createQualityClaimProblem(
  input: QualityClaimProblemInput,
  actorId: string,
) {
  await initializeQualityMasters();

  const sanitized = sanitizeClaimProblemInput(input);
  await ensureCurrentClaimProblemParentsExist(sanitized.parentProblemIds);
  await ensureUniqueCurrentClaimProblemCode(sanitized.code);

  const now = new Date();
  const problemId = makeEntityId("qprob");
  const runId = makeRunId("commercial_claim_problem_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";
  const firstParentProblemId = sanitized.parentProblemIds[0] ?? null;

  await withCommercialTransaction(async (client) => {
    await client.query(
      `
        insert into ${CLAIM_PROBLEM_REF_TABLE} (
          record_id, problem_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), problemId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${CLAIM_PROBLEM_DIM_TABLE} (
          record_id, problem_id, valid_from, valid_to, is_current, problem_code, problem_name, problem_level,
          problem_scope, parent_problem_id, sort_order, problem_description, is_active, is_valid, loaded_at, run_id,
          actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, 0, $9, $10, true, $3, $11, $12, $13)
      `,
      [
        makeRecordId(),
        problemId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.level,
        sanitized.scope,
        firstParentProblemId,
        sanitized.description,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );

    await replaceClaimProblemParentLinks(client, problemId, sanitized.parentProblemIds, actorId);
  });

  return getCurrentClaimProblemById(problemId);
}

export async function updateQualityClaimProblem(
  problemId: string,
  input: QualityClaimProblemInput,
  actorId: string,
) {
  await initializeQualityMasters();

  const current = await getCurrentClaimProblemById(problemId);
  if (!current) {
    throw new Error("No se encontro el problema activo que intentas editar.");
  }

  const sanitized = sanitizeClaimProblemInput(input);
  if (sanitized.parentProblemIds.includes(problemId)) {
    throw new Error("Un problema no puede apuntarse a si mismo como tipo superior.");
  }

  await ensureCurrentClaimProblemParentsExist(sanitized.parentProblemIds);
  await ensureUniqueCurrentClaimProblemCode(sanitized.code, problemId);

  const now = new Date();
  const runId = makeRunId("commercial_claim_problem_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";
  const firstParentProblemId = sanitized.parentProblemIds[0] ?? null;

  await withCommercialTransaction(async (client) => {
    await client.query(
      `update ${CLAIM_PROBLEM_REF_TABLE} set is_current = false, valid_to = $2 where problem_id = $1 and is_current = true`,
      [problemId, now],
    );
    await client.query(
      `update ${CLAIM_PROBLEM_DIM_TABLE} set is_current = false, valid_to = $2 where problem_id = $1 and is_current = true`,
      [problemId, now],
    );

    await client.query(
      `
        insert into ${CLAIM_PROBLEM_REF_TABLE} (
          record_id, problem_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
        ) values ($1, $2, $3, null, true, true, $3, $4, $5, $6)
      `,
      [makeRecordId(), problemId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${CLAIM_PROBLEM_DIM_TABLE} (
          record_id, problem_id, valid_from, valid_to, is_current, problem_code, problem_name, problem_level,
          problem_scope, parent_problem_id, sort_order, problem_description, is_active, is_valid, loaded_at, run_id,
          actor_id, change_reason
        ) values ($1, $2, $3, null, true, $4, $5, $6, $7, $8, 0, $9, $10, true, $3, $11, $12, $13)
      `,
      [
        makeRecordId(),
        problemId,
        now,
        sanitized.code,
        sanitized.name,
        sanitized.level,
        sanitized.scope,
        firstParentProblemId,
        sanitized.description,
        sanitized.isActive,
        runId,
        actorId,
        changeReason,
      ],
    );

    await replaceClaimProblemParentLinks(client, problemId, sanitized.parentProblemIds, actorId);
  });

  return getCurrentClaimProblemById(problemId);
}
