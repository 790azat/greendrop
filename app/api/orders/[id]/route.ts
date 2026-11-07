import { q, q1 } from '@/lib/db';
import { err, handler, ok, requireRole } from '@/lib/http';
import { loadOrder, pushHistory, saveOrder } from '@/lib/orders';
import { stepsFor } from '@/lib/domain';

type Ctx = { params: Promise<{ id: string }> };
const MAX_ACTIVE = 3;

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const s = await requireRole('client', 'worker', 'admin');
  const { id } = await ctx.params;
  const b = await req.json();
  const o = await loadOrder(id);
  if (!o) return err('Заказ не найден', 404);

  switch (b.action) {
    case 'cancel': {
      if (s.role === 'client') {
        if (o.clientId !== s.uid) return err('Нет доступа', 403);
        if (!['new', 'accepted'].includes(o.status)) return err('Исполнитель уже в пути, отменить нельзя. Свяжитесь с поддержкой');
      } else if (s.role !== 'admin') return err('Нет доступа', 403);
      if (['done', 'cancelled'].includes(o.status)) return err('Заказ уже закрыт');
      o.status = 'cancelled';
      o.cancelReason = String(b.reason || '').slice(0, 200);
      pushHistory(o, 'Заказ отменён' + (o.cancelReason ? `: ${o.cancelReason}` : ''), s.name);
      await saveOrder(o);
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
      o.steps = { ...(o.steps || {}), [def.key]: { at: new Date().toISOString(), photo: b.photo || undefined, note: b.note ? String(b.note).slice(0, 300) : undefined } };
      o.status = def.key;
      if (def.key === 'done') o.completedAt = new Date().toISOString();
      pushHistory(o, def.title, s.name);
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
      }
      await saveOrder(o);
      return ok({ order: o });
    }
    default:
      return err('Неизвестное действие');
  }
});
