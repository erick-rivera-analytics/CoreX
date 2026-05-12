import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

declare global {
  var __dashboardCommercialPool: Pool | undefined;
}

function hasUrlConfig() {
  return Boolean(process.env.DATABASE_URL);
}

function hasSplitConfig() {
  return [
    process.env.DATABASE_HOST,
    process.env.DATABASE_PORT,
    process.env.DATABASE_USER,
    process.env.DATABASE_PASSWORD,
  ].every(Boolean);
}

function sslEnabled() {
  return process.env.DATABASE_SSL === "true";
}

function buildDatabaseUrl(databaseName: string) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function buildPoolConfig(): PoolConfig | null {
  if (hasUrlConfig()) {
    return {
      connectionString: buildDatabaseUrl(process.env.COMMERCIAL_DATABASE_NAME ?? "db_commercial") ?? undefined,
      ssl: sslEnabled() ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS) || 30000,
    };
  }

  if (!hasSplitConfig()) {
    return null;
  }

  return {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    database: process.env.COMMERCIAL_DATABASE_NAME ?? "db_commercial",
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: sslEnabled() ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS) || 30000,
  };
}

export function getCommercialPool() {
  const config = buildPoolConfig();
  if (!config) return null;

  if (!global.__dashboardCommercialPool) {
    global.__dashboardCommercialPool = new Pool(config);
  }

  return global.__dashboardCommercialPool;
}

export async function queryCommercial<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const pool = getCommercialPool();
  if (!pool) {
    throw new Error("Commercial database is not configured.");
  }

  return pool.query<T>(text, values);
}

export async function withCommercialTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  const pool = getCommercialPool();
  if (!pool) {
    throw new Error("Commercial database is not configured.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
