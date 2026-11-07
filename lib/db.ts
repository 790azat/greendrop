import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const isDemoDb = !DB_URL;

let pglite: any = null;
let initPromise: Promise<void> | null = null;

async function raw(text: string, params: any[] = []): Promise<any[]> {
  if (DB_URL) {
    const sql = neon(DB_URL);
    return (await sql.query(text, params)) as any[];
  }
  if (!pglite) {
    const { PGlite } = await import('@electric-sql/pglite');
    // Demo mode: local file in dev, in-memory on serverless
    pglite = new PGlite(process.env.VERCEL ? undefined : './.data/pg');
  }
  const r = await pglite.query(text, params);
  return r.rows;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    num SERIAL,
    client_id TEXT NOT NULL,
    worker_id TEXT,
    status TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS orders_client_idx ON orders(client_id)`,
  `CREATE INDEX IF NOT EXISTS orders_worker_idx ON orders(worker_id)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      for (const s of SCHEMA) await raw(s);
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await init();
  return raw(text, params) as Promise<T[]>;
}

export async function q1<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
