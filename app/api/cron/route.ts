import { ensureSubscriptionOrders } from '@/lib/orders';
import { flush } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const created = await ensureSubscriptionOrders(true);
  await flush();
  return Response.json({ created });
}
