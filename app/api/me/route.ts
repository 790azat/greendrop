import { getSession } from '@/lib/auth';
import { q1, isDemoDb } from '@/lib/db';
import { handler, ok } from '@/lib/http';
import { getSettings } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const s = await getSession();
  const settings = await getSettings();
  let user: any = null;
  if (s && s.role !== 'admin') {
    const u = await q1<any>(`SELECT id, role, name, phone, data FROM users WHERE id=$1`, [s.uid]);
    if (u) user = { id: u.id, role: u.role, name: u.name, phone: u.phone, addresses: u.data?.addresses || [] };
  } else if (s) user = { id: 'admin', role: 'admin', name: 'Администратор' };
  return ok({ user, settings, demoDb: isDemoDb });
});
