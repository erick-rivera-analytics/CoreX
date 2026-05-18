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
const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
const fromStatement = fromArg ? Number(fromArg.split("=")[1]) : 1;

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] ?? "";

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble) {
      if (char === "-" && next === "-") {
        current += char + next;
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === "/" && next === "*") {
        current += char + next;
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (char === "'" && !inDouble) {
      current += char;
      if (inSingle && source[index - 1] !== "\\") inSingle = false;
      else if (!inSingle) inSingle = true;
      continue;
    }

    if (char === '"' && !inSingle) {
      current += char;
      if (inDouble && source[index - 1] !== "\\") inDouble = false;
      else if (!inDouble) inDouble = true;
      continue;
    }

    if (char === ";" && !inSingle && !inDouble) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function statementLabel(statement) {
  const normalized = statement.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 120);
}

if (dryRun) {
  console.info(`[SQL] DRY RUN ${sqlPath}`);
  console.info(`[SQL] bytes=${sql.length}`);
  console.info(`[SQL] statements=${splitSqlStatements(sql).length}`);
  console.info(`[SQL] from=${fromStatement}`);
  process.exit(0);
}

const pool = new pg.Pool(config);

try {
  console.info(`[DB] Aplicando ${sqlPath} sobre ${config.database ?? "DATABASE_URL"}`);
  const statements = splitSqlStatements(sql);
  const startIndex = Number.isInteger(fromStatement) && fromStatement > 0 ? fromStatement - 1 : 0;
  console.info(`[SQL] Ejecutando ${statements.length - startIndex} statements en modo secuencial persistente (from=${startIndex + 1}).`);

  for (let index = startIndex; index < statements.length; index += 1) {
    const statement = statements[index];
    const label = statementLabel(statement);
    console.info(`[SQL] [${index + 1}/${statements.length}] ${label}`);
    await pool.query(statement);
  }

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

  const viewVerification = await pool.query(`
    select table_schema as schemaname, table_name as viewname
    from information_schema.views
    where table_schema = 'gld'
      and table_name in (
        'vw_prod_postharvest_capacity_hours_cur',
        'vw_prod_postharvest_step_flow_cur',
        'vw_prod_postharvest_day_universe_cur',
        'vw_prod_postharvest_lot_final_output_cur',
        'vw_prod_postharvest_period_universe_cur',
        'vw_prod_postharvest_rule_hours_cur',
        'vw_prod_postharvest_rule_side_hours_cur',
        'vw_prod_postharvest_hours_box_detail_cur',
        'vw_prod_postharvest_hours_box_cur'
      )
    order by viewname
  `);

  console.info("[SQL] Materializadas verificadas:");
  for (const row of verification.rows) {
    console.info(`  ${row.schemaname}.${row.matviewname}`);
  }

  console.info("[SQL] Vistas verificadas:");
  for (const row of viewVerification.rows) {
    console.info(`  ${row.schemaname}.${row.viewname}`);
  }

  if (verification.rows.length !== 9) {
    console.warn(`[SQL] Advertencia: se esperaban 9 materializadas y se verificaron ${verification.rows.length}.`);
  }

  if (viewVerification.rows.length !== 9) {
    console.warn(`[SQL] Advertencia: se esperaban 9 vistas y se verificaron ${viewVerification.rows.length}.`);
  }
} finally {
  await pool.end();
}
