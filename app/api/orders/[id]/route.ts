import { q, q1 } from '@/lib/db';
import { err, handler, ok, requireRole } from '@/lib/http';
import { loadOrder, onOrderDone, pushHistory, saveOrder } from '@/lib/orders';
import { STATUS_LABEL, money, stepsFor } from '@/lib/domain';
import { pushToRole, pushToUser } from '@/lib/push';
import { charge, credit } from '@/lib/wallet';

type Ctx = { params: Promise<{ id: string }> };
const MAX_ACTIVE = 3;

const CLIENT_PUSH: Record<string, string> = {
  accepted: 'Исполнитель принял ваш заказ',
  on_way: 'Исполнитель выехал к вам',
  arrived: 'Исполнитель на месте и забирает мусор',
  picked: 'Мусор забран',
  dumped: 'Мусор выброшен в контейнер',
  done: 'Заказ выполнен! Оцените, пожалуйста, работу',
};

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const s = await requireRole('client', 'worker', 'admin');
  const { id } = await ctx.params;
  const b = await req.json();
  const o = await loadOrder(id);
  if (!o) return err('Заказ не найден', 404);
  const notifyClient = (key: string) =>
    CLIENT_PUSH[key] && pushToUser(o.clientId, { title: `Заказ №${o.num}`, body: CLIENT_PUSH[key], url: '/client', tag: o.id });

  switch (b.action) {
    case 'cancel': {
      if (s.role === 'client') {
        if (o.clientId !== s.uid) return err('Нет доступа', 403);
        if (!['new', 'accepted'].includes(o.status)) return err('Исполнитель уже в пути, отменить нельзя. Свяжитесь с поддержкой');
      } else if (s.role !== 'admin') return err('Нет доступа', 403);
      if (['done', 'cancelled'].includes(o.status)) return err('Заказ уже закрыт');
      o.status = 'cancelled';
      o.cancelReason = String(b.reason || '').slice(0, 200);
      if (o.paymentStatus === 'paid' && o.payment === 'wallet' && o.price > 0) {
        await credit(o.clientId, o.price, 'refund', `Возврат за заказ №${o.num}`, o.id);
        o.paymentStatus = 'refunded';
        pushHistory(o, `Возврат ${money(o.price, o.currency)} на баланс`, 'GreenDrop');
      } else if (o.paymentStatus === 'paid' && o.payment === 'online') o.paymentStatus = 'refunded';
      pushHistory(o, 'Заказ отменён' + (o.cancelReason ? `: ${o.cancelReason}` : ''), s.name);
      await saveOrder(o);
      if (s.role === 'admin') await pushToUser(o.clientId, { title: `Заказ №${o.num}`, body: 'Заказ отменён', url: '/client' });
      if (o.workerId) await pushToUser(o.workerId, { title: `Заказ №${o.num}`, body: 'Заказ отменён', url: '/worker' });
      return ok({ order: o });
    }
    case 'accept': {
      if (s.role !== 'worker') return err('Нет доступа', 403);
      const active = await q1<any>(
        `SELECT COUNT(*)::int AS n FROM orders WHERE worker_id=$1 AND status NOT IN ('done','cancelled')`,
        [s.uid]
      );
      if ((active?.n || 0) >= MAX_ACTIVE) return err(`Можно держать не больше ${MAX_ACTIVE} активных заказов`);
      const taken = await q(
        `UPDATE orders SET worker_id=$2, status='accepted', updated_at=NOW() WHERE id=$1 AND status='new' RETURNING id`,
        [id, s.uid]
      );
      if (!taken.length) return err('Заказ уже взял другой исполнитель');
      const fresh = await loadOrder(id);
      const w = await q1<any>(`SELECT name, phone FROM users WHERE id=$1`, [s.uid]);
      fresh.workerName = w?.name;
      fresh.workerPhone = w?.phone;
      fresh.steps = { accepted: { at: new Date().toISOString() } };
      pushHistory(fresh, 'Исполнитель принял заказ', w?.name);
      await saveOrder(fresh);
      await notifyClient('accepted');
      return ok({ order: fresh });
    }
    case 'release': {
      if (s.role !== 'worker' || o.workerId !== s.uid) return err('Нет доступа', 403);
      if (o.steps?.picked) return err('Мусор уже забран, отказаться нельзя');
      o.status = 'new';
      o.workerId = null;
      o.workerName = null;
      o.workerPhone = null;
      o.steps = {};
      pushHistory(o, 'Исполнитель отказался, заказ снова в поиске', s.name);
      await saveOrder(o);
      await pushToRole('worker', { title: 'Заказ снова свободен', body: `${o.address?.street}, ${o.address?.house}`, url: '/worker' });
      return ok({ order: o });
    }
    case 'step': {
      if (s.role !== 'worker' || o.workerId !== s.uid) return err('Нет доступа', 403);
      if (['done', 'cancelled'].includes(o.status)) return err('Заказ уже закрыт');
      const steps = stepsFor(o);
      const idx = steps.findIndex((x) => x.key === b.key);
      if (idx < 0) return err('Неизвестный шаг');
      const prevMissing = steps.slice(0, idx).find((x) => !o.steps?.[x.key]);
      if (prevMissing) return err(`Сначала отметьте: «${prevMissing.title}»`);
      if (o.steps?.[b.key]) return err('Этот шаг уже отмечен');
      const def = steps[idx];
      if (def.photo && !b.photo) return err('Для этого шага нужно фото');
      o.steps = {
        ...(o.steps || {}),
        [def.key]: { at: new Date().toISOString(), photo: b.photo || undefined, note: b.note ? String(b.note).slice(0, 300) : undefined },
      };
      o.status = def.key;
      if (def.key === 'paid') o.paymentStatus = 'paid';
      if (def.key === 'done') {
        o.completedAt = new Date().toISOString();
        await onOrderDone(o);
      }
      pushHistory(o, def.title, s.name);
      await saveOrder(o);
      await notifyClient(def.key);
      return ok({ order: o });
    }
    case 'pay': {
      // Demo online payment. Real payments need a merchant contract (Idram / ArCa / Telcell)
      if (s.role !== 'client' || o.clientId !== s.uid) return err('Нет доступа', 403);
      if (o.status === 'cancelled') return err('Заказ отменён');
      const amount = Math.max(0, Number(b.amount) || 0);
      const provider = ['idram', 'arca', 'telcell', 'wallet'].includes(b.provider) ? b.provider : 'arca';
      const fromWallet = provider === 'wallet';
      if (b.purpose === 'tip') {
        if (o.status !== 'done') return err('Чаевые можно оставить после выполнения');
        if (amount <= 0 || amount > 100000) return err('Неверная сумма');
        if (fromWallet && !(await charge(s.uid, amount, 'tip', `Чаевые за заказ №${o.num}`, o.id))) return err('Недостаточно средств на балансе');
        o.tip = (o.tip || 0) + amount;
        pushHistory(o, `Чаевые ${money(amount, o.currency)} (${provider})`, s.name);
        await saveOrder(o);
        await pushToUser(o.workerId, { title: 'Вам оставили чаевые 🎉', body: `${money(amount, o.currency)} за заказ №${o.num}`, url: '/worker' });
        return ok({ order: o });
      }
      if (o.paymentStatus === 'paid') return err('Заказ уже оплачен');
      if (fromWallet && !(await charge(s.uid, o.price, 'order', `Оплата заказа №${o.num}`, o.id))) return err('Недостаточно средств на балансе');
      o.payment = fromWallet ? 'wallet' : 'online';
      o.paymentStatus = 'paid';
      o.paidAt = new Date().toISOString();
      o.paymentProvider = provider;
      pushHistory(o, fromWallet ? `Оплачено с баланса ${money(o.price, o.currency)}` : `Оплачено онлайн ${money(o.price, o.currency)} (${provider}, демо)`, s.name);
      await saveOrder(o);
      return ok({ order: o });
    }
    case 'rate': {
      if (s.role !== 'client' || o.clientId !== s.uid) return err('Нет доступа', 403);
      if (o.status !== 'done') return err('Оценить можно только выполненный заказ');
      o.rating = Math.max(1, Math.min(5, Number(b.rating) || 5));
      o.review = String(b.review || '').slice(0, 500);
      pushHistory(o, `Оценка клиента: ${o.rating}★`, s.name);
      await saveOrder(o);
      return ok({ order: o });
    }
    case 'assign': {
      if (s.role !== 'admin') return err('Нет доступа', 403);
      if (['done', 'cancelled'].includes(o.status)) return err('Заказ уже закрыт');
      if (!b.workerId) {
        o.status = 'new';
        o.workerId = null;
        o.workerName = null;
        o.workerPhone = null;
        o.steps = {};
        pushHistory(o, 'Администратор снял исполнителя', s.name);
      } else {
        const w = await q1<any>(`SELECT id, name, phone FROM users WHERE id=$1 AND role='worker' AND active`, [b.workerId]);
        if (!w) return err('Исполнитель не найден или не активен');
        o.workerId = w.id;
        o.workerName = w.name;
        o.workerPhone = w.phone;
        o.status = 'accepted';
        o.steps = { accepted: { at: new Date().toISOString() } };
        pushHistory(o, `Администратор назначил исполнителя: ${w.name}`, s.name);
        await pushToUser(w.id, { title: 'Вам назначен заказ', body: `${o.address?.street}, ${o.address?.house}`, url: '/worker' });
      }
      await saveOrder(o);
      if (b.workerId) await notifyClient('accepted');
      return ok({ order: o, status: STATUS_LABEL[o.status] });
    }
    default:
      return err('Неизвестное действие');
  }
});
