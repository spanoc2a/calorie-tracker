import { db, userDb } from '../../db';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';
import { sendTrialEndingEmail } from '../../../lib/email';

export const maxDuration = 300;

function parisDateKey(d = new Date()) {
  return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

function dateKeyDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return parisDateKey(d);
}

// Au-delà de cette fenêtre sans log, on considère l'utilisateur parti : plus de rappel
// (évite de spammer indéfiniment un compte abandonné). Couvre le rappel hebdo J+21.
const MAX_LOOKBACK = 21;

// Jours 1-3 sans log : messages variés, rotation déterministe par jour du mois.
const EARLY_MESSAGES = [
  { title: '🥗 Ton journal t\'attend', body: 'Quelques secondes suffisent pour logger ta journée. On s\'y remet ?' },
  { title: '👋 Petit coucou de ton suivi', body: 'Un repas loggé, c\'est déjà une victoire. Lance-toi !' },
  { title: '📒 On reprend le fil ?', body: 'Ajoute ton dernier repas, ça prend moins de 30 secondes.' },
  { title: '🌟 Ta régularité fait la différence', body: 'Logger aujourd\'hui, c\'est garder ton élan. Tu gères !' },
  { title: '🍽 Un repas à noter ?', body: 'Ton journal est tout prêt — quelques secondes et c\'est fait.' },
];

// Nombre de jours depuis le dernier day:<date> non vide (hier = 1). null si rien sur MAX_LOOKBACK jours.
// Scan par paquets de 7 (récents d'abord) pour limiter les requêtes dans le cas courant.
async function daysSinceLastLog(udb) {
  for (let start = 1; start <= MAX_LOOKBACK; start += 7) {
    const size = Math.min(7, MAX_LOOKBACK - start + 1);
    const batch = await Promise.all(
      Array.from({ length: size }, (_, i) => udb.get(`day:${dateKeyDaysAgo(start + i)}`))
    );
    const idx = batch.findIndex(e => Array.isArray(e) && e.length > 0);
    if (idx !== -1) return start + idx;
  }
  return null;
}

// J7 exactement : alerte le coach (push web + Expo + notif in-app) si l'élève est coaché.
async function notifyCoachInactive(user) {
  const coachId = await userDb(user.id).get('coachId');
  if (!coachId) return;

  const prenom = (user.name || 'Ton élève').trim().split(/\s+/)[0];
  const title = `${prenom} n'a rien loggé depuis 7 jours`;
  const body = 'Un message de ta part peut relancer son suivi.';

  await Promise.all([
    sendPushToUser(coachId, title, body, '/coach').catch(() => {}),
    sendExpoPushToUser(coachId, title, body, { type: 'inactive_athlete', athleteId: user.id }),
  ]);

  const cdb = userDb(coachId);
  const notifs = await cdb.get('coachNotifications') || [];
  await cdb.set('coachNotifications', [
    { id: Date.now(), date: new Date().toISOString(), type: 'inactive_athlete', athleteId: user.id, athleteName: user.name || null, read: false },
    ...notifs,
  ].slice(0, 20));
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

  let sent = 0, skipped = 0, coachAlerts = 0;

  for (const user of athletes) {
    try {
      const udb = userDb(user.id);
      const [sub, expoToken, todayEntries, settings] = await Promise.all([
        udb.get('pushSubscription'),
        udb.get('expoPushToken'),
        udb.get(`day:${today}`),
        udb.get('userSettings'),
      ]);

      // Aucun canal de notification : on saute.
      if (!sub?.endpoint && !expoToken) { skipped++; continue; }

      // A loggé aujourd'hui : rien à relancer.
      if (Array.isArray(todayEntries) && todayEntries.length > 0) { skipped++; continue; }

      const days = await daysSinceLastLog(udb);
      if (days === null) { skipped++; continue; } // inactif > 21 jours : on arrête les rappels

      // J7 exactement : en plus du rappel, on alerte le coach si l'élève est coaché.
      if (days === 7) {
        try { await notifyCoachInactive(user); coachAlerts++; } catch {}
      }

      // Au-delà de 14 jours : plus de rappel quotidien, seulement 1 rappel hebdomadaire.
      if (days > 14 && days % 7 !== 0) { skipped++; continue; }

      let title, bodyText;
      if (days <= 3) {
        const msg = EARLY_MESSAGES[(new Date().getDate() + days) % EARLY_MESSAGES.length];
        title = msg.title;
        bodyText = msg.body;
      } else {
        title = `🥗 ${days} jours sans log — on s'y remet ?`;
        const goalWeight = Number(settings?.goalWeight) || null;
        let lastWeight = Number(settings?.weight) || null;
        if (goalWeight) {
          // Poids le plus récent du journal si dispo (plus fiable que le poids de référence).
          const weightLog = await udb.get('weightLog') || [];
          const lastEntry = weightLog[weightLog.length - 1];
          const w = Number(lastEntry?.value ?? lastEntry?.weight);
          if (isFinite(w) && w > 0) lastWeight = w;
        }
        if (goalWeight && lastWeight) {
          const restant = Math.round(Math.abs(lastWeight - goalWeight) * 10) / 10;
          bodyText = restant > 0
            ? `Il te reste ${restant} kg vers ton objectif de ${goalWeight} kg. Chaque jour loggé te rapproche !`
            : `Tu étais à ton objectif de ${goalWeight} kg — reviens logger pour le garder !`;
        } else {
          bodyText = 'Reviens logger un repas, ton suivi reprend là où tu l\'as laissé.';
        }
      }

      // Envoie sur les DEUX canaux disponibles (web + Expo mobile).
      if (sub?.endpoint) await sendPushToUser(user.id, title, bodyText, '/');
      if (expoToken) await sendExpoPushToUser(user.id, title, bodyText, { type: 'reminder' });
      sent++;
    } catch { skipped++; }
  }

  return Response.json({ ok: true, sent, skipped, coachAlerts });
}
