#!/usr/bin/env node
// Aplica sql/db_quality.sql contra la base db_calidad.

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

function buildPoolConfig(env) {
  if (env.QUALITY_DATABASE_URL && env.QUALITY_DATABASE_URL.length > 0) {
    return {
      connectionString: env.QUALITY_DATABASE_URL,
      ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    };
  }

  const host = env.DATABASE_HOST;
  const port = Number(env.DATABASE_PORT) || 5432;
  const user = env.DATABASE_USER;
  const password = env.DATABASE_PASSWORD;
  const database = env.QUALITY_DATABASE_NAME || "db_calidad";
  if (!host || !user || !password) {
    throw new Error("Faltan credenciales: setea QUALITY_DATABASE_URL o DATABASE_HOST/USER/PASSWORD en .env.local");
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const config = buildPoolConfig(env);
  const isDryRun = process.argv.includes("--dry");
  const sqlPath = resolve("sql/db_quality.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const { database, host, port } = config.connectionString
    ? { database: "(via URL)", host: "(via URL)", port: "" }
    : config;

  console.log(`[DB] Conectando a ${host}:${port}/${database}`);
  console.log(`[SQL] Aplicando ${sqlPath} ${isDryRun ? "(DRY RUN)" : ""}...`);

  if (isDryRun) {
    console.log(`[SQL] Tamano: ${sql.length} bytes`);
    return;
  }

  const pool = new Pool(config);
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
