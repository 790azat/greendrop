import { q, q1 } from '@/lib/db';
import { err, handler, ok, requireRole } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const s = await requireRole('worker');
  const b = await req.json();
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!isFinite(lat) || !isFinite(lng)) return err('Неверные координаты');
  const u = await q1<any>(`SELECT data FROM users WHERE id=$1`, [s.uid]);
  await q(`UPDATE users SET data=$2 WHERE id=$1`, [
    s.uid,
    JSON.stringify({ ...(u?.data || {}), loc: { lat, lng, at: new Date().toISOString() } }),
  ]);
  return ok();
});
