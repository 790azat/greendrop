import webpush from 'web-push';
import { q } from './db';
import { Lang, isLang, tr } from './i18n';

export const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
let configured = false;

function setup() {
  if (configured || !VAPID_PUBLIC || !VAPID_PRIVATE) return configured;
  webpush.setVapidDetails('mailto:support@greendrop.app', VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

type Text = string | ((lang: Lang) => string);
/** title/body are Russian source strings (translated per user) or functions of the language */
export type PushPayload = { title: Text; body: Text; url?: string; tag?: string };

const render = (x: Text, lang: Lang) => (typeof x === 'function' ? x(lang) : tr(lang, x));

async function sendTo(rows: any[], payload: PushPayload) {
  if (!setup() || !rows.length) return;
  await Promise.all(
    rows.map(async (r) => {
      try {
        const lang: Lang = isLang(r.lang) ? r.lang : 'ru';
        const msg = { ...payload, title: render(payload.title, lang), body: render(payload.body, lang) };
        await webpush.sendNotification(r.data, JSON.stringify(msg), { TTL: 3600 });
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
    await sendTo(await q(`SELECT p.*, u.data->>'lang' AS lang FROM push_subs p LEFT JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`, [userId]), payload);
  } catch (e) {
    console.error('push failed', e);
  }
}

export async function pushToRole(role: string, payload: PushPayload) {
  try {
    const rows = await q(
      role === 'worker'
        ? `SELECT p.*, u.data->>'lang' AS lang FROM push_subs p JOIN users u ON u.id=p.user_id WHERE p.role='worker' AND u.active`
        : `SELECT p.*, u.data->>'lang' AS lang FROM push_subs p LEFT JOIN users u ON u.id=p.user_id WHERE p.role=$1`,
      role === 'worker' ? [] : [role]
    );
    await sendTo(rows, payload);
  } catch (e) {
    console.error('push failed', e);
  }
}
