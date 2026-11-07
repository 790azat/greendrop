import { q1 } from '@/lib/db';
import { handler, ok, requireRole } from '@/lib/http';
import { findPromo, getSettings } from '@/lib/orders';
import { quote } from '@/lib/domain';

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client');
  const b = await req.json();
  const settings = await getSettings();
  const u = await q1<any>(`SELECT data FROM users WHERE id=$1`, [s.uid]);
  const prev = await q1<any>(`SELECT COUNT(*)::int AS n FROM orders WHERE client_id=$1 AND status<>'cancelled'`, [s.uid]);
  const promo = findPromo(settings, b.promo);
  const qt = quote(settings, b, {
    promo,
    referralFirstOrder: !!u?.data?.referredBy && (prev?.n || 0) === 0,
    bonus: b.useBonus === false ? 0 : Number(u?.data?.bonus || 0),
    subscription: !!b.subscription,
  });
  return ok({ ...qt, promoValid: b.promo ? !!promo : undefined });
});
