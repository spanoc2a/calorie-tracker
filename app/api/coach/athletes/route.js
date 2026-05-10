import { db, userDb } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';
import { sendCoachRemovalEmail } from '../../../lib/email';

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

    const [settings, todayEntries, weightLog, stravaCache, bloodTests, reportRequest, pendingBlood] = await Promise.all([
      udb.get('userSettings').then(s => s || {}),
      udb.get(`day:${today}`).then(e => e || []),
      udb.get('weightLog').then(w => (w || []).slice(-2)),
      udb.get('stravaCache').then(s => s || null),
      udb.get('bloodTests').then(b => b || []),
      udb.get('reportRequest'),
      udb.get('pendingBloodFiles'),
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

    const weightTrend = weightLog.length >= 2
      ? Math.round((weightLog[weightLog.length-1].weight - weightLog[0].weight) * 10) / 10
      : null;
    const lastWeight = weightLog.length > 0 ? weightLog[weightLog.length-1].weight : null;

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
      todayKcal: Math.round(todayKcal), goalKcal,
      avgKcal7j: avgKcal, avgProtein7j: avgProtein, goalProtein,
      activeDays7j: activeDays.length,
      lastWeight, weightTrend,
      alert,
      strava: { lastActivity, count7j: stravaCount7j, updatedAt: stravaCache?.updatedAt || null },
      blood: bloodSummary,
      reportRequest: reportRequest || null,
      pendingBlood: pendingBlood ? { sentAt: pendingBlood.sentAt, count: pendingBlood.files.length } : null,
      todayJournal: todayEntries.map(e => ({ name: e.name, meal: e.meal, kcal: e.kcal||0, protein: e.protein||0, carbs: e.carbs||0, fat: e.fat||0 })),
      selfNutritionAllowed: settings.selfNutritionAllowed !== false,
      selfMuscuAllowed: settings.selfMuscuAllowed !== false,
    };
  }));

  const inviteCode = await db.get(`coach:code:${auth.userId}`) || '';
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
  if (athlete) sendCoachRemovalEmail(athlete.email, athlete.name, me.name).catch(() => {});

  return Response.json({ ok: true });
}
