import webpush from 'web-push';
import { q } from './db';

export const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
let configured = false;

function setup() {
  if (configured || !VAPID_PUBLIC || !VAPID_PRIVATE) return configured;
  webpush.setVapidDetails('mailto:support@greendrop.app', VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

async function sendTo(rows: any[], payload: PushPayload) {
  if (!setup() || !rows.length) return;
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(r.data, JSON.stringify(payload), { TTL: 3600 });
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await q(`DELETE FROM push_subs WHERE endpoint=$1`, [r.endpoint]).catch(() => {});
        }
      }
    })
  );
}

export async function pushToUser(userId: string | null | undefined, payload: PushPayload) {
  if (!userId) return;
  try {
    await sendTo(await q(`SELECT * FROM push_subs WHERE user_id=$1`, [userId]), payload);
  } catch (e) {
    console.error('push failed', e);
  }
}

export async function pushToRole(role: string, payload: PushPayload) {
  try {
    const rows = await q(
      role === 'worker'
        ? `SELECT p.* FROM push_subs p JOIN users u ON u.id=p.user_id WHERE p.role='worker' AND u.active`
        : `SELECT * FROM push_subs WHERE role=$1`,
      role === 'worker' ? [] : [role]
    );
    await sendTo(rows, payload);
  } catch (e) {
    console.error('push failed', e);
  }
}
