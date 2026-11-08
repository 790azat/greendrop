import { q, q1 } from '@/lib/db';
import { hashPin, newId, normPhone } from '@/lib/auth';
import { err, handler, ok, requireRole } from '@/lib/http';
import { credit } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireRole('admin');
  const users = await q<any>(`SELECT id, role, name, phone, active, data, created_at FROM users ORDER BY created_at DESC`);
  const stats = await q<any>(
    `SELECT worker_id, COUNT(*)::int AS done, COALESCE(SUM((data->>'workerShare')::numeric),0)::float AS earned,
            AVG((data->>'rating')::numeric)::float AS rating
     FROM orders WHERE status='done' AND worker_id IS NOT NULL GROUP BY worker_id`
  );
  const byClient = await q<any>(
    `SELECT client_id, COUNT(*)::int AS orders, COALESCE(SUM((data->>'price')::numeric),0)::float AS spent
     FROM orders WHERE status<>'cancelled' GROUP BY client_id`
  );
  const bal = await q<any>(`SELECT user_id, COALESCE(SUM(amount),0)::int AS b FROM wallet_tx GROUP BY user_id`);
  const bm = Object.fromEntries(bal.map((x) => [x.user_id, Number(x.b)]));
  const sm = Object.fromEntries(stats.map((x) => [x.worker_id, x]));
  const cm = Object.fromEntries(byClient.map((x) => [x.client_id, x]));
  return ok({
    users: users.map((u) => ({
      id: u.id,
      role: u.role,
      name: u.name,
      phone: u.phone,
      active: u.active,
      pending: !!u.data?.pending,
      createdAt: u.created_at,
      done: sm[u.id]?.done || 0,
      earned: sm[u.id]?.earned || 0,
      rating: sm[u.id]?.rating || null,
      orders: cm[u.id]?.orders || 0,
      loc: u.data?.loc || null,
      bonus: Number(u.data?.bonus || 0),
      referralCode: u.data?.referralCode,
      referredBy: u.data?.referredBy,
      spent: cm[u.id]?.spent || 0,
      balance: bm[u.id] || 0,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  await requireRole('admin');
  const b = await req.json();
  if (b.action === 'create') {
    const name = String(b.name || '').trim();
    const phone = normPhone(b.phone);
    const pin = String(b.pin || '');
    if (name.length < 2 || phone.length < 7 || !/^\d{4,8}$/.test(pin)) return err('Имя, телефон и PIN (4-8 цифр) обязательны');
    if (await q1(`SELECT id FROM users WHERE phone=$1`, [phone])) return err('Телефон уже зарегистрирован');
    await q(`INSERT INTO users (id, role, name, phone, pin_hash, active) VALUES ($1,'worker',$2,$3,$4,TRUE)`, [
      newId('w_'), name, phone, hashPin(pin),
    ]);
    return ok();
  }
  const u = await q1<any>(`SELECT * FROM users WHERE id=$1`, [b.id]);
  if (!u) return err('Пользователь не найден', 404);
  if (b.action === 'approve' || b.action === 'unblock') {
    await q(`UPDATE users SET active=TRUE, data=$2 WHERE id=$1`, [u.id, JSON.stringify({ ...u.data, pending: false })]);
    return ok();
  }
  if (b.action === 'block') {
    await q(`UPDATE users SET active=FALSE, data=$2 WHERE id=$1`, [u.id, JSON.stringify({ ...u.data, pending: false })]);
    return ok();
  }
  if (b.action === 'bonus') {
    await q(`UPDATE users SET data=$2 WHERE id=$1`, [u.id, JSON.stringify({ ...u.data, bonus: Math.max(0, Number(b.bonus) || 0) })]);
    return ok();
  }
  if (b.action === 'balance') {
    const amount = Math.round(Number(b.amount) || 0);
    if (!amount || Math.abs(amount) > 1000000) return err('Неверная сумма');
    await credit(u.id, amount, 'admin', String(b.note || '').slice(0, 120) || 'Корректировка администратором');
    return ok();
  }
  if (b.action === 'resetPin') {
    if (!/^\d{4,8}$/.test(String(b.pin || ''))) return err('PIN: 4-8 цифр');
    await q(`UPDATE users SET pin_hash=$2 WHERE id=$1`, [u.id, hashPin(String(b.pin))]);
    return ok();
  }
  return err('Неизвестное действие');
});
