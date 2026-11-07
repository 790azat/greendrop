import { q } from '@/lib/db';
import { handler, ok, requireRole } from '@/lib/http';
import { getSettings } from '@/lib/orders';
import { DEFAULT_SETTINGS } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ok(await getSettings()));

export const PUT = handler(async (req: Request) => {
  await requireRole('admin');
  const b = await req.json();
  const cur = await getSettings();
  const next: any = { ...cur };
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (b[k] === undefined) continue;
    next[k] = typeof (DEFAULT_SETTINGS as any)[k] === 'number' ? Math.max(0, Number(b[k]) || 0) : String(b[k]);
  }
  await q(
    `INSERT INTO settings (key, value) VALUES ('main', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [JSON.stringify(next)]
  );
  return ok(next);
});
