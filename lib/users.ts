import crypto from 'crypto';
import { q, q1 } from './db';
import { hashPin, newId } from './auth';

export function makeReferralCode(name: string) {
  const base = (name || 'GD').replace(/[^A-Za-zА-Яа-я]/g, '').slice(0, 4).toUpperCase();
  const tr: Record<string, string> = { А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ж:'J',З:'Z',И:'I',Й:'I',К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'H',Ц:'C',Ч:'C',Ш:'S',Щ:'S',Ы:'Y',Э:'E',Ю:'U',Я:'Y',Ь:'',Ъ:'',Ё:'E' };
  const latin = base.split('').map((c) => tr[c] ?? c).join('') || 'GD';
  return latin + crypto.randomBytes(2).toString('hex').toUpperCase();
}

export async function findByReferral(code?: string) {
  if (!code) return null;
  return q1<any>(`SELECT id FROM users WHERE UPPER(data->>'referralCode') = UPPER($1)`, [String(code).trim()]);
}

export async function createUser(opts: { role: 'client' | 'worker'; name: string; phone: string; pin?: string; ref?: string; verified?: boolean }) {
  const id = newId(opts.role === 'worker' ? 'w_' : 'c_');
  const active = opts.role === 'client';
  const data: any = { pending: opts.role === 'worker', phoneVerified: !!opts.verified };
  if (opts.role === 'client') {
    data.referralCode = makeReferralCode(opts.name);
    const inviter = await findByReferral(opts.ref);
    if (inviter) data.referredBy = inviter.id;
  }
  const pin = opts.pin || crypto.randomInt(100000, 999999).toString();
  await q(`INSERT INTO users (id, role, name, phone, pin_hash, active, data) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
    id, opts.role, opts.name, opts.phone, hashPin(pin), active, JSON.stringify(data),
  ]);
  return { id, active };
}
