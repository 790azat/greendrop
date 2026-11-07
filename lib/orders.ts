import { q, q1 } from './db';
import { newId } from './auth';
import { DEFAULT_SETTINGS, Settings, localDay, quote, SERVICES } from './domain';
import { pushToRole } from './push';

export async function getSettings(): Promise<Settings> {
  const row = await q1<any>(`SELECT value FROM settings WHERE key='main'`);
  return { ...DEFAULT_SETTINGS, ...(row?.value || {}) };
}

export async function saveSettings(s: Settings) {
  await q(
    `INSERT INTO settings (key, value) VALUES ('main', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [JSON.stringify(s)]
  );
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
  await q(`UPDATE orders SET worker_id=$2, status=$3, data=$4, updated_at=NOW() WHERE id=$1`, [
    id, workerId || null, status, JSON.stringify(data),
  ]);
}

export function pushHistory(o: any, text: string, by: string) {
  o.history = [...(o.history || []), { at: new Date().toISOString(), text, by }];
}

const str = (v: any, max = 120) => String(v ?? '').trim().slice(0, max);

export function cleanAddress(a: any, s: Settings) {
  const lat = Number(a?.lat);
  const lng = Number(a?.lng);
  return {
    city: str(a?.city, 60) || s.serviceArea,
    street: str(a?.street),
    house: str(a?.house, 20),
    entrance: str(a?.entrance, 10),
    floor: str(a?.floor, 10),
    apt: str(a?.apt, 20),
    intercom: str(a?.intercom, 30),
    zoneId: s.zones.some((z) => z.id === a?.zoneId) ? a.zoneId : '',
    ...(isFinite(lat) && isFinite(lng) && lat && lng ? { lat, lng } : {}),
  };
}

export function findPromo(s: Settings, code?: string) {
  if (!code) return null;
  const p = s.promos.find((x) => x.code.toUpperCase() === String(code).trim().toUpperCase());
  if (!p || !p.active || p.used >= p.maxUses) return null;
  return p;
}

/** Shared by manual orders and subscriptions */
export async function createOrder(
  clientId: string,
  b: any,
  opts: { subscriptionId?: string; requirePhoto?: boolean } = {}
) {
  const settings = await getSettings();
  const user = await q1<any>(`SELECT * FROM users WHERE id=$1`, [clientId]);
  if (!user) throw new Error('Клиент не найден');
  const address = cleanAddress(b.address, settings);
  if (!address.street || !address.house) throw new Error('Укажите улицу и дом');
  if (!address.floor) throw new Error('Укажите этаж');
  if (!address.apt) throw new Error('Укажите квартиру');
  const photos: string[] = Array.isArray(b.photos) ? b.photos.filter((x: any) => typeof x === 'string').slice(0, 4) : [];
  if (opts.requirePhoto !== false && !photos.length) throw new Error('Добавьте хотя бы одно фото мешков или двери');

  const service = SERVICES[b.service] ? b.service : 'trash';
  const bags = Math.max(1, Math.min(Number(b.bags) || 1, settings.maxBags));
  const size = ['small', 'medium', 'large'].includes(b.size) ? b.size : 'medium';
  const bulky = service === 'trash' && !!b.bulky;
  const express = (b.when === 'asap' || !b.when) && !!b.express;
  const when = b.when === 'asap' || !b.when ? 'asap' : str(b.when, 40);
  const payment = ['cash', 'card', 'online'].includes(b.payment) ? b.payment : 'cash';

  const prevOrders = await q1<any>(`SELECT COUNT(*)::int AS n FROM orders WHERE client_id=$1 AND status<>'cancelled'`, [clientId]);
  const referralFirstOrder = !!user.data?.referredBy && (prevOrders?.n || 0) === 0;
  const promo = findPromo(settings, b.promo);
  if (b.promo && !promo) throw new Error('Промокод не найден или закончился');
  const bonus = b.useBonus === false ? 0 : Number(user.data?.bonus || 0);
  const qt = quote(settings, { service, bags, size, bulky, express, zoneId: address.zoneId }, {
    promo, referralFirstOrder, bonus, subscription: !!opts.subscriptionId,
  });
  const usedBonus = qt.discounts.find((d) => d.label === 'Бонусы')?.amount || 0;

  const id = newId('o_');
  const data = {
    service,
    address,
    bags,
    size,
    bulky,
    express,
    when,
    payment,
    paymentStatus: qt.total === 0 ? 'paid' : 'pending',
    comment: str(b.comment, 500),
    clientPhotos: photos,
    subtotal: qt.subtotal,
    discounts: qt.discounts,
    price: qt.total,
    currency: settings.currency,
    // the worker share is calculated from the full price, discounts are on the service
    workerShare: Math.round((qt.subtotal * settings.workerSharePercent) / 100),
    promo: promo?.code,
    referralFirstOrder,
    subscriptionId: opts.subscriptionId,
    clientName: user.name,
    clientPhone: user.phone,
    steps: {},
    history: [{ at: new Date().toISOString(), text: opts.subscriptionId ? 'Заказ создан по подписке' : 'Заказ создан', by: user.name }],
  };
  await q(`INSERT INTO orders (id, client_id, status, data) VALUES ($1,$2,'new',$3)`, [id, clientId, JSON.stringify(data)]);

  // bookkeeping: promo usage, bonus, saved addresses
  if (promo) {
    settings.promos = settings.promos.map((p) => (p.code === promo.code ? { ...p, used: p.used + 1 } : p));
    await saveSettings(settings);
  }
  const addrs = (user.data?.addresses || []).filter(
    (a: any) => !(a.street === address.street && a.house === address.house && a.apt === address.apt)
  );
  const nextData = { ...(user.data || {}), addresses: [address, ...addrs].slice(0, 5), bonus: Math.max(0, bonus - usedBonus) };
  if (b.useBonus === false) nextData.bonus = Number(user.data?.bonus || 0);
  await q(`UPDATE users SET data=$2 WHERE id=$1`, [clientId, JSON.stringify(nextData)]);

  await pushToRole('worker', {
    title: 'Новый заказ',
    body: `${SERVICES[service].title}: ${address.street}, ${address.house} · ${bags} ${SERVICES[service].unit}`,
    url: '/worker',
    tag: 'new-order',
  });
  return id;
}

/** Creates today's orders for active subscriptions (idempotent, cheap to call often) */
let lastSubCheck = 0;
export async function ensureSubscriptionOrders(force = false) {
  if (!force && Date.now() - lastSubCheck < 60_000) return 0;
  lastSubCheck = Date.now();
  const { date, weekday } = localDay();
  const subs = await q<any>(`SELECT * FROM subscriptions WHERE active`);
  let created = 0;
  for (const s of subs) {
    const d = s.data || {};
    if (!Array.isArray(d.days) || !d.days.includes(weekday) || d.lastGenerated === date) continue;
    // mark first to avoid duplicates from parallel calls
    const upd = await q(
      `UPDATE subscriptions SET data = jsonb_set(data, '{lastGenerated}', to_jsonb($2::text)) WHERE id=$1 AND COALESCE(data->>'lastGenerated','') <> $2 RETURNING id`,
      [s.id, date]
    );
    if (!upd.length) continue;
    try {
      const when = new Date(`${date}T${d.time || '09:00'}:00+04:00`).toISOString();
      await createOrder(s.client_id, { ...d, when, comment: d.comment || 'Регулярный вынос по подписке' }, { subscriptionId: s.id, requirePhoto: false });
      created++;
    } catch (e) {
      console.error('subscription order failed', s.id, e);
    }
  }
  return created;
}

/** Called when an order is completed: referral reward for the inviter */
export async function onOrderDone(o: any) {
  if (!o.referralFirstOrder || o.referralRewarded) return;
  const client = await q1<any>(`SELECT data FROM users WHERE id=$1`, [o.clientId]);
  const inviterId = client?.data?.referredBy;
  if (!inviterId) return;
  const s = await getSettings();
  const inv = await q1<any>(`SELECT data FROM users WHERE id=$1`, [inviterId]);
  if (!inv) return;
  await q(`UPDATE users SET data=$2 WHERE id=$1`, [
    inviterId,
    JSON.stringify({ ...inv.data, bonus: Number(inv.data?.bonus || 0) + s.referralBonus }),
  ]);
  o.referralRewarded = true;
}
