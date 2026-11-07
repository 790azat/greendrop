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
  { key: 'paid', title: 'Получил оплату наличными', hint: 'Отметьте, когда клиент оплатил', cashOnly: true },
  { key: 'done', title: 'Заказ выполнен', hint: 'Финальная отметка, клиент получит уведомление' },
];

export function stepsFor(order: { payment?: string }) {
  return STEPS.filter((s) => !s.cashOnly || order.payment === 'cash');
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

export type Settings = {
  currency: string;
  basePrice: number; // first bag
  extraBagPrice: number;
  largeBagExtra: number;
  bulkyPrice: number;
  expressPrice: number;
  workerSharePercent: number;
  maxBags: number;
  serviceArea: string;
};

export const DEFAULT_SETTINGS: Settings = {
  currency: '֏',
  basePrice: 500,
  extraBagPrice: 200,
  largeBagExtra: 200,
  bulkyPrice: 1500,
  expressPrice: 300,
  workerSharePercent: 70,
  maxBags: 10,
  serviceArea: 'Ереван',
};

export function calcPrice(
  s: Settings,
  o: { bags: number; size: string; bulky?: boolean; express?: boolean }
) {
  const bags = Math.max(1, Math.min(Number(o.bags) || 1, s.maxBags));
  let p = s.basePrice + (bags - 1) * s.extraBagPrice;
  if (o.size === 'large') p += bags * s.largeBagExtra;
  if (o.bulky) p += s.bulkyPrice;
  if (o.express) p += s.expressPrice;
  return p;
}

export function money(n: number, cur: string) {
  return `${Math.round(n).toLocaleString('ru-RU')} ${cur}`;
}
