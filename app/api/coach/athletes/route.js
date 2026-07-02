import { db, userDb } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';
import { sendCoachRemovalEmail } from '../../../lib/email';
import { sendExpoPushToUser } from '../../../lib/expoPush';
import { sendPushToUser } from '../../push/send/route';

const REMOVAL_TRIAL_MS = 7 * 24 * 3600 * 1000;

const TZ = 'Europe/Paris';
function localDate(d = new Date()) {
  return d.toLocaleDateString('fr-CA', { timeZone: TZ });
}
function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return localDate(d);
  });
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;

  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  const today = localDate();
  const last7 = getLastNDates(7);

  const athletes = await Promise.all(athleteIds.map(async id => {
    const user = users.find(u => u.id === id);
    if (!user) return null;
    const udb = userDb(id);

    const [settings, todayEntries, weightLog, stravaCache, bloodTests, reportRequest, pendingBlood, hc, mediaItems] = await Promise.all([
      udb.get('userSettings').then(s => s || {}),
      udb.get(`day:${today}`).then(e => e || []),
      udb.get('weightLog').then(w => (w || []).slice(-2)),
      udb.get('stravaCache').then(s => s || null),
      udb.get('bloodTests').then(b => b || []),
      udb.get('reportRequest'),
      udb.get('pendingBloodFiles'),
      udb.get('healthConnectData').then(h => h || null),
      udb.get('mediaItems').then(m => m || []),
    ]);

    const week = await Promise.all(last7.map(d => udb.get(`day:${d}`).then(e => e || [])));
    const activeDays = week.filter(d => d.length > 0);
    const avgKcal = activeDays.length > 0
      ? Math.round(activeDays.reduce((a, d) => a + d.reduce((s, e) => s + (e.kcal || 0), 0), 0) / activeDays.length)
      : 0;
    const avgProtein = activeDays.length > 0
      ? Math.round(activeDays.reduce((a, d) => a + d.reduce((s, e) => s + (e.protein || 0), 0), 0) / activeDays.length)
      : 0;

    const todayKcal = todayEntries.reduce((a, e) => a + (e.kcal || 0), 0);
    const goalKcal = settings.goalKcal || 2000;
    const goalProtein = settings.goalProtein || 150;

    // weightLog stocke `.value` (route /api/weight) ; tolère aussi `.weight` (anciennes entrées).
    const wval = e => e?.weight ?? e?.value ?? null;
    const weightTrend = weightLog.length >= 2
      ? Math.round((wval(weightLog[weightLog.length-1]) - wval(weightLog[0])) * 10) / 10
      : null;
    const lastWeight = weightLog.length > 0 ? wval(weightLog[weightLog.length-1]) : null;

    const alert = avgKcal > 0 && Math.abs(avgKcal - goalKcal) > goalKcal * 0.2
      ? (avgKcal < goalKcal ? 'sous-alimentation' : 'excès calorique')
      : null;

    // Dernier bilan sanguin — marqueurs anormaux uniquement
    const latestBlood = bloodTests[0] || null;
    const pendingBloodTest = bloodTests.find(b => b.pendingCoachValidation) || null;
    const bloodSummary = latestBlood ? {
      id: latestBlood.id,
      date: latestBlood.date || latestBlood.uploadedAt?.slice(0, 10),
      reportType: latestBlood.reportType,
      summary: latestBlood.summary,
      abnormal: (latestBlood.markers || []).filter(m => m.status !== 'ok').map(m => ({
        name: m.name, value: m.value, unit: m.unit, status: m.status,
      })),
      pendingCoachValidation: !!latestBlood.pendingCoachValidation,
    } : null;

    // Dernière activité Strava depuis le cache
    const stravaActivities = stravaCache?.activities || [];
    const lastActivity = stravaActivities.length > 0
      ? stravaActivities.sort((a, b) => b.date.localeCompare(a.date))[0]
      : null;
    const stravaCount7j = stravaActivities.filter(a => last7.includes(a.date)).length;

    return {
      id, name: user.name, email: user.email,
      mediaUnseen: mediaItems.filter(m => !m.viewedAt && !m.expired).length, // suivi photo/vidéo non encore visionné
      mode: settings.mode || null, // 'perte' | 'masse' | 'maintien' — pour la sémantique de la tendance poids
      todayKcal: Math.round(todayKcal), goalKcal,
      avgKcal7j: avgKcal, avgProtein7j: avgProtein, goalProtein,
      // Série kcal/jour des 7 derniers jours (ancien→récent) pour un graphe de tendance.
      kcalSeries: [...week].reverse().map(day => Math.round(day.reduce((s, e) => s + (e.kcal || 0), 0))),
      activeDays7j: activeDays.length,
      lastWeight, weightTrend,
      alert,
      recovery: hc ? {
        sleep: hc.avgSleep ?? null,
        sleepStages: hc.sleepStages ?? null,
        hrv: hc.hrv ?? null,
        restingHR: hc.restingHR ?? null,
        avgHR: hc.avgHR ?? null,
        maxHR: hc.maxHR ?? null,
        spo2: hc.spo2 ?? null,
        steps: hc.avgSteps ?? null,
        syncedAt: hc.syncedAt ?? null,
        flag:
          ((hc.hrv && hc.hrv < 25) || (hc.avgSleep && hc.avgSleep < 5.5)) ? 'low'
          : ((hc.hrv && hc.hrv < 40) || (hc.avgSleep && hc.avgSleep < 6.5) || (hc.restingHR && hc.restingHR > 75)) ? 'warn'
          : 'ok',
      } : null,
      strava: {
        lastActivity, count7j: stravaCount7j, updatedAt: stravaCache?.updatedAt || null,
        // Liste des séances riches sur 7j (FC/effort/allure/dénivelé…) pour le détail coach.
        sessions: [...stravaActivities].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20),
      },
      blood: bloodSummary,
      reportRequest: reportRequest || null,
      pendingBlood: pendingBlood ? { sentAt: pendingBlood.sentAt, count: pendingBlood.files.length } : null,
      todayJournal: todayEntries.map(e => ({ name: e.name, meal: e.meal, kcal: e.kcal||0, protein: e.protein||0, carbs: e.carbs||0, fat: e.fat||0 })),
      selfNutritionAllowed: settings.selfNutritionAllowed !== false,
      selfMuscuAllowed: settings.selfMuscuAllowed !== false,
    };
  }));

  let inviteCode = await db.get(`coach:code:${auth.userId}`);
  if (!inviteCode) {
    // Génère un code court permanent (6 chars alphanumériques sans ambiguïté)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await db.set(`coach:code:${auth.userId}`, inviteCode);
    // Enregistre aussi dans le lookup de link.js (fallback existant)
    await db.set(`coach:invite:${inviteCode}`, auth.userId);
  }
  return Response.json({ athletes: athletes.filter(Boolean), inviteCode });
}

// Coach retire un athlète de sa liste
export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const { athleteId } = await req.json();
  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  await db.set(`coach:${auth.userId}:athletes`, athleteIds.filter(id => id !== athleteId));
  await userDb(athleteId).set('coachId', null);

  const athlete = users.find(u => u.id === athleteId);
  if (athlete) {
    // L'élève perd l'accès Pro lié au coach → on lui (re)donne 7 jours d'essai Pro
    // pour ne pas couper net, et on l'invite à s'abonner.
    const trialEndsAt = Date.now() + REMOVAL_TRIAL_MS;
    const updatedUsers = users.map(u => u.id === athleteId ? { ...u, trialEndsAt } : u);
    await db.set('auth:users', updatedUsers);

    const adb = userDb(athleteId);
    const notifs = await adb.get('coachNotifications') || [];
    await adb.set('coachNotifications', [
      { id: Date.now(), date: new Date().toISOString(), type: 'coach_removed', read: false, trialEndsAt },
      ...notifs,
    ].slice(0, 20));

    sendCoachRemovalEmail(athlete.email, athlete.name, me.name).catch(() => {});
    const title = '🎁 7 jours Pro offerts';
    const body = "Ton suivi coach a pris fin — profite de 7 jours Pro, puis abonne-toi pour garder toutes les fonctionnalités.";
    sendPushToUser(athleteId, title, body, '/?paywall=1').catch(() => {});
    sendExpoPushToUser(athleteId, title, body, { type: 'coach_removed' });
  }

  return Response.json({ ok: true });
}
