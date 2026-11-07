import { q, q1 } from './db';
import { DEFAULT_SETTINGS, Settings } from './domain';

export async function getSettings(): Promise<Settings> {
  const row = await q1<any>(`SELECT value FROM settings WHERE key='main'`);
  return { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
}

export function rowToOrder(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    num: r.num,
    clientId: r.client_id,
    workerId: r.worker_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...r.data,
  };
}

export async function loadOrder(id: string) {
  return rowToOrder(await q1(`SELECT * FROM orders WHERE id=$1`, [id]));
}

export async function saveOrder(o: any) {
  const { id, num, clientId, workerId, status, createdAt, updatedAt, ...data } = o;
  await q(
    `UPDATE orders SET worker_id=$2, status=$3, data=$4, updated_at=NOW() WHERE id=$1`,
    [id, workerId || null, status, JSON.stringify(data)]
  );
}

export function pushHistory(o: any, text: string, by: string) {
  o.history = [...(o.history || []), { at: new Date().toISOString(), text, by }];
}
