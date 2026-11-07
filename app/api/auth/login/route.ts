import { q1 } from '@/lib/db';
import { ADMIN_PASSWORD, checkPin, normPhone, setSession } from '@/lib/auth';
import { err, handler, ok } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const b = await req.json();
  if (b.admin) {
    if (String(b.password || '') !== ADMIN_PASSWORD) return err('Неверный пароль администратора', 401);
    await setSession({ uid: 'admin', role: 'admin', name: 'Администратор' });
    return ok({ role: 'admin' });
  }
  const phone = normPhone(b.phone);
  const u = await q1<any>(`SELECT * FROM users WHERE phone=$1`, [phone]);
  if (!u || !checkPin(String(b.pin || ''), u.pin_hash)) return err('Неверный телефон или PIN-код', 401);
  if (!u.active) {
    return err(u.data?.pending ? 'Аккаунт исполнителя ждёт одобрения администратора' : 'Аккаунт заблокирован', 403);
  }
  await setSession({ uid: u.id, role: u.role, name: u.name });
  return ok({ role: u.role });
});
