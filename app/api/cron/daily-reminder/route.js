import { db, userDb } from '../../db';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';
import { sendTrialEndingEmail } from '../../../lib/email';

export const maxDuration = 60;

function parisDateKey() {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const today = parisDateKey();
  const users = await db.get('auth:users') || [];

  // Rappels fin de trial (1 jour et 2 jours avant expiration)
  const now = Date.now();
  for (const u of users) {
    if (!u.trialEndsAt || (u.plan && u.plan !== 'free')) continue;
    const daysLeft = Math.ceil((u.trialEndsAt - now) / (24 * 3600 * 1000));
    if (daysLeft === 1 || daysLeft === 2) {
      sendTrialEndingEmail(u.email, u.name, daysLeft).catch(() => {});
    }
  }

  const athletes = users.filter(u => u.role !== 'coach');

  let sent = 0, skipped = 0;

  const title = '🥗 Tu n\'as pas encore loggé aujourd\'hui';
  const bodyText = 'Quelques secondes suffisent pour rester dans le suivi.';

  for (const user of athletes) {
    try {
      const udb = userDb(user.id);
      const [sub, expoToken] = await Promise.all([
        udb.get('pushSubscription'),
        udb.get('expoPushToken'),
      ]);

      // Aucun canal de notification : on saute.
      if (!sub?.endpoint && !expoToken) { skipped++; continue; }

      const entries = await udb.get(`day:${today}`) || [];
      if (entries.length > 0) { skipped++; continue; }

      // Envoie sur les DEUX canaux disponibles (web + Expo mobile).
      if (sub?.endpoint) await sendPushToUser(user.id, title, bodyText, '/');
      if (expoToken) await sendExpoPushToUser(user.id, title, bodyText, { type: 'reminder' });
      sent++;
    } catch { skipped++; }
  }

  return Response.json({ ok: true, sent, skipped });
}
