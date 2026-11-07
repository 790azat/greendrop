import { q1 } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { err, handler, ok } from '@/lib/http';
import { DEMO } from '@/lib/seed';

const demoLoginEnabled = () => process.env.DISABLE_DEMO !== '1';

export const POST = handler(async (req: Request) => {
  if (!demoLoginEnabled()) return err('Демо-вход отключён', 403);
  const { role } = await req.json();
  if (role === 'admin') {
    await setSession({ uid: 'admin', role: 'admin', name: 'Администратор (демо)' });
    return ok({ role });
  }
  const acc = role === 'worker' ? DEMO.worker : DEMO.client;
  const u = await q1<any>(`SELECT id, name, role, active FROM users WHERE id=$1`, [acc.id]);
  if (!u) return err('Демо-аккаунт не найден (база не пустая). Зарегистрируйтесь обычным способом');
  if (!u.active) return err('Демо-аккаунт заблокирован администратором');
  await setSession({ uid: u.id, role: u.role, name: u.name });
  return ok({ role: u.role });
});
