import crypto from 'crypto';
import { cookies } from 'next/headers';
import { q1 } from './db';

const SECRET = process.env.SESSION_SECRET || 'greendrop-dev-secret-change-me';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const COOKIE = 'gd_session';

export type Role = 'client' | 'worker' | 'admin';
export type Session = { uid: string; role: Role; name: string };

export function hashPin(pin: string) {
  const salt = crypto.randomBytes(8).toString('hex');
  const h = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${h}`;
}
export function checkPin(pin: string, stored: string) {
  const [salt, h] = stored.split(':');
  const h2 = crypto.scryptSync(pin, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(h2, 'hex'));
}

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export async function setSession(s: Session) {
  const body = Buffer.from(JSON.stringify({ ...s, exp: Date.now() + 1000 * 60 * 60 * 24 * 60 })).toString('base64url');
  const c = await cookies();
  c.set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  if (!v) return null;
  const [body, sig] = v.split('.');
  if (!body || !sig || sign(body) !== sig) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (s.exp < Date.now()) return null;
    if (s.role !== 'admin') {
      const u = await q1<any>('SELECT active FROM users WHERE id=$1', [s.uid]);
      if (!u || !u.active) return null;
    }
    return { uid: s.uid, role: s.role, name: s.name };
  } catch {
    return null;
  }
}

export function normPhone(p: string) {
  const d = String(p || '').replace(/[^\d+]/g, '');
  return d;
}

export function newId(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}
