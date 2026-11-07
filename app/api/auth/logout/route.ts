import { clearSession } from '@/lib/auth';
import { handler, ok } from '@/lib/http';

export const POST = handler(async () => {
  await clearSession();
  return ok();
});
