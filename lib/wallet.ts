import { q, q1 } from './db';
import { newId } from './auth';

// The wallet is a ledger: balance = sum of all transactions of the user.
export type TxKind = 'topup' | 'order' | 'refund' | 'tip' | 'admin';

export async function getBalance(userId: string) {
  const r = await q1<any>(`SELECT COALESCE(SUM(amount),0)::int AS b FROM wallet_tx WHERE user_id=$1`, [userId]);
  return Number(r?.b || 0);
}

export async function listTx(userId: string, limit = 50) {
  const rows = await q<any>(
    `SELECT id, amount, kind, note, order_id, created_at FROM wallet_tx WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => ({ id: r.id, amount: r.amount, kind: r.kind, note: r.note, orderId: r.order_id, at: r.created_at }));
}

export async function credit(userId: string, amount: number, kind: TxKind, note: string, orderId?: string) {
  amount = Math.round(amount);
  if (!amount) return;
  await q(`INSERT INTO wallet_tx (id, user_id, amount, kind, note, order_id) VALUES ($1,$2,$3,$4,$5,$6)`, [
    newId('t_'), userId, amount, kind, note, orderId || null,
  ]);
}

/** Takes money only if the balance is enough. Returns false otherwise. */
export async function charge(userId: string, amount: number, kind: TxKind, note: string, orderId?: string) {
  amount = Math.round(amount);
  if (amount <= 0) return true;
  const r = await q(
    `INSERT INTO wallet_tx (id, user_id, amount, kind, note, order_id)
     SELECT $1,$2,$3,$4,$5,$6
     WHERE (SELECT COALESCE(SUM(amount),0) FROM wallet_tx WHERE user_id=$2) >= $7
     RETURNING id`,
    [newId('t_'), userId, -amount, kind, note, orderId || null, amount]
  );
  return r.length > 0;
}
