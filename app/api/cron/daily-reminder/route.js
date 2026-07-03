import { userDb } from '../../db';
import { runBatchedCron } from '../../../lib/cronBatch';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';
import { sendTrialEndingEmail } from '../../../lib/email';
import { getUserLang, normalizeLang } from '../../../lib/lang';
import { pushText } from '../../../lib/pushTexts';

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

// Jours 1-3 sans log : 5 messages variés (pushTexts reminder_early_*), rotation
// déterministe par jour du mois, dans la langue du destinataire.
const EARLY_COUNT = 5;

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

// Série de jours consécutifs loggés se terminant HIER (hier inclus). Cap à 60 jours,
// scan par paquets de 10 en remontant — appelé uniquement quand on sait que hier est loggé.
const STREAK_CAP = 60;
async function streakEndingYesterday(udb) {
  let streak = 0;
  for (let start = 1; start <= STREAK_CAP; start += 10) {
    const size = Math.min(10, STREAK_CAP - start + 1);
    const batch = await Promise.all(
      Array.from({ length: size }, (_, i) => udb.get(`day:${dateKeyDaysAgo(start + i)}`))
    );
    for (const entries of batch) {
      if (Array.isArray(entries) && entries.length > 0) streak++;
      else return streak;
    }
  }
  return streak;
}

// J7 exactement : alerte le coach (push web + Expo + notif in-app) si l'élève est coaché.
async function notifyCoachInactive(user) {
  const coachId = await userDb(user.id).get('coachId');
  if (!coachId) return;

  // Langue du DESTINATAIRE du push = le coach.
  const coachLang = await getUserLang(coachId);
  const prenom = (user.name || 'Ton élève').trim().split(/\s+/)[0];
  const title = pushText(coachLang, 'inactive_athlete_title', { prenom });
  const body = pushText(coachLang, 'inactive_athlete_body');

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
  const now = Date.now();

  // Un seul passage batché sur TOUS les users : (1) email fin de trial (pas de KV),
  // (2) rappel de log pour les non-coachs.
  return runBatchedCron(req, 'daily-reminder', {
    batch: 100,
    chunk: 10,
    handler: async (user) => {
      // Rappels fin de trial (1 jour et 2 jours avant expiration)
      if (user.trialEndsAt && (!user.plan || user.plan === 'free')) {
        const daysLeft = Math.ceil((user.trialEndsAt - now) / (24 * 3600 * 1000));
        if (daysLeft === 1 || daysLeft === 2) {
          sendTrialEndingEmail(user.email, user.name, daysLeft).catch(() => {});
        }
      }

      if (user.role === 'coach') return false;

      const udb = userDb(user.id);
      const [sub, expoToken, todayEntries, settings] = await Promise.all([
        udb.get('pushSubscription'),
        udb.get('expoPushToken'),
        udb.get(`day:${today}`),
        udb.get('userSettings'),
      ]);

      // Aucun canal de notification : on saute.
      if (!sub?.endpoint && !expoToken) return false;

      // A loggé aujourd'hui : rien à relancer.
      if (Array.isArray(todayEntries) && todayEntries.length > 0) return false;

      const days = await daysSinceLastLog(udb);
      if (days === null) return false; // inactif > 21 jours : on arrête les rappels

      // J7 exactement : en plus du rappel, on alerte le coach si l'élève est coaché.
      if (days === 7) {
        try { await notifyCoachInactive(user); } catch {}
      }

      // Au-delà de 14 jours : plus de rappel quotidien, seulement 1 rappel hebdomadaire.
      if (days > 14 && days % 7 !== 0) return false;

      // Streak en danger : a loggé hier mais pas encore aujourd'hui, avec une série ≥ 3 jours
      // → message dédié qui remplace le rappel générique.
      let streak = 0;
      if (days === 1) {
        try { streak = await streakEndingYesterday(udb); } catch {}
      }

      // Langue du destinataire (settings déjà chargés — pas de lecture supplémentaire).
      const lang = normalizeLang(settings?.lang) || 'fr';

      let title, bodyText;
      if (days === 1 && streak >= 3) {
        title = pushText(lang, 'reminder_streak_title', { streak });
        bodyText = pushText(lang, 'reminder_streak_body');
      } else if (days <= 3) {
        const idx = ((new Date().getDate() + days) % EARLY_COUNT) + 1;
        title = pushText(lang, `reminder_early_${idx}_title`);
        bodyText = pushText(lang, `reminder_early_${idx}_body`);
      } else {
        title = pushText(lang, 'reminder_late_title', { days });
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
            ? pushText(lang, 'reminder_goal_left_body', { remaining: restant, goalWeight })
            : pushText(lang, 'reminder_goal_reached_body', { goalWeight });
        } else {
          bodyText = pushText(lang, 'reminder_generic_body');
        }
      }

      // Envoie sur les DEUX canaux disponibles (web + Expo mobile).
      // categoryId 'log-meal' : catégorie d'actions rapides côté app (logger direct depuis la notif).
      if (sub?.endpoint) await sendPushToUser(user.id, title, bodyText, '/');
      if (expoToken) await sendExpoPushToUser(user.id, title, bodyText, { type: 'reminder' }, { categoryId: 'log-meal' });
      return true;
    },
  });
}
