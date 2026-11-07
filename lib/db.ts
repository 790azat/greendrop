import { neon } from '@neondatabase/serverless';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const isDemoDb = !DB_URL;

let pglite: any = null;
let initPromise: Promise<void> | null = null;

const TABLES = ['users', 'orders', 'settings', 'photos', 'subscriptions', 'push_subs', 'otp_codes'];

async function raw(text: string, params: any[] = []): Promise<any[]> {
  if (DB_URL) {
    const sql = neon(DB_URL);
    return (await sql.query(text, params)) as any[];
  }
  if (!pglite) {
    const { PGlite } = await import('@electric-sql/pglite');
    pglite = new PGlite(); // in memory; persisted as JSON snapshots (see below)
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
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS otp_codes (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    tries INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
];

/* ---------- Demo persistence (no DATABASE_URL) ----------
   The embedded database lives in memory. After every write we save a small JSON
   snapshot of all tables (to Vercel Blob in production, to .data/ locally) and
   restore it on cold start, so the demo keeps its data between requests. */

let dirty = false;
let saveTimer: Promise<void> | null = null;
let lastSnapshotUrls: string[] = [];

async function exportAll() {
  const out: Record<string, any[]> = {};
  for (const t of TABLES) out[t] = await raw(`SELECT * FROM ${t}`);
  return JSON.stringify({ v: 1, at: new Date().toISOString(), tables: out });
}

async function importAll(json: string) {
  const snap = JSON.parse(json);
  for (const t of TABLES) {
    const rows = snap.tables?.[t];
    if (!rows?.length) continue;
    await raw(`INSERT INTO ${t} SELECT * FROM json_populate_recordset(NULL::${t}, $1) ON CONFLICT DO NOTHING`, [
      JSON.stringify(rows),
    ]);
  }
  await raw(`SELECT setval(pg_get_serial_sequence('orders','num'), GREATEST((SELECT COALESCE(MAX(num),0) FROM orders),1))`);
}

async function loadSnapshot() {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list } = await import('@vercel/blob');
      const res = await list({ prefix: 'db/' });
      const latest = res.blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
      if (!latest) return;
      lastSnapshotUrls = res.blobs.map((b) => b.url);
      const r = await fetch(latest.url, { cache: 'no-store' });
      if (r.ok) await importAll(await r.text());
    } else if (!process.env.VERCEL) {
      const fs = await import('fs');
      if (fs.existsSync('.data/snapshot.json')) await importAll(fs.readFileSync('.data/snapshot.json', 'utf8'));
    }
  } catch (e) {
    console.error('snapshot load failed', e);
  }
}

async function saveSnapshot() {
  if (!dirty) return;
  dirty = false;
  const json = await exportAll();
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put, del } = await import('@vercel/blob');
    const b = await put(`db/snap-${Date.now()}.json`, json, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });
    const old = lastSnapshotUrls;
    lastSnapshotUrls = [b.url];
    if (old.length) await del(old).catch(() => {});
  } else if (!process.env.VERCEL) {
    const fs = await import('fs');
    fs.mkdirSync('.data', { recursive: true });
    fs.writeFileSync('.data/snapshot.json', json);
  }
}

function scheduleSave() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = (async () => {
    await new Promise((r) => setTimeout(r, 400));
    try {
      await saveSnapshot();
    } catch (e) {
      console.error('snapshot save failed', e);
      dirty = true;
    } finally {
      saveTimer = null;
    }
  })();
  try {
    // keep the function alive until the snapshot is written
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { waitUntil } = require('@vercel/functions');
    waitUntil(saveTimer);
  } catch {}
}

/** Await pending snapshot writes (used at the end of mutating requests) */
export async function flush() {
  if (saveTimer) await saveTimer;
}

async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      for (const s of SCHEMA) await raw(s);
      if (!DB_URL) await loadSnapshot();
      const { seedIfEmpty } = await import('./seed');
      await seedIfEmpty(async (text: string, params: any[] = []) => {
        const rows = await raw(text, params);
        if (!DB_URL && !/^\s*select/i.test(text)) scheduleSave();
        return rows;
      });
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await init();
  const rows = (await raw(text, params)) as T[];
  if (!DB_URL && !/^\s*select/i.test(text)) scheduleSave();
  return rows;
}

export async function q1<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
