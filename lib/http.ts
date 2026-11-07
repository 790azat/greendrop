import { NextResponse } from 'next/server';
import { getSession, Role, Session } from './auth';
import { flush } from './db';

export function ok(data: any = { ok: true }) {
  return NextResponse.json(data);
}
export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Нужно войти в аккаунт');
  if (roles.length && !roles.includes(s.role)) throw new HttpError(403, 'Нет доступа');
  return s;
}

export function handler<T extends any[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      const res = await fn(...args);
      await flush();
      return res;
    } catch (e: any) {
      if (e instanceof HttpError) return err(e.message, e.status);
      console.error(e);
      return err('Ошибка сервера: ' + (e?.message || 'unknown'), 500);
    }
  };
}
