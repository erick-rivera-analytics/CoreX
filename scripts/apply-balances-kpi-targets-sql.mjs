#!/usr/bin/env node
/**
 * Aplica los 3 seeds SQL de KPIs de Balanzas contra el cluster `db_admin`:
 *   - sql/seed_db_admin_balances_hydration_targets.sql
 *   - sql/seed_db_admin_balances_waste_targets.sql
 *   - sql/seed_db_admin_balances_adjustment_params.sql
 *
 * Uso:
 *   node scripts/apply-balances-kpi-targets-sql.mjs
 *
 * Los seeds son idempotentes (INSERT ... WHERE NOT EXISTS); se pueden correr
 * múltiples veces sin duplicar registros.
 *
 * Lee credenciales desde .env.local (DATABASE_HOST / DATABASE_PORT / DATABASE_USER /
 * DATABASE_PASSWORD), pero apunta al schema `db_admin` (no `datalakehouse`).
 */
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

const ADMIN_DATABASE_URL = env("ADMIN_DATABASE_URL");
const config = ADMIN_DATABASE_URL
  ? { connectionString: ADMIN_DATABASE_URL }
  : {
      host: env("DATABASE_HOST"),
      port: Number(env("DATABASE_PORT") || 5432),
      database: env("ADMIN_DATABASE_NAME") || "db_admin",
      user: env("DATABASE_USER"),
      password: env("DATABASE_PASSWORD"),
      ssl: env("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : undefined,
    };

const SEEDS = [
  "sql/seed_db_admin_balances_hydration_targets.sql",
  "sql/seed_db_admin_balances_waste_targets.sql",
  "sql/seed_db_admin_balances_adjustment_params.sql",
];

const pool = new pg.Pool(config);

try {
  for (const relPath of SEEDS) {
    const absPath = path.resolve(process.cwd(), relPath);
    console.info(`[SQL] Aplicando ${relPath} ...`);
    const sql = fs.readFileSync(absPath, "utf8");
    await pool.query(sql);
    console.info(`[SQL] ✓ ${relPath}`);
  }

  // Verificación rápida
  const { rows } = await pool.query(`
    SELECT metric_code, COUNT(*) AS n
    FROM public.adm_dim_goal_target_profile_scd2
    WHERE is_current = true AND is_valid = true
      AND metric_code IN ('hydration_target','waste_target','adjustment_alpha','adjustment_beta')
    GROUP BY metric_code
    ORDER BY metric_code
  `);
  console.info("[SQL] Verificación post-seed:");
  for (const r of rows) {
    console.info(`  ${r.metric_code.padEnd(20)} → ${r.n} registros`);
  }
  if (rows.length !== 4) {
    console.warn(`[SQL] ⚠ esperaba 4 metric_codes, obtuve ${rows.length}`);
  }
} finally {
  await pool.end();
}
