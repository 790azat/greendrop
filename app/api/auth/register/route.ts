import { q1 } from '@/lib/db';
import { normPhone, setSession } from '@/lib/auth';
import { err, handler, ok } from '@/lib/http';
import { createUser } from '@/lib/users';

export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const role = b.role === 'worker' ? 'worker' : 'client';
  const name = String(b.name || '').trim();
  const phone = normPhone(b.phone);
  const pin = String(b.pin || '');
  if (name.length < 2) return err('Укажите имя');
  if (phone.replace(/\D/g, '').length < 7) return err('Укажите корректный телефон');
  if (!/^\d{4,8}$/.test(pin)) return err('PIN-код: от 4 до 8 цифр');
  if (await q1(`SELECT id FROM users WHERE phone=$1`, [phone])) return err('Этот телефон уже зарегистрирован, войдите');
  const u = await createUser({ role, name, phone, pin, ref: b.ref });
  if (!u.active) return ok({ pending: true });
  await setSession({ uid: u.id, role, name });
  return ok({ role });
});
