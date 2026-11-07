/**
 * SMS sending. Without provider keys the app runs in demo mode:
 * the code is returned to the browser and shown on screen.
 * Supported: Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
 */
export const smsEnabled = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

export async function sendSms(to: string, text: string) {
  if (!smsEnabled) return { demo: true };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: text }),
  });
  if (!res.ok) throw new Error('Не удалось отправить SMS');
  return { demo: false };
}
