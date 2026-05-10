import webpush from 'web-push';
import { userDb } from '../../db';

function getWebPush() {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return null;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@nutritracker.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return webpush;
}

export async function sendPushToUser(userId, title, body, url = '/') {
  try {
    const wp = getWebPush();
    if (!wp) return;
    const sub = await userDb(userId).get('pushSubscription');
    if (!sub?.endpoint) return;
    await wp.sendNotification(sub, JSON.stringify({ title, body, url }));
  } catch (e) {
    if (e?.statusCode === 410 || e?.statusCode === 404) {
      await userDb(userId).set('pushSubscription', null);
    }
  }
}

// Route interne — protégée par CRON_SECRET
export async function POST(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { userId, title, body, url } = await req.json();
  if (!userId || !title) return Response.json({ error: 'Paramètres manquants' }, { status: 400 });
  await sendPushToUser(userId, title, body, url);
  return Response.json({ ok: true });
}
