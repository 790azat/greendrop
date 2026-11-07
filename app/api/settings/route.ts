import { handler, ok, requireRole } from '@/lib/http';
import { getSettings, saveSettings } from '@/lib/orders';
import { DEFAULT_SETTINGS } from '@/lib/domain';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const s = await getSettings();
  const sess = await getSession();
  if (sess?.role === 'admin') return ok(s);
  const { promos, ...pub } = s;
  return ok(pub);
});

export const PUT = handler(async (req: Request) => {
  await requireRole('admin');
  const b = await req.json();
  const cur = await getSettings();
  const next: any = { ...cur };
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (b[k] === undefined) continue;
    const def = (DEFAULT_SETTINGS as any)[k];
    if (k === 'zones') {
      next.zones = (Array.isArray(b.zones) ? b.zones : [])
        .filter((z: any) => z?.name)
        .map((z: any, i: number) => ({
          id: String(z.id || z.name).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 30) || `z${i}`,
          name: String(z.name).slice(0, 40),
          extra: Math.max(0, Number(z.extra) || 0),
        }));
    } else if (k === 'promos') {
      next.promos = (Array.isArray(b.promos) ? b.promos : [])
        .filter((p: any) => p?.code)
        .map((p: any) => ({
          code: String(p.code).toUpperCase().replace(/\s/g, '').slice(0, 20),
          type: p.type === 'fixed' ? 'fixed' : 'percent',
          value: Math.max(0, Number(p.value) || 0),
          maxUses: Math.max(0, Number(p.maxUses) || 0),
          used: Math.max(0, Number(p.used) || 0),
          active: p.active !== false,
        }));
    } else next[k] = typeof def === 'number' ? Math.max(0, Number(b[k]) || 0) : String(b[k]);
  }
  await saveSettings(next);
  return ok(next);
});
