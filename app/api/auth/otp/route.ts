import crypto from 'crypto';
import { q, q1 } from '@/lib/db';
import { normPhone, setSession } from '@/lib/auth';
import { err, handler, ok } from '@/lib/http';
import { sendSms, smsEnabled } from '@/lib/sms';
import { createUser } from '@/lib/users';

export const POST = handler(async (req: Request) => {
  const b = await req.json();
  const phone = normPhone(b.phone);
  if (phone.replace(/\D/g, '').length < 7) return err('Укажите корректный телефон');

  if (b.action === 'send') {
    const prev = await q1<any>(`SELECT expires_at FROM otp_codes WHERE phone=$1`, [phone]);
    if (prev && new Date(prev.expires_at).getTime() - Date.now() > 4 * 60_000) return err('Код уже отправлен, подождите минуту');
    const code = crypto.randomInt(1000, 9999).toString();
    await q(
      `INSERT INTO otp_codes (phone, code, tries, expires_at) VALUES ($1,$2,0,NOW() + INTERVAL '5 minutes')
       ON CONFLICT (phone) DO UPDATE SET code=EXCLUDED.code, tries=0, expires_at=EXCLUDED.expires_at`,
      [phone, code]
    );
    const r = await sendSms(phone, `GreenDrop: ваш код ${code}`);
    const exists = !!(await q1(`SELECT id FROM users WHERE phone=$1`, [phone]));
    return ok({ sent: true, exists, demoCode: r.demo ? code : undefined, smsEnabled });
  }

  if (b.action === 'verify') {
    const row = await q1<any>(`SELECT * FROM otp_codes WHERE phone=$1`, [phone]);
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return err('Код истёк, запросите новый');
    if (row.tries >= 5) return err('Слишком много попыток, запросите новый код');
    if (String(b.code || '').trim() !== row.code) {
      await q(`UPDATE otp_codes SET tries=tries+1 WHERE phone=$1`, [phone]);
      return err('Неверный код');
    }
    let u = await q1<any>(`SELECT * FROM users WHERE phone=$1`, [phone]);
    if (!u) {
      const name = String(b.name || '').trim();
      if (name.length < 2) return ok({ needName: true });
      const role = b.role === 'worker' ? 'worker' : 'client';
      const created = await createUser({ role, name, phone, ref: b.ref, verified: true });
      await q(`DELETE FROM otp_codes WHERE phone=$1`, [phone]);
      if (!created.active) return ok({ pending: true });
      await setSession({ uid: created.id, role, name });
      return ok({ role });
    }
    await q(`DELETE FROM otp_codes WHERE phone=$1`, [phone]);
    if (!u.active) return err(u.data?.pending ? 'Аккаунт исполнителя ждёт одобрения администратора' : 'Аккаунт заблокирован', 403);
    await setSession({ uid: u.id, role: u.role, name: u.name });
    return ok({ role: u.role });
  }
  return err('Неизвестное действие');
});
