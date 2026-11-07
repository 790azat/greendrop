import { q, q1 } from '@/lib/db';
import { handler, ok, requireRole, err } from '@/lib/http';
import { createOrder, ensureSubscriptionOrders, rowToOrder } from '@/lib/orders';
import { distanceKm } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function forPublicList(o: any, loc: any) {
  // Before a worker accepts, hide the exact apartment and the phone
  const { address = {}, clientPhone, ...rest } = o;
  const d = distanceKm(loc, address.lat ? address : null);
  return {
    ...rest,
    distanceKm: d,
    address: { city: address.city, street: address.street, house: address.house, floor: address.floor, zoneId: address.zoneId, lat: address.lat, lng: address.lng },
  };
}

export const GET = handler(async () => {
  const s = await requireRole('client', 'worker', 'admin');
  await ensureSubscriptionOrders();
  if (s.role === 'client') {
    const rows = await q(`SELECT * FROM orders WHERE client_id=$1 ORDER BY created_at DESC LIMIT 100`, [s.uid]);
    const orders = rows.map(rowToOrder);
    // live worker location for active orders
    const wids = [...new Set(orders.filter((o) => o.workerId && !['done', 'cancelled'].includes(o.status)).map((o) => o.workerId))];
    if (wids.length) {
      const ws = await q<any>(`SELECT id, data FROM users WHERE id = ANY($1)`, [wids]);
      const loc = Object.fromEntries(ws.map((w) => [w.id, w.data?.loc]));
      for (const o of orders) if (o.workerId && loc[o.workerId]) o.workerLoc = loc[o.workerId];
    }
    return ok({ orders });
  }
  if (s.role === 'worker') {
    const me = await q1<any>(`SELECT data FROM users WHERE id=$1`, [s.uid]);
    const loc = me?.data?.loc || null;
    const avail = (await q(`SELECT * FROM orders WHERE status='new' ORDER BY created_at ASC LIMIT 100`))
      .map(rowToOrder)
      .map((o) => forPublicList(o, loc))
      .sort((a, b) => (a.express === b.express ? (a.distanceKm ?? 999) - (b.distanceKm ?? 999) : a.express ? -1 : 1));
    const mine = await q(`SELECT * FROM orders WHERE worker_id=$1 ORDER BY updated_at DESC LIMIT 200`, [s.uid]);
    return ok({ available: avail, mine: mine.map(rowToOrder), loc });
  }
  const rows = await q(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000`);
  return ok({ orders: rows.map(rowToOrder) });
});

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client');
  const b = await req.json();
  try {
    const id = await createOrder(s.uid, b);
    return ok({ id });
  } catch (e: any) {
    return err(e.message);
  }
});
