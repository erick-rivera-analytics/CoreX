#!/usr/bin/env node
// Aplica sql/datalakehouse_postharvest_productivity.sql contra datalakehouse.

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

const DATABASE_URL = env("DATABASE_URL");
const config = DATABASE_URL
  ? { connectionString: DATABASE_URL }
  : {
      host: env("DATABASE_HOST"),
      port: Number(env("DATABASE_PORT") || 5432),
      database: env("DATABASE_NAME") || "datalakehouse",
      user: env("DATABASE_USER"),
      password: env("DATABASE_PASSWORD"),
      ssl: env("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : undefined,
    };

const sqlPath = path.resolve(process.cwd(), "sql/datalakehouse_postharvest_productivity.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const dryRun = process.argv.includes("--dry");

if (dryRun) {
  console.info(`[SQL] DRY RUN ${sqlPath}`);
  console.info(`[SQL] bytes=${sql.length}`);
  process.exit(0);
}

const pool = new pg.Pool(config);

try {
  console.info(`[DB] Aplicando ${sqlPath} sobre ${config.database ?? "DATABASE_URL"}`);
  await pool.query(sql);
  console.info("[SQL] Aplicado correctamente.");

  const verification = await pool.query(`
    select schemaname, matviewname
    from pg_matviews
    where schemaname = 'gld'
      and matviewname in (
        'mv_prod_postharvest_capacity_hours_cur',
        'mv_prod_postharvest_step_flow_cur',
        'mv_prod_postharvest_day_universe_cur',
        'mv_prod_postharvest_lot_final_output_cur',
        'mv_prod_postharvest_period_universe_cur',
        'mv_prod_postharvest_rule_hours_cur',
        'mv_prod_postharvest_rule_side_hours_cur',
        'mv_prod_postharvest_hours_box_detail_cur',
        'mv_prod_postharvest_hours_box_cur'
      )
    order by matviewname
  `);

  console.info("[SQL] Materializadas verificadas:");
  for (const row of verification.rows) {
    console.info(`  ${row.schemaname}.${row.matviewname}`);
  }

  if (verification.rows.length !== 9) {
    console.warn(`[SQL] Advertencia: se esperaban 9 materializadas y se verificaron ${verification.rows.length}.`);
  }
} finally {
  await pool.end();
}
