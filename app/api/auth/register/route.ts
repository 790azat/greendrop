import { q, q1 } from '@/lib/db';
import { hashPin, newId, normPhone, setSession } from '@/lib/auth';
import { err, handler, ok } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const role = b.role === 'worker' ? 'worker' : 'client';
  const name = String(b.name || '').trim();
  const phone = normPhone(b.phone);
  const pin = String(b.pin || '');
  if (name.length < 2) return err('Укажите имя');
  if (phone.replace(/\D/g, '').length < 7) return err('Укажите корректный телефон');
  if (!/^\d{4,8}$/.test(pin)) return err('PIN-код: от 4 до 8 цифр');
  const exists = await q1(`SELECT id FROM users WHERE phone=$1`, [phone]);
  if (exists) return err('Этот телефон уже зарегистрирован, войдите');
  const id = newId(role === 'worker' ? 'w_' : 'c_');
  // Workers need admin approval before they can take orders
  const active = role === 'client';
  await q(
    `INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, role, name, phone, hashPin(pin), active, JSON.stringify({ pending: role === 'worker' })]
  );
  if (!active) return ok({ pending: true });
  await setSession({ uid: id, role, name });
  return ok({ role });
});
