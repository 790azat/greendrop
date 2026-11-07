import { q } from '@/lib/db';
import { err, handler, ok, requireRole } from '@/lib/http';
import { pushToUser } from '@/lib/push';

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client', 'worker', 'admin');
  const b = await req.json();
  const sub = b.subscription;
  if (!sub?.endpoint) return err('Нет подписки');
  await q(
    `INSERT INTO push_subs (endpoint, user_id, role, data) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, role=EXCLUDED.role, data=EXCLUDED.data`,
    [sub.endpoint, s.uid, s.role, JSON.stringify(sub)]
  );
  if (b.test) await pushToUser(s.uid, { title: 'GreenDrop', body: 'Уведомления включены 🌿', url: '/' });
  return ok();
});

export const DELETE = handler(async (req: Request) => {
  await requireRole('client', 'worker', 'admin');
  const b = await req.json().catch(() => ({}));
  if (b.endpoint) await q(`DELETE FROM push_subs WHERE endpoint=$1`, [b.endpoint]);
  return ok();
});
