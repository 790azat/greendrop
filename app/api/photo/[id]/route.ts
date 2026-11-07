import { q1 } from '@/lib/db';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await q1<any>(`SELECT mime, data FROM photos WHERE id=$1`, [id]);
  if (!p) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(p.data, 'base64'), {
    headers: { 'Content-Type': p.mime, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
