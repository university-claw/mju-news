import { config as loadDotenv } from "dotenv";
import pg from "pg";
import { ConfigError } from "../errors.js";

loadDotenv();

// Postgres DATE(1082) 기본 파서는 JS Date 객체(UTC 자정)로 변환하는데,
// 이를 다시 toISOString() 하면 KST 기준 자정이 하루 전으로 찍힌다.
// 원문 "YYYY-MM-DD" 문자열 그대로 받아 타임존 왜곡을 피한다.
pg.types.setTypeParser(1082, (v) => v);

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new ConfigError(
      `missing required env var: ${name}. Check .env (host Postgres 연결 정보).`,
    );
  }
  return v;
}

export function loadDbConfig(): DbConfig {
  const host = process.env.PGHOST ?? "127.0.0.1";
  const portRaw = process.env.PGPORT ?? "5432";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new ConfigError(`invalid PGPORT: ${portRaw}`);
  }
  return {
    host,
    port,
    database: requireEnv("PGDATABASE"),
    user: requireEnv("PGUSER"),
    password: requireEnv("PGPASSWORD"),
    schema: process.env.PGSCHEMA ?? "public_data",
  };
}

let cachedPool: pg.Pool | null = null;

/**
 * 프로세스 싱글톤 pg.Pool.
 * `search_path`를 스키마에 맞춰 고정해서 쿼리에서 schema prefix를 줄인다.
 */
export function getPool(): pg.Pool {
  if (cachedPool) return cachedPool;
  const cfg = loadDbConfig();
  // `options`는 libpq style로 세션 기본값을 서버에 전달한다.
  // 여기서 search_path를 먼저 걸어두면 connect 시점에 추가 쿼리를 쏠 필요가 없다
  // (pg v8의 'connect' listener에서 fire-and-forget 쿼리는 deprecation 경고 발생).
  const pool = new pg.Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: `-c search_path=${cfg.schema},public`,
    max: 4,
    idleTimeoutMillis: 10_000,
  });
  cachedPool = pool;
  return pool;
}

export async function closePool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
