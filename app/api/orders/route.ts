import { q, q1 } from '@/lib/db';
import { newId } from '@/lib/auth';
import { err, handler, ok, requireRole } from '@/lib/http';
import { getSettings, rowToOrder } from '@/lib/orders';
import { calcPrice } from '@/lib/domain';

export const dynamic = 'force-dynamic';

function forPublicList(o: any) {
  // Before a worker accepts, hide the exact apartment and the phone
  const { address = {}, clientPhone, ...rest } = o;
  return { ...rest, address: { city: address.city, street: address.street, house: address.house, floor: address.floor } };
}

export const GET = handler(async () => {
  const s = await requireRole('client', 'worker', 'admin');
  if (s.role === 'client') {
    const rows = await q(`SELECT * FROM orders WHERE client_id=$1 ORDER BY created_at DESC LIMIT 100`, [s.uid]);
    return ok({ orders: rows.map(rowToOrder) });
  }
  if (s.role === 'worker') {
    const avail = await q(`SELECT * FROM orders WHERE status='new' ORDER BY created_at ASC LIMIT 100`);
    const mine = await q(`SELECT * FROM orders WHERE worker_id=$1 ORDER BY updated_at DESC LIMIT 200`, [s.uid]);
    return ok({
      available: avail.map(rowToOrder).map(forPublicList),
      mine: mine.map(rowToOrder),
    });
  }
  const rows = await q(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000`);
  return ok({ orders: rows.map(rowToOrder) });
});

const str = (v: any, max = 120) => String(v ?? '').trim().slice(0, max);

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client');
  const b = await req.json();
  const settings = await getSettings();
  const address = {
    city: str(b.address?.city, 60) || settings.serviceArea,
    street: str(b.address?.street),
    house: str(b.address?.house, 20),
    entrance: str(b.address?.entrance, 10),
    floor: str(b.address?.floor, 10),
    apt: str(b.address?.apt, 20),
    intercom: str(b.address?.intercom, 30),
  };
  if (!address.street || !address.house) return err('Укажите улицу и дом');
  if (!address.floor) return err('Укажите этаж');
  if (!address.apt) return err('Укажите квартиру');
  const photos: string[] = Array.isArray(b.photos) ? b.photos.filter((x: any) => typeof x === 'string').slice(0, 4) : [];
  if (!photos.length) return err('Добавьте хотя бы одно фото мешков или двери');
  const bags = Math.max(1, Math.min(Number(b.bags) || 1, settings.maxBags));
  const size = ['small', 'medium', 'large'].includes(b.size) ? b.size : 'medium';
  const bulky = !!b.bulky;
  const express = b.when === 'asap' && !!b.express;
  const when = b.when === 'asap' || !b.when ? 'asap' : str(b.when, 40);
  const payment = b.payment === 'card' ? 'card' : 'cash';
  const price = calcPrice(settings, { bags, size, bulky, express });

  const user = await q1<any>(`SELECT * FROM users WHERE id=$1`, [s.uid]);
  const id = newId('o_');
  const data = {
    address,
    bags,
    size,
    bulky,
    express,
    when,
    payment,
    comment: str(b.comment, 500),
    clientPhotos: photos,
    price,
    currency: settings.currency,
    workerShare: Math.round((price * settings.workerSharePercent) / 100),
    clientName: user?.name,
    clientPhone: user?.phone,
    steps: {},
    history: [{ at: new Date().toISOString(), text: 'Заказ создан', by: user?.name }],
  };
  await q(`INSERT INTO orders (id, client_id, status, data) VALUES ($1,$2,'new',$3)`, [id, s.uid, JSON.stringify(data)]);

  // remember address for next time
  const addrs = (user?.data?.addresses || []).filter(
    (a: any) => !(a.street === address.street && a.house === address.house && a.apt === address.apt)
  );
  const nextData = { ...(user?.data || {}), addresses: [address, ...addrs].slice(0, 5) };
  await q(`UPDATE users SET data=$2 WHERE id=$1`, [s.uid, JSON.stringify(nextData)]);

  return ok({ id });
});
