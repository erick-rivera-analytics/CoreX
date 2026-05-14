#!/usr/bin/env node
// Seeds postharvest productivity activity rules into db_postharvest from the
// canonical CSV masters used by the hours-per-box methodology.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const envPath = path.resolve(ROOT, ".env.local");
const envFile = fs.existsSync(envPath)
  ? Object.fromEntries(
      fs.readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const idx = line.indexOf("=");
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        }),
    )
  : {};

const env = (key) => envFile[key] ?? process.env[key] ?? "";
const config = {
  host: env("DATABASE_HOST"),
  port: Number(env("DATABASE_PORT") || 5432),
  database: env("POSTHARVEST_DATABASE_NAME") || "db_postharvest",
  user: env("DATABASE_USER"),
  password: env("DATABASE_PASSWORD"),
  ssl: env("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : undefined,
};

const REF_TABLE = "public.postharvest_ref_productivity_rule_id_core_scd2";
const DIM_TABLE = "public.postharvest_dim_productivity_rule_profile_scd2";
const SOURCE_ROOT = "C:/Users/paul.loja/PYPROYECTOS/Poscosecha/analisis_horas";
const SOURCES = [
  { area: "CLS", file: path.join(SOURCE_ROOT, "cls_activity_path_master.csv") },
  { area: "SB", file: path.join(SOURCE_ROOT, "sb_activity_path_master.csv") },
  { area: "EMP", file: path.join(SOURCE_ROOT, "emp_activity_path_master.csv") },
];

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || fallback;
}

function normalizeUpper(value, fallback = "") {
  return normalizeText(value, fallback).toUpperCase();
}

function normalizeNullable(value) {
  const text = normalizeText(value, "");
  return text || null;
}

function normalizeNullableUpper(value) {
  const text = normalizeUpper(value, "");
  return text || null;
}

function normalizeBool(value) {
  const text = normalizeUpper(value, "");
  if (!text) {
    return false;
  }
  return ["TRUE", "1", "YES", "Y"].includes(text);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function stableHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 20);
}

function parseCsvText(raw) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => String(value ?? "").trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => String(value ?? "").trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function buildNaturalKey(row) {
  return [
    row.ruleScopeArea,
    row.activityId,
    row.pathRule,
    row.varietyFilter,
    row.destinationFilter,
    row.methodologyCode,
    row.appliesTo,
    row.stageSide,
    row.anchorFinal,
    row.allowedSteps ?? "",
    row.pathSplitBasis ?? "",
    row.stepSplitBasis ?? "",
  ].join("|");
}

function parseCsvRows(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsvText(raw);
  if (rows.length === 0) {
    return [];
  }
  const [headers, ...values] = rows;
  const normalizedHeaders = headers.map((value) => normalizeText(value));
  return values.map((current) =>
    Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, current[index] ?? ""]),
    ),
  );
}

function mapRule(area, rawRow) {
  const activityId = normalizeUpper(rawRow.activity_id);
  const activityName = normalizeText(rawRow.activity_name);
  const pathRule = normalizeUpper(rawRow.path_rule, "ALL_PATHS_SPLIT");
  const varietyFilter = normalizeUpper(rawRow.variedad_filter, "ALL");
  const destinationFilter = normalizeUpper(rawRow.destino_filter, "ALL");
  const methodologyCode = normalizeUpper(rawRow.metodologia_uph, "KG");
  const appliesTo = normalizeUpper(rawRow.aplica_a, "BOTH");
  const stageSide = normalizeUpper(rawRow.stage_side, "DOWNSTREAM_ONLY");
  const anchorFinal = normalizeUpper(rawRow.anchor_final, "B2A");
  const allowedSteps = normalizeNullableUpper(rawRow.allowed_steps);
  const pathSplitBasis = normalizeNullableUpper(rawRow.path_split_basis);
  const stepSplitBasis = normalizeNullableUpper(rawRow.step_split_basis);
  const confidenceLevel = normalizeNullableUpper(rawRow.confidence);
  const sourceKind = normalizeNullableUpper(rawRow.source);
  const notes = normalizeNullable(rawRow.notes);
  const groupName = normalizeNullableUpper(rawRow.grupo);
  const baselineActualHoursQ1 = normalizeNumber(rawRow.actual_hours_2025_q1);
  const isMisassigned = normalizeBool(rawRow.flag_misassigned);
  const isInactive = normalizeBool(rawRow.flag_inactive);
  const isActive = !isInactive;

  if (!activityId || !activityName || !pathRule) {
    return null;
  }

  const payload = {
    ruleScopeArea: area,
    activityId,
    activityName,
    baselineActualHoursQ1,
    pathRule,
    varietyFilter,
    destinationFilter,
    methodologyCode,
    appliesTo,
    stageSide,
    anchorFinal,
    allowedSteps,
    pathSplitBasis,
    stepSplitBasis,
    isMisassigned,
    isInactive,
    isActive,
    confidenceLevel,
    sourceKind,
    notes,
    groupName,
  };

  const naturalKey = buildNaturalKey(payload);
  const hash = stableHash(naturalKey);

  return {
    ...payload,
    naturalKey,
    ruleId: `phrule_${hash}`,
    ruleCode: `PHR_${area}_${activityId}_${hash.slice(0, 6)}`,
    refRecordId: `phr_ref_${hash}`,
    dimRecordId: `phr_dim_${hash}`,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const allRules = [];

  for (const source of SOURCES) {
    const rows = parseCsvRows(source.file)
      .map((row) => mapRule(source.area, row))
      .filter(Boolean);
    allRules.push(...rows);
  }

  const uniqueRules = Array.from(new Map(allRules.map((row) => [row.naturalKey, row])).values());
  console.info(`[SEED] reglas leidas: ${allRules.length}`);
  console.info(`[SEED] reglas unicas: ${uniqueRules.length}`);

  if (dryRun) {
    const byArea = uniqueRules.reduce((acc, row) => {
      acc[row.ruleScopeArea] = (acc[row.ruleScopeArea] ?? 0) + 1;
      return acc;
    }, {});
    console.info(JSON.stringify({ byArea, sample: uniqueRules.slice(0, 5) }, null, 2));
    return;
  }

  const pool = new pg.Pool(config);
  const now = new Date().toISOString();
  const runId = `seed_postharvest_productivity_rules_${now}`;
  const actorId = "codex";
  const changeReason = "SEED_POSTHARVEST_PRODUCTIVITY_RULES";

  try {
    await pool.query("begin");

    for (const row of uniqueRules) {
      await pool.query(
        `
          insert into ${REF_TABLE} (
            record_id, rule_id, valid_from, valid_to, is_current, is_valid,
            loaded_at, run_id, actor_id, change_reason
          ) values (
            $1, $2, $3, null, true, true,
            $3, $4, $5, $6
          )
          on conflict (record_id) do update
          set rule_id = excluded.rule_id,
              valid_from = excluded.valid_from,
              valid_to = excluded.valid_to,
              is_current = excluded.is_current,
              is_valid = excluded.is_valid,
              loaded_at = excluded.loaded_at,
              run_id = excluded.run_id,
              actor_id = excluded.actor_id,
              change_reason = excluded.change_reason
        `,
        [row.refRecordId, row.ruleId, now, runId, actorId, changeReason],
      );

      await pool.query(
        `
          insert into ${DIM_TABLE} (
            record_id, rule_id, valid_from, valid_to, is_current,
            rule_scope_area, rule_code, activity_id, activity_name, baseline_actual_hours_q1,
            path_rule, variety_filter, destination_filter, methodology_code, applies_to,
            stage_side, anchor_final, allowed_steps, path_split_basis, step_split_basis,
            is_misassigned, is_inactive, is_active, confidence_level, source_kind,
            notes, group_name, natural_key, is_valid, loaded_at, run_id, actor_id, change_reason
          ) values (
            $1, $2, $3, null, true,
            $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23,
            $24, $25, $26, true, $3, $27, $28, $29
          )
          on conflict (record_id) do update
          set rule_id = excluded.rule_id,
              valid_from = excluded.valid_from,
              valid_to = excluded.valid_to,
              is_current = excluded.is_current,
              rule_scope_area = excluded.rule_scope_area,
              rule_code = excluded.rule_code,
              activity_id = excluded.activity_id,
              activity_name = excluded.activity_name,
              baseline_actual_hours_q1 = excluded.baseline_actual_hours_q1,
              path_rule = excluded.path_rule,
              variety_filter = excluded.variety_filter,
              destination_filter = excluded.destination_filter,
              methodology_code = excluded.methodology_code,
              applies_to = excluded.applies_to,
              stage_side = excluded.stage_side,
              anchor_final = excluded.anchor_final,
              allowed_steps = excluded.allowed_steps,
              path_split_basis = excluded.path_split_basis,
              step_split_basis = excluded.step_split_basis,
              is_misassigned = excluded.is_misassigned,
              is_inactive = excluded.is_inactive,
              is_active = excluded.is_active,
              confidence_level = excluded.confidence_level,
              source_kind = excluded.source_kind,
              notes = excluded.notes,
              group_name = excluded.group_name,
              natural_key = excluded.natural_key,
              is_valid = excluded.is_valid,
              loaded_at = excluded.loaded_at,
              run_id = excluded.run_id,
              actor_id = excluded.actor_id,
              change_reason = excluded.change_reason
        `,
        [
          row.dimRecordId,
          row.ruleId,
          now,
          row.ruleScopeArea,
          row.ruleCode,
          row.activityId,
          row.activityName,
          row.baselineActualHoursQ1,
          row.pathRule,
          row.varietyFilter,
          row.destinationFilter,
          row.methodologyCode,
          row.appliesTo,
          row.stageSide,
          row.anchorFinal,
          row.allowedSteps,
          row.pathSplitBasis,
          row.stepSplitBasis,
          row.isMisassigned,
          row.isInactive,
          row.isActive,
          row.confidenceLevel,
          row.sourceKind,
          row.notes,
          row.groupName,
          row.naturalKey,
          runId,
          actorId,
          changeReason,
        ],
      );
    }

    await pool.query("commit");

    const verification = await pool.query(`
      select rule_scope_area, count(*)::int as total
      from ${DIM_TABLE}
      where is_current = true
        and is_valid = true
      group by rule_scope_area
      order by rule_scope_area
    `);

    console.info("[SEED] conteo por area:");
    for (const row of verification.rows) {
      console.info(`  ${row.rule_scope_area}: ${row.total}`);
    }
  } catch (error) {
    await pool.query("rollback").catch(() => {});
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exit(1);
});
