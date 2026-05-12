#!/usr/bin/env node
// Migra las tablas comerciales hacia la base comercial objetivo.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const TABLES = [
  "public.sls_claim_attachment_cur",
  "public.sls_claim_workflow_event_cur",
  "public.sls_claim_case_cur",
  "public.sls_bridge_claim_problem_parent_cur",
  "public.sls_dim_claim_problem_profile_scd2",
  "public.sls_ref_claim_problem_id_core_scd2",
  "public.sls_dim_commercializer_profile_scd2",
  "public.sls_ref_commercializer_id_core_scd2",
  "public.sls_dim_customer_profile_scd2",
  "public.sls_ref_customer_id_core_scd2",
  "public.sls_dim_account_executive_profile_scd2",
  "public.sls_ref_account_executive_id_core_scd2",
];

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(".env.local"), "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

function buildConfig(env, databaseName) {
  if (env.DATABASE_URL?.trim()) {
    const url = new URL(env.DATABASE_URL);
    url.pathname = `/${databaseName}`;
    return {
      connectionString: url.toString(),
      ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    };
  }

  if (!env.DATABASE_HOST || !env.DATABASE_USER || !env.DATABASE_PASSWORD) {
    throw new Error("Faltan credenciales base: setea DATABASE_URL o DATABASE_HOST/USER/PASSWORD en .env.local");
  }

  return {
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT) || 5432,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: databaseName,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function buildInsertStatement(tableName, columns) {
  const quotedColumns = columns.map(quoteIdentifier);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  return `insert into ${tableName} (${quotedColumns.join(", ")}) values (${placeholders.join(", ")})`;
}

async function copyTable(sourcePool, targetClient, tableName) {
  const result = await sourcePool.query(`select * from ${tableName}`);
  const rows = result.rows;

  await targetClient.query(`delete from ${tableName}`);

  if (rows.length === 0) {
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const insertSql = buildInsertStatement(tableName, columns);

  for (const row of rows) {
    await targetClient.query(insertSql, columns.map((column) => row[column]));
  }

  return rows.length;
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const sourceArgIndex = process.argv.findIndex((value) => value === "--source");
  const targetArgIndex = process.argv.findIndex((value) => value === "--target");
  const sourceDatabase = sourceArgIndex >= 0
    ? process.argv[sourceArgIndex + 1]
    : (env.QUALITY_DATABASE_NAME || "db_calidad");
  const targetDatabase = targetArgIndex >= 0
    ? process.argv[targetArgIndex + 1]
    : (env.COMMERCIAL_DATABASE_NAME || "db_commercial");

  if (sourceDatabase === targetDatabase) {
    throw new Error("QUALITY_DATABASE_NAME y COMMERCIAL_DATABASE_NAME no pueden apuntar a la misma base para esta migracion.");
  }

  const sourcePool = new Pool(buildConfig(env, sourceDatabase));
  const targetPool = new Pool(buildConfig(env, targetDatabase));
  const targetClient = await targetPool.connect();

  try {
    await targetClient.query("begin");
    const counts = [];

    for (const tableName of TABLES) {
      const copied = await copyTable(sourcePool, targetClient, tableName);
      counts.push({ tableName, copied });
    }

    await targetClient.query("commit");

    for (const { tableName, copied } of counts) {
      console.log(`[MIGRATE] ${tableName}: ${copied} filas`);
    }
  } catch (error) {
    await targetClient.query("rollback").catch(() => {});
    throw error;
  } finally {
    targetClient.release();
    await Promise.allSettled([sourcePool.end(), targetPool.end()]);
  }
}

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exit(1);
});
