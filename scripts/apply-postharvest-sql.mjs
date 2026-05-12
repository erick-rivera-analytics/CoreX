#!/usr/bin/env node
// Aplica sql/db_postharvest.sql contra la base db_postharvest.

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
  const host = env.DATABASE_HOST;
  const port = Number(env.DATABASE_PORT) || 5432;
  const user = env.DATABASE_USER;
  const password = env.DATABASE_PASSWORD;
  const database = env.POSTHARVEST_DATABASE_NAME || "db_postharvest";
  if (!host || !user || !password) {
    throw new Error("Faltan credenciales: setea DATABASE_HOST/USER/PASSWORD en .env.local");
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
  const sqlPath = resolve("sql/db_postharvest.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log(`[DB] Conectando a ${config.host}:${config.port}/${config.database}`);
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
