import { q, q1 } from '@/lib/db';
import { newId } from '@/lib/auth';
import { err, handler, ok, requireRole } from '@/lib/http';
import { cleanAddress, ensureSubscriptionOrders, getSettings } from '@/lib/orders';
import { SERVICES, quote } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function rowToSub(r: any) {
  return { id: r.id, clientId: r.client_id, active: r.active, createdAt: r.created_at, ...r.data };
}

export const GET = handler(async () => {
  const s = await requireRole('client', 'admin');
  const rows =
    s.role === 'admin'
      ? await q(`SELECT s.*, u.name AS client_name, u.phone AS client_phone FROM subscriptions s LEFT JOIN users u ON u.id=s.client_id ORDER BY s.created_at DESC`)
      : await q(`SELECT * FROM subscriptions WHERE client_id=$1 ORDER BY created_at DESC`, [s.uid]);
  return ok({ subscriptions: rows.map((r: any) => ({ ...rowToSub(r), clientName: r.client_name, clientPhone: r.client_phone })) });
});

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client', 'admin');
  const b = await req.json();
  if (b.action === 'toggle' || b.action === 'delete') {
    const sub = await q1<any>(`SELECT * FROM subscriptions WHERE id=$1`, [b.id]);
    if (!sub || (s.role === 'client' && sub.client_id !== s.uid)) return err('Подписка не найдена', 404);
    if (b.action === 'delete') await q(`DELETE FROM subscriptions WHERE id=$1`, [b.id]);
    else await q(`UPDATE subscriptions SET active=NOT active WHERE id=$1`, [b.id]);
    return ok();
  }
  if (s.role !== 'client') return err('Подписку оформляет клиент');
  const settings = await getSettings();
  const address = cleanAddress(b.address, settings);
  if (!address.street || !address.house || !address.floor || !address.apt) return err('Заполните адрес: улица, дом, этаж, квартира');
  const days = (Array.isArray(b.days) ? b.days : []).map(Number).filter((d: number) => d >= 0 && d <= 6);
  if (!days.length) return err('Выберите хотя бы один день недели');
  const time = /^\d{2}:\d{2}$/.test(b.time) ? b.time : '09:00';
  const service = SERVICES[b.service] ? b.service : 'trash';
  const bags = Math.max(1, Math.min(Number(b.bags) || 1, settings.maxBags));
  const size = ['small', 'medium', 'large'].includes(b.size) ? b.size : 'medium';
  const payment = ['cash', 'card', 'online', 'wallet'].includes(b.payment) ? b.payment : 'online';
  const perVisit = quote(settings, { service, bags, size, zoneId: address.zoneId }, { subscription: true }).total;
  const id = newId('s_');
  await q(`INSERT INTO subscriptions (id, client_id, active, data) VALUES ($1,$2,TRUE,$3)`, [
    id, s.uid,
    JSON.stringify({ address, days: [...new Set(days)].sort(), time, service, bags, size, payment, perVisit, comment: String(b.comment || '').slice(0, 300), lastGenerated: null }),
  ]);
  await ensureSubscriptionOrders(true);
  return ok({ id });
});
