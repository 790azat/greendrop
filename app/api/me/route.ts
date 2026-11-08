import { getSession } from '@/lib/auth';
import { q, q1, isDemoDb } from '@/lib/db';
import { isLang } from '@/lib/i18n';
import { getBalance } from '@/lib/wallet';
import { handler, ok } from '@/lib/http';
import { getSettings } from '@/lib/orders';
import { VAPID_PUBLIC } from '@/lib/push';
import { smsEnabled } from '@/lib/sms';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const s = await getSession();
  const settings = await getSettings();
  let user: any = null;
  if (s && s.role !== 'admin') {
    const u = await q1<any>(`SELECT id, role, name, phone, data FROM users WHERE id=$1`, [s.uid]);
    if (u) {
      const prev = await q1<any>(`SELECT COUNT(*)::int AS n FROM orders WHERE client_id=$1 AND status<>'cancelled'`, [u.id]);
      user = {
        id: u.id,
        role: u.role,
        name: u.name,
        phone: u.phone,
        addresses: u.data?.addresses || [],
        bonus: Number(u.data?.bonus || 0),
        referralCode: u.data?.referralCode,
        referralFirstOrder: !!u.data?.referredBy && (prev?.n || 0) === 0,
        demo: !!u.data?.demo,
        lang: u.data?.lang || null,
        balance: u.role === 'client' ? await getBalance(u.id) : 0,
      };
    }
  } else if (s) user = { id: 'admin', role: 'admin', name: s.name };
  // promo details stay on the server
  const { promos, ...publicSettings } = settings;
  return ok({
    user,
    settings: publicSettings,
    demoDb: isDemoDb,
    demoLogin: process.env.DISABLE_DEMO !== '1',
    vapidPublicKey: VAPID_PUBLIC || null,
    smsEnabled,
  });
});

/** Saves the interface language (used for push notifications) */
export const POST = handler(async (req: Request) => {
  const s = await getSession();
  const b = await req.json().catch(() => ({}));
  if (s && s.role !== 'admin' && isLang(b.lang)) {
    await q(`UPDATE users SET data = data || jsonb_build_object('lang', $2::text) WHERE id=$1`, [s.uid, b.lang]);
  }
  return ok();
});
