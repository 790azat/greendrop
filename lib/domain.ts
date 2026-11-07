// Shared between server and client
export type StepDef = {
  key: string;
  title: string;
  hint?: string;
  photo?: boolean;
  cashOnly?: boolean;
};

export const STEPS: StepDef[] = [
  { key: 'accepted', title: 'Заказ принят', hint: 'Вы взяли заказ в работу' },
  { key: 'on_way', title: 'Выехал к клиенту', hint: 'Клиент увидит, что вы в пути' },
  { key: 'arrived', title: 'На месте, вижу мешки у двери', hint: 'Сфотографируйте мешки у двери до того, как забрать', photo: true },
  { key: 'picked', title: 'Забрал мешки', hint: 'Фото мешков в руках или в тележке. Проверьте количество', photo: true },
  { key: 'dumped', title: 'Выбросил в контейнер', hint: 'Фото у мусорного контейнера или на площадке', photo: true },
  { key: 'paid', title: 'Получил оплату', hint: 'Отметьте, когда клиент оплатил наличными или переводом', cashOnly: true },
  { key: 'done', title: 'Заказ выполнен', hint: 'Финальная отметка, клиент получит уведомление' },
];

export function stepsFor(order: { payment?: string }) {
  return STEPS.filter((s) => !s.cashOnly || order.payment !== 'online');
}

export const STATUS_LABEL: Record<string, string> = {
  new: 'Ищем исполнителя',
  accepted: 'Исполнитель назначен',
  on_way: 'Исполнитель в пути',
  arrived: 'Исполнитель на месте',
  picked: 'Мусор забран',
  dumped: 'Мусор выброшен',
  paid: 'Оплачено',
  done: 'Выполнен',
  cancelled: 'Отменён',
};

export const STATUS_COLOR: Record<string, string> = {
  new: 'amber',
  accepted: 'blue',
  on_way: 'blue',
  arrived: 'blue',
  picked: 'teal',
  dumped: 'teal',
  paid: 'teal',
  done: 'green',
  cancelled: 'gray',
};

export const SIZE_LABEL: Record<string, string> = {
  small: 'Маленькие (до 35 л)',
  medium: 'Средние (до 60 л)',
  large: 'Большие (до 120 л)',
};

export const SERVICES: Record<string, { title: string; icon: string; hint: string; unit: string }> = {
  trash: { title: 'Бытовой мусор', icon: '🗑️', hint: 'Пакеты с мусором от двери до контейнера', unit: 'меш.' },
  recycle: { title: 'Вторсырьё', icon: '♻️', hint: 'Пластик, бумага, стекло отдельно, сдаём на переработку', unit: 'меш.' },
  bulky: { title: 'Крупногабарит', icon: '🛋️', hint: 'Мебель, коробки, техника, строительный мусор', unit: 'предм.' },
};

export type Zone = { id: string; name: string; extra: number };
export type Promo = { code: string; type: 'percent' | 'fixed'; value: number; maxUses: number; used: number; active: boolean };

export type Settings = {
  currency: string;
  basePrice: number; // first bag
  extraBagPrice: number;
  largeBagExtra: number;
  bulkyPrice: number; // add-on: one large item with regular trash
  expressPrice: number;
  recyclePrice: number; // per bag of recyclables
  bulkyItemPrice: number; // bulky service, per item
  workerSharePercent: number;
  maxBags: number;
  serviceArea: string;
  subscriptionDiscountPercent: number;
  referralNewClientDiscount: number;
  referralBonus: number;
  tipOptions: string; // comma-separated
  zones: Zone[];
  promos: Promo[];
};

export const DEFAULT_SETTINGS: Settings = {
  currency: '֏',
  basePrice: 500,
  extraBagPrice: 200,
  largeBagExtra: 200,
  bulkyPrice: 1500,
  expressPrice: 300,
  recyclePrice: 300,
  bulkyItemPrice: 2000,
  workerSharePercent: 70,
  maxBags: 10,
  serviceArea: 'Ереван',
  subscriptionDiscountPercent: 15,
  referralNewClientDiscount: 300,
  referralBonus: 300,
  tipOptions: '100,200,500',
  zones: [
    { id: 'kentron', name: 'Кентрон', extra: 0 },
    { id: 'arabkir', name: 'Арабкир', extra: 0 },
    { id: 'ajapnyak', name: 'Аджапняк', extra: 100 },
    { id: 'davtashen', name: 'Давташен', extra: 100 },
    { id: 'malatia', name: 'Малатия-Себастия', extra: 150 },
    { id: 'shengavit', name: 'Шенгавит', extra: 100 },
    { id: 'nornork', name: 'Нор-Норк', extra: 150 },
    { id: 'avan', name: 'Аван', extra: 200 },
    { id: 'erebuni', name: 'Эребуни', extra: 150 },
  ],
  promos: [
    { code: 'WELCOME', type: 'percent', value: 20, maxUses: 1000, used: 0, active: true },
    { code: 'GREEN100', type: 'fixed', value: 100, maxUses: 500, used: 0, active: true },
  ],
};

export type OrderInput = {
  service?: string;
  bags: number;
  size?: string;
  bulky?: boolean;
  express?: boolean;
  zoneId?: string;
};

export function basePrice(s: Settings, o: OrderInput) {
  const n = Math.max(1, Math.min(Number(o.bags) || 1, s.maxBags));
  const lines: { label: string; amount: number }[] = [];
  const service = o.service || 'trash';
  if (service === 'recycle') {
    lines.push({ label: `Вторсырьё × ${n}`, amount: n * s.recyclePrice });
  } else if (service === 'bulky') {
    lines.push({ label: `Крупногабарит × ${n}`, amount: n * s.bulkyItemPrice });
  } else {
    lines.push({ label: n > 1 ? `Вынос ${n} мешков` : 'Вынос 1 мешка', amount: s.basePrice + (n - 1) * s.extraBagPrice });
    if (o.size === 'large') lines.push({ label: 'Большие мешки', amount: n * s.largeBagExtra });
    if (o.bulky) lines.push({ label: 'Крупный предмет', amount: s.bulkyPrice });
  }
  if (o.express) lines.push({ label: 'Срочно (30 мин)', amount: s.expressPrice });
  const zone = s.zones?.find((z) => z.id === o.zoneId);
  if (zone?.extra) lines.push({ label: `Район: ${zone.name}`, amount: zone.extra });
  return lines;
}

export type QuoteCtx = {
  promo?: Promo | null;
  referralFirstOrder?: boolean;
  bonus?: number;
  subscription?: boolean;
};

/** Full price with discounts. Used both for the preview in the app and on the server */
export function quote(s: Settings, o: OrderInput, ctx: QuoteCtx = {}) {
  const lines = basePrice(s, o);
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const discounts: { label: string; amount: number }[] = [];
  let left = subtotal;
  if (ctx.subscription && s.subscriptionDiscountPercent) {
    const d = Math.round((subtotal * s.subscriptionDiscountPercent) / 100);
    discounts.push({ label: `Подписка −${s.subscriptionDiscountPercent}%`, amount: d });
    left -= d;
  }
  if (ctx.promo) {
    const d = Math.min(left, ctx.promo.type === 'percent' ? Math.round((left * ctx.promo.value) / 100) : ctx.promo.value);
    discounts.push({ label: `Промокод ${ctx.promo.code}`, amount: d });
    left -= d;
  }
  if (ctx.referralFirstOrder && s.referralNewClientDiscount) {
    const d = Math.min(left, s.referralNewClientDiscount);
    discounts.push({ label: 'Скидка по приглашению', amount: d });
    left -= d;
  }
  if (ctx.bonus && ctx.bonus > 0) {
    const d = Math.min(left, ctx.bonus);
    if (d > 0) {
      discounts.push({ label: 'Бонусы', amount: d });
      left -= d;
    }
  }
  return { lines, subtotal, discounts, total: Math.max(0, Math.round(left)) };
}

/** Backward-compatible helper */
export function calcPrice(s: Settings, o: OrderInput) {
  return quote(s, o).total;
}

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Наличными исполнителю',
  online: 'Онлайн (Idram / ArCa / Telcell)',
  card: 'Переводом исполнителю',
};

export function money(n: number, cur: string) {
  return `${Math.round(n || 0).toLocaleString('ru-RU')} ${cur}`;
}

export function distanceKm(a?: { lat: number; lng: number } | null, b?: { lat: number; lng: number } | null) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Date in Yerevan as YYYY-MM-DD and weekday index (0 = Monday) */
export function localDay(d = new Date(), tz = 'Asia/Yerevan') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday') || 'Mon');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: wd };
}
