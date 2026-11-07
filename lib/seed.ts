import crypto from 'crypto';

// Demo accounts shown on the landing page
export const DEMO = {
  client: { id: 'c_demo', name: 'Анна (демо)', phone: '+37400000001', pin: '1111' },
  worker: { id: 'w_demo', name: 'Арам (демо)', phone: '+37400000002', pin: '2222' },
  worker2: { id: 'w_demo2', name: 'Давид (демо)', phone: '+37400000003', pin: '2222' },
};

function hashPin(pin: string) {
  const salt = crypto.randomBytes(8).toString('hex');
  return `${salt}:${crypto.scryptSync(pin, salt, 32).toString('hex')}`;
}

type Q = (text: string, params?: any[]) => Promise<any[]>;

export async function seedIfEmpty(q: Q) {
  const r = await q(`SELECT COUNT(*)::int AS n FROM users`);
  if ((r[0]?.n || 0) > 0) return;
  if (process.env.DISABLE_DEMO === '1') return;

  const home = { lat: 40.1866, lng: 44.5149 };
  const addr = { city: 'Ереван', street: 'ул. Абовяна', house: '12', entrance: '2', floor: '5', apt: '17', intercom: '17К', zoneId: 'kentron', ...home };

  await q(`INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ($1,'client',$2,$3,$4,TRUE,$5)`, [
    DEMO.client.id, DEMO.client.name, DEMO.client.phone, hashPin(DEMO.client.pin),
    JSON.stringify({ addresses: [addr], referralCode: 'ANNA2026', bonus: 300, demo: true }),
  ]);
  await q(`INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ($1,'worker',$2,$3,$4,TRUE,$5)`, [
    DEMO.worker.id, DEMO.worker.name, DEMO.worker.phone, hashPin(DEMO.worker.pin),
    JSON.stringify({ demo: true, loc: { lat: 40.1792, lng: 44.4991, at: new Date().toISOString() } }),
  ]);
  await q(`INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ($1,'worker',$2,$3,$4,TRUE,$5)`, [
    DEMO.worker2.id, DEMO.worker2.name, DEMO.worker2.phone, hashPin(DEMO.worker2.pin),
    JSON.stringify({ demo: true, loc: { lat: 40.2049, lng: 44.5121, at: new Date().toISOString() } }),
  ]);
  await q(`INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ('c_demo_b','client','Лилит','+37400000004',$1,TRUE,$2)`, [
    hashPin('4444'), JSON.stringify({ referralCode: 'LILIT777', referredBy: 'c_demo', demo: true }),
  ]);
  await q(`INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ('w_demo_pending','worker','Карен (заявка)','+37400000005',$1,FALSE,$2)`, [
    hashPin('5555'), JSON.stringify({ pending: true, demo: true }),
  ]);

  const now = Date.now();
  const iso = (minAgo: number) => new Date(now - minAgo * 60000).toISOString();
  const base = {
    clientName: DEMO.client.name, clientPhone: DEMO.client.phone, currency: '֏', payment: 'cash', size: 'medium',
    bulky: false, express: false, when: 'asap', service: 'trash', comment: '', paymentStatus: 'pending',
  };
  const orders = [
    {
      id: 'o_demo_done', client: DEMO.client.id, worker: DEMO.worker.id, status: 'done', created: iso(60 * 26),
      data: {
        ...base, address: addr, bags: 2, price: 700, subtotal: 700, workerShare: 490, clientPhotos: ['/demo/door.svg'],
        workerName: DEMO.worker.name, workerPhone: DEMO.worker.phone, payment: 'online', paymentStatus: 'paid', paidAt: iso(60 * 26),
        steps: {
          accepted: { at: iso(60 * 26 - 3) }, on_way: { at: iso(60 * 26 - 4) }, arrived: { at: iso(60 * 26 - 15), photo: '/demo/door.svg' },
          picked: { at: iso(60 * 26 - 16), photo: '/demo/picked.svg' }, dumped: { at: iso(60 * 26 - 22), photo: '/demo/container.svg' }, done: { at: iso(60 * 26 - 23) },
        },
        completedAt: iso(60 * 26 - 23), rating: 5, review: 'Очень быстро, спасибо!', tip: 200,
        history: [{ at: iso(60 * 26), text: 'Заказ создан', by: DEMO.client.name }, { at: iso(60 * 26 - 23), text: 'Заказ выполнен', by: DEMO.worker.name }],
      },
    },
    {
      id: 'o_demo_work', client: DEMO.client.id, worker: DEMO.worker.id, status: 'arrived', created: iso(25),
      data: {
        ...base, address: addr, bags: 1, service: 'recycle', price: 300, subtotal: 300, workerShare: 210, clientPhotos: ['/demo/door.svg'],
        workerName: DEMO.worker.name, workerPhone: DEMO.worker.phone,
        steps: { accepted: { at: iso(22) }, on_way: { at: iso(20) }, arrived: { at: iso(3), photo: '/demo/door.svg' } },
        history: [{ at: iso(25), text: 'Заказ создан', by: DEMO.client.name }, { at: iso(22), text: 'Исполнитель принял заказ', by: DEMO.worker.name }],
      },
    },
    {
      id: 'o_demo_new1', client: 'c_demo_b', worker: null, status: 'new', created: iso(6),
      data: {
        ...base, clientName: 'Лилит', clientPhone: '+37400000004', address: { city: 'Ереван', street: 'пр. Комитаса', house: '45', entrance: '1', floor: '9', apt: '36', zoneId: 'arabkir', lat: 40.2075, lng: 44.5153 },
        bags: 3, size: 'large', price: 1500, subtotal: 1500, workerShare: 1050, clientPhotos: ['/demo/door.svg'], express: true, comment: 'Пакеты справа от двери', steps: {},
        history: [{ at: iso(6), text: 'Заказ создан', by: 'Лилит' }],
      },
    },
    {
      id: 'o_demo_new2', client: 'c_demo_b', worker: null, status: 'new', created: iso(2),
      data: {
        ...base, clientName: 'Лилит', clientPhone: '+37400000004', service: 'bulky', address: { city: 'Ереван', street: 'ул. Туманяна', house: '8', entrance: '3', floor: '2', apt: '41', zoneId: 'kentron', lat: 40.1853, lng: 44.5154 },
        bags: 1, price: 2000, subtotal: 2000, workerShare: 1400, clientPhotos: ['/demo/door.svg'], comment: 'Старый стул и 2 коробки', steps: {},
        history: [{ at: iso(2), text: 'Заказ создан', by: 'Лилит' }],
      },
    },
  ];
  for (const o of orders) {
    await q(`INSERT INTO orders (id, client_id, worker_id, status, data, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`, [
      o.id, o.client, o.worker, o.status, JSON.stringify(o.data), o.created,
    ]);
  }
  await q(`INSERT INTO subscriptions (id, client_id, active, data) VALUES ('s_demo', $1, TRUE, $2)`, [
    DEMO.client.id,
    JSON.stringify({ address: addr, days: [0, 2, 4], time: '09:00', bags: 1, size: 'medium', service: 'trash', payment: 'online', perVisit: 425, lastGenerated: null }),
  ]);
}
