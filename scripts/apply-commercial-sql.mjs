#!/usr/bin/env node
// Crea db_commercial si no existe y aplica sql/db_commercial.sql.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

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

function buildBaseConfig(env) {
  if (env.DATABASE_URL?.trim()) {
    return {
      connectionString: env.DATABASE_URL,
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
    database: env.DATABASE_NAME || "datalakehouse",
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

function buildTargetConfig(baseConfig, env) {
  const targetDatabase = env.COMMERCIAL_DATABASE_NAME || "db_commercial";

  if (baseConfig.connectionString) {
    const url = new URL(baseConfig.connectionString);
    url.pathname = `/${targetDatabase}`;
    return {
      connectionString: url.toString(),
      ssl: baseConfig.ssl,
    };
  }

  return {
    ...baseConfig,
    database: targetDatabase,
  };
}

function buildAdminConfig(baseConfig) {
  if (baseConfig.connectionString) {
    const url = new URL(baseConfig.connectionString);
    url.pathname = "/postgres";
    return {
      connectionString: url.toString(),
      ssl: baseConfig.ssl,
    };
  }

  return {
    ...baseConfig,
    database: "postgres",
  };
}

async function ensureDatabaseExists(adminConfig, databaseName) {
  const pool = new Pool(adminConfig);
  try {
    const existing = await pool.query("select 1 from pg_database where datname = $1 limit 1", [databaseName]);
    if (existing.rowCount) {
      return false;
    }

    const escapedDatabaseName = `"${databaseName.replace(/"/g, "\"\"")}"`;
    await pool.query(`create database ${escapedDatabaseName}`);
    return true;
  } finally {
    await pool.end();
  }
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const baseConfig = buildBaseConfig(env);
  const targetDatabase = env.COMMERCIAL_DATABASE_NAME || "db_commercial";
  const targetConfig = buildTargetConfig(baseConfig, env);
  const adminConfig = buildAdminConfig(baseConfig);
  const isDryRun = process.argv.includes("--dry");
  const sqlPath = resolve("sql/db_commercial.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log(`[DB] Objetivo comercial: ${targetDatabase}`);
  console.log(`[SQL] Aplicando ${sqlPath} ${isDryRun ? "(DRY RUN)" : ""}...`);

  if (isDryRun) {
    console.log(`[SQL] Tamano: ${sql.length} bytes`);
    return;
  }

  const created = await ensureDatabaseExists(adminConfig, targetDatabase);
  console.log(created ? `[DB] Base ${targetDatabase} creada.` : `[DB] Base ${targetDatabase} ya existia.`);

  const pool = new Pool(targetConfig);
  try {
    await pool.query(sql);
    console.log("[SQL] Aplicado correctamente.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exit(1);
});
