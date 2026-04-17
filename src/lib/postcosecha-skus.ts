import crypto from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { PoolClient } from "pg";

import { queryPostharvest, withPostharvestTransaction } from "@/lib/postcosecha-db";
import type {
  PoscosechaSkuInput,
  PoscosechaSkuRecord,
} from "@/lib/postcosecha-sku-types";
import { toNumber } from "@/shared/lib/number-utils";

type CurrentSkuRow = {
  sku_id: string;
  sku_name: string;
  ideal_bunch_weight: string | number | null;
  stems_min: string | number | null;
  stems_max: string | number | null;
  target_weight_min: string | number | null;
  target_weight_max: string | number | null;
  target_max_grades: string | number | null;
  valid_from: string | null;
  valid_to: string | null;
  loaded_at: string | null;
  run_id: string | null;
  actor_id: string | null;
  change_reason: string | null;
};

type CountRow = {
  total: number | string | null;
};

const REF_TABLE = "public.postharvest_ref_sku_id_core_scd2";
const DIM_TABLE = "public.postharvest_dim_sku_profile_scd2";
const DEFAULT_SEED_PATH = resolve(
  process.cwd(),
  "..",
  "solver_poscosecha",
  "data",
  "sku_master.csv",
);

declare global {
  var __dashboardPostharvestSkuSetup: Promise<void> | undefined;
}

function autoSeedEnabled() {
  return process.env.POSTHARVEST_AUTO_SEED === "true";
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function normalizeSkuLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function safeInteger(value: number | null, fallback: number) {
  if (value === null) {
    return fallback;
  }

  return Math.round(value);
}

function safeFloat(value: number | null, fallback: number) {
  if (value === null) {
    return fallback;
  }

  return Math.round(value * 100) / 100;
}

function sanitizeSkuInput(input: PoscosechaSkuInput) {
  const sku = normalizeSkuLabel(input.sku);

  if (!sku) {
    throw new Error("El SKU es obligatorio.");
  }

  const pesoIdealBunch = safeFloat(toNumber(input.pesoIdealBunch), 0);
  if (pesoIdealBunch <= 0) {
    throw new Error("El peso ideal debe ser mayor a cero.");
  }

  const tallosMin = Math.max(safeInteger(toNumber(input.tallosMin), 0), 1);
  const tallosMaxBase = safeInteger(toNumber(input.tallosMax), tallosMin);
  const tallosMax = Math.max(tallosMaxBase, tallosMin);

  const pesoMinObjetivoBase = safeFloat(toNumber(input.pesoMinObjetivo), pesoIdealBunch * 0.97);
  const pesoMaxObjetivoBase = safeFloat(toNumber(input.pesoMaxObjetivo), pesoIdealBunch * 1.03);
  const pesoMinObjetivo = Math.min(pesoMinObjetivoBase, pesoIdealBunch);
  const pesoMaxObjetivo = Math.max(Math.max(pesoMaxObjetivoBase, pesoIdealBunch), pesoMinObjetivo);
  const maxGradosObjetivo = Math.max(safeInteger(toNumber(input.maxGradosObjetivo), 3), 1);
  const changeReason = normalizeSkuLabel(input.changeReason ?? "") || null;

  return {
    sku,
    pesoIdealBunch,
    tallosMin,
    tallosMax,
    pesoMinObjetivo,
    pesoMaxObjetivo,
    maxGradosObjetivo,
    changeReason,
  } satisfies PoscosechaSkuInput;
}

function mapCurrentSkuRow(row: CurrentSkuRow): PoscosechaSkuRecord {
  return {
    skuId: row.sku_id,
    sku: row.sku_name,
    pesoIdealBunch: toNumber(row.ideal_bunch_weight) ?? 0,
    tallosMin: safeInteger(toNumber(row.stems_min), 0),
    tallosMax: safeInteger(toNumber(row.stems_max), 0),
    pesoMinObjetivo: toNumber(row.target_weight_min) ?? 0,
    pesoMaxObjetivo: toNumber(row.target_weight_max) ?? 0,
    maxGradosObjetivo: safeInteger(toNumber(row.target_max_grades), 1),
    validFrom: formatTimestamp(row.valid_from),
    validTo: formatTimestamp(row.valid_to),
    loadedAt: formatTimestamp(row.loaded_at),
    runId: row.run_id,
    actorId: row.actor_id,
    changeReason: row.change_reason,
  };
}

function makeRunId(prefix: string) {
  return `${prefix}_${new Date().toISOString()}`;
}

function makeRecordId() {
  return crypto.randomUUID();
}

function makeSkuId() {
  return `sku_${crypto.randomUUID()}`;
}

function makeSeedSkuId(label: string) {
  const hash = crypto.createHash("sha1").update(label.toLowerCase()).digest("hex").slice(0, 16);
  return `sku_${hash}`;
}

function parseCsvSeedRows(filePath: string) {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const [headerLine, ...lines] = raw.split(/\r?\n/).filter((line) => line.trim());

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",").map((part) => part.trim());

  return lines.map((line) => {
    const parts = line.split(",").map((part) => part.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, parts[index] ?? ""]));

    return sanitizeSkuInput({
      sku: row.sku ?? "",
      pesoIdealBunch: Number(row.peso_ideal_bunch ?? 0),
      tallosMin: Number(row.tallos_min ?? 0),
      tallosMax: Number(row.tallos_max ?? 0),
      pesoMinObjetivo: Number(row.peso_min_objetivo ?? 0),
      pesoMaxObjetivo: Number(row.peso_max_objetivo ?? 0),
      maxGradosObjetivo: Number(row.max_grados_objetivo ?? 0),
      changeReason: "STREAMLIT_SEED_IMPORT",
    });
  });
}

async function ensureTables(client?: PoolClient) {
  const runQuery = (text: string) => {
    if (client) {
      return client.query(text);
    }

    return queryPostharvest(text);
  };

  await runQuery(`
    create table if not exists ${REF_TABLE} (
      record_id text primary key,
      sku_id text not null,
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
      sku_id text not null,
      valid_from timestamp without time zone not null,
      valid_to timestamp without time zone null,
      is_current boolean not null,
      sku_name text not null,
      ideal_bunch_weight numeric(12, 2) not null,
      stems_min integer not null,
      stems_max integer not null,
      target_weight_min numeric(12, 2) not null,
      target_weight_max numeric(12, 2) not null,
      target_max_grades integer not null,
      is_valid boolean not null,
      loaded_at timestamp without time zone not null,
      run_id text not null,
      actor_id text not null,
      change_reason text not null
    )
  `);

  await runQuery(`
    create unique index if not exists postharvest_ref_sku_id_core_scd2_current_idx
      on ${REF_TABLE} (sku_id)
      where is_current
  `);

  await runQuery(`
    create unique index if not exists postharvest_dim_sku_profile_scd2_current_idx
      on ${DIM_TABLE} (sku_id)
      where is_current
  `);

  await runQuery(`
    create index if not exists postharvest_dim_sku_profile_scd2_name_idx
      on ${DIM_TABLE} (lower(sku_name))
  `);

  await runQuery(`
    create unique index if not exists postharvest_dim_sku_profile_scd2_current_name_unique_idx
      on ${DIM_TABLE} (lower(regexp_replace(trim(sku_name), '\s+', ' ', 'g')))
      where is_current = true
        and is_valid = true
  `);
}

async function seedIfEmpty() {
  const countResult = await queryPostharvest<CountRow>(
    `select count(*)::int as total from ${DIM_TABLE} where is_current = true`,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);

  if (total > 0 || !existsSync(DEFAULT_SEED_PATH)) {
    return;
  }

  const rows = parseCsvSeedRows(DEFAULT_SEED_PATH);

  if (!rows.length) {
    return;
  }

  await withPostharvestTransaction(async (client) => {
    await ensureTables(client);

    const now = new Date();
    const runId = "postharvest_sku_seed_v1";
    const actorId = "streamlit_seed_import";

    for (const row of rows) {
      const skuId = makeSeedSkuId(row.sku);

      await client.query(
        `
          insert into ${REF_TABLE} (
            record_id,
            sku_id,
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
        [makeRecordId(), skuId, now, runId, actorId, "STREAMLIT_SEED_IMPORT"],
      );

      await client.query(
        `
          insert into ${DIM_TABLE} (
            record_id,
            sku_id,
            valid_from,
            valid_to,
            is_current,
            sku_name,
            ideal_bunch_weight,
            stems_min,
            stems_max,
            target_weight_min,
            target_weight_max,
            target_max_grades,
            is_valid,
            loaded_at,
            run_id,
            actor_id,
            change_reason
          )
          values (
            $1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13
          )
        `,
        [
          makeRecordId(),
          skuId,
          now,
          row.sku,
          row.pesoIdealBunch,
          row.tallosMin,
          row.tallosMax,
          row.pesoMinObjetivo,
          row.pesoMaxObjetivo,
          row.maxGradosObjetivo,
          runId,
          actorId,
          "STREAMLIT_SEED_IMPORT",
        ],
      );
    }
  });
}

export async function initializePostharvestSkuMaster() {
  if (!global.__dashboardPostharvestSkuSetup) {
    global.__dashboardPostharvestSkuSetup = (async () => {
      await ensureTables();
      if (autoSeedEnabled()) {
        await seedIfEmpty();
      }
    })();
  }

  return global.__dashboardPostharvestSkuSetup;
}

async function ensureUniqueCurrentSkuName(
  sku: string,
  excludeSkuId?: string,
) {
  const result = await queryPostharvest<{ sku_id: string }>(
    `
      select sku_id
      from ${DIM_TABLE}
      where is_current = true
        and lower(regexp_replace(trim(sku_name), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
        ${excludeSkuId ? "and sku_id <> $2" : ""}
      limit 1
    `,
    excludeSkuId ? [sku, excludeSkuId] : [sku],
  );

  if (result.rows.length > 0) {
    throw new Error(`Ya existe un SKU activo con el nombre "${sku}".`);
  }
}

export async function listCurrentPostharvestSkus() {
  await initializePostharvestSkuMaster();

  const result = await queryPostharvest<CurrentSkuRow>(
    `
      select
        dim.sku_id,
        dim.sku_name,
        dim.ideal_bunch_weight,
        dim.stems_min,
        dim.stems_max,
        dim.target_weight_min,
        dim.target_weight_max,
        dim.target_max_grades,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${DIM_TABLE} dim
      inner join ${REF_TABLE} ref
        on ref.sku_id = dim.sku_id
       and ref.is_current = true
       and ref.is_valid = true
      where dim.is_current = true
        and dim.is_valid = true
      order by lower(dim.sku_name) asc
    `,
  );

  return result.rows.map(mapCurrentSkuRow);
}

async function getCurrentSkuById(skuId: string) {
  const result = await queryPostharvest<CurrentSkuRow>(
    `
      select
        dim.sku_id,
        dim.sku_name,
        dim.ideal_bunch_weight,
        dim.stems_min,
        dim.stems_max,
        dim.target_weight_min,
        dim.target_weight_max,
        dim.target_max_grades,
        dim.valid_from,
        dim.valid_to,
        dim.loaded_at,
        dim.run_id,
        dim.actor_id,
        dim.change_reason
      from ${DIM_TABLE} dim
      where dim.sku_id = $1
        and dim.is_current = true
      limit 1
    `,
    [skuId],
  );

  return result.rows[0] ? mapCurrentSkuRow(result.rows[0]) : null;
}

export async function createPostharvestSku(
  input: PoscosechaSkuInput,
  actorId: string,
) {
  await initializePostharvestSkuMaster();

  const sanitized = sanitizeSkuInput(input);
  await ensureUniqueCurrentSkuName(sanitized.sku);

  const now = new Date();
  const skuId = makeSkuId();
  const runId = makeRunId("postharvest_sku_create");
  const changeReason = sanitized.changeReason ?? "CREATE_FROM_COREX_UI";

  await withPostharvestTransaction(async (client) => {
    await client.query(
      `
        insert into ${REF_TABLE} (
          record_id,
          sku_id,
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
      [makeRecordId(), skuId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${DIM_TABLE} (
          record_id,
          sku_id,
          valid_from,
          valid_to,
          is_current,
          sku_name,
          ideal_bunch_weight,
          stems_min,
          stems_max,
          target_weight_min,
          target_weight_max,
          target_max_grades,
          is_valid,
          loaded_at,
          run_id,
          actor_id,
          change_reason
        )
        values (
          $1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13
        )
      `,
      [
        makeRecordId(),
        skuId,
        now,
        sanitized.sku,
        sanitized.pesoIdealBunch,
        sanitized.tallosMin,
        sanitized.tallosMax,
        sanitized.pesoMinObjetivo,
        sanitized.pesoMaxObjetivo,
        sanitized.maxGradosObjetivo,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentSkuById(skuId);
}

export async function updatePostharvestSku(
  skuId: string,
  input: PoscosechaSkuInput,
  actorId: string,
) {
  await initializePostharvestSkuMaster();

  const currentSku = await getCurrentSkuById(skuId);

  if (!currentSku) {
    throw new Error("No se encontro el SKU activo que intentas editar.");
  }

  const sanitized = sanitizeSkuInput(input);
  await ensureUniqueCurrentSkuName(sanitized.sku, skuId);

  const now = new Date();
  const runId = makeRunId("postharvest_sku_update");
  const changeReason = sanitized.changeReason ?? "UPDATE_FROM_COREX_UI";

  await withPostharvestTransaction(async (client) => {
    await client.query(
      `
        update ${REF_TABLE}
        set
          is_current = false,
          valid_to = $2
        where sku_id = $1
          and is_current = true
      `,
      [skuId, now],
    );

    await client.query(
      `
        update ${DIM_TABLE}
        set
          is_current = false,
          valid_to = $2
        where sku_id = $1
          and is_current = true
      `,
      [skuId, now],
    );

    await client.query(
      `
        insert into ${REF_TABLE} (
          record_id,
          sku_id,
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
      [makeRecordId(), skuId, now, runId, actorId, changeReason],
    );

    await client.query(
      `
        insert into ${DIM_TABLE} (
          record_id,
          sku_id,
          valid_from,
          valid_to,
          is_current,
          sku_name,
          ideal_bunch_weight,
          stems_min,
          stems_max,
          target_weight_min,
          target_weight_max,
          target_max_grades,
          is_valid,
          loaded_at,
          run_id,
          actor_id,
          change_reason
        )
        values (
          $1, $2, $3, null, true, $4, $5, $6, $7, $8, $9, $10, true, $3, $11, $12, $13
        )
      `,
      [
        makeRecordId(),
        skuId,
        now,
        sanitized.sku,
        sanitized.pesoIdealBunch,
        sanitized.tallosMin,
        sanitized.tallosMax,
        sanitized.pesoMinObjetivo,
        sanitized.pesoMaxObjetivo,
        sanitized.maxGradosObjetivo,
        runId,
        actorId,
        changeReason,
      ],
    );
  });

  return getCurrentSkuById(skuId);
}
