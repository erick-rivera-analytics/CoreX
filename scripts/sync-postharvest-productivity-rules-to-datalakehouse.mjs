#!/usr/bin/env node
// Mirrors current postharvest productivity rules from db_postharvest into
// datalakehouse.gld for analytical joins inside materialized views.

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const envPath = path.resolve(process.cwd(), ".env.local");
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

function baseConfig(database) {
  return {
    host: env("DATABASE_HOST"),
    port: Number(env("DATABASE_PORT") || 5432),
    database,
    user: env("DATABASE_USER"),
    password: env("DATABASE_PASSWORD"),
    ssl: env("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

const sourceConfig = baseConfig(env("POSTHARVEST_DATABASE_NAME") || "db_postharvest");
const targetConfig = baseConfig(env("DATABASE_NAME") || "datalakehouse");

const SOURCE_SQL = `
  select
    rule_id,
    rule_scope_area,
    rule_code,
    activity_id,
    activity_name,
    baseline_actual_hours_q1,
    path_rule,
    variety_filter,
    destination_filter,
    methodology_code,
    applies_to,
    stage_side,
    anchor_final,
    allowed_steps,
    path_split_basis,
    step_split_basis,
    is_misassigned,
    is_inactive,
    is_active,
    confidence_level,
    source_kind,
    notes,
    group_name,
    natural_key,
    valid_from as source_valid_from,
    valid_to as source_valid_to,
    loaded_at as source_loaded_at,
    run_id as source_run_id,
    actor_id as source_actor_id,
    change_reason as source_change_reason
  from public.postharvest_dim_productivity_rule_profile_scd2
  where is_current = true
    and is_valid = true
  order by rule_scope_area, activity_id, rule_code
`;

async function main() {
  const source = new pg.Pool(sourceConfig);
  const target = new pg.Pool(targetConfig);

  try {
    const sourceRows = (await source.query(SOURCE_SQL)).rows;
    console.info(`[SYNC] reglas origen: ${sourceRows.length}`);

    await target.query("begin");
    await target.query("delete from gld.prod_dim_postharvest_productivity_rule_cur");

    const insertSql = `
      insert into gld.prod_dim_postharvest_productivity_rule_cur (
        rule_id,
        rule_scope_area,
        rule_code,
        activity_id,
        activity_name,
        baseline_actual_hours_q1,
        path_rule,
        variety_filter,
        destination_filter,
        methodology_code,
        applies_to,
        stage_side,
        anchor_final,
        allowed_steps,
        path_split_basis,
        step_split_basis,
        is_misassigned,
        is_inactive,
        is_active,
        confidence_level,
        source_kind,
        notes,
        group_name,
        natural_key,
        source_valid_from,
        source_valid_to,
        source_loaded_at,
        source_run_id,
        source_actor_id,
        source_change_reason,
        synced_at
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30,
        now()
      )
    `;

    for (const row of sourceRows) {
      await target.query(insertSql, [
        row.rule_id,
        row.rule_scope_area,
        row.rule_code,
        row.activity_id,
        row.activity_name,
        row.baseline_actual_hours_q1,
        row.path_rule,
        row.variety_filter,
        row.destination_filter,
        row.methodology_code,
        row.applies_to,
        row.stage_side,
        row.anchor_final,
        row.allowed_steps,
        row.path_split_basis,
        row.step_split_basis,
        row.is_misassigned,
        row.is_inactive,
        row.is_active,
        row.confidence_level,
        row.source_kind,
        row.notes,
        row.group_name,
        row.natural_key,
        row.source_valid_from,
        row.source_valid_to,
        row.source_loaded_at,
        row.source_run_id,
        row.source_actor_id,
        row.source_change_reason,
      ]);
    }

    await target.query("commit");

    const verification = await target.query(`
      select rule_scope_area, count(*)::int as total
      from gld.prod_dim_postharvest_productivity_rule_cur
      group by rule_scope_area
      order by rule_scope_area
    `);

    console.info("[SYNC] conteo espejo datalakehouse:");
    for (const row of verification.rows) {
      console.info(`  ${row.rule_scope_area}: ${row.total}`);
    }
  } catch (error) {
    await target.query("rollback").catch(() => {});
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exit(1);
});
