import { err, handler, ok, requireRole } from '@/lib/http';
import { credit, getBalance, listTx } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

const PROVIDER_NAME: Record<string, string> = { idram: 'Idram', arca: 'ArCa', telcell: 'Telcell' };

export const GET = handler(async () => {
  const s = await requireRole('client');
  return ok({ balance: await getBalance(s.uid), tx: await listTx(s.uid) });
});

export const POST = handler(async (req: Request) => {
  const s = await requireRole('client');
  const b = await req.json();
  if (b.action === 'topup') {
    // Demo top-up. Real money needs a merchant agreement (Idram / ArCa / Telcell)
    const amount = Math.round(Number(b.amount) || 0);
    if (amount < 100 || amount > 500000) return err('Сумма пополнения: от 100 до 500 000');
    const p = PROVIDER_NAME[b.provider] || 'ArCa';
    await credit(s.uid, amount, 'topup', `Пополнение (${p})`);
    return ok({ balance: await getBalance(s.uid) });
  }
  return err('Неизвестное действие');
});
