import { db, userDb } from '../../../api/db';
import { getUser } from '../../users';
import { requireAuth } from '../../../api/auth/session';

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, coachName: me.name };
}

// Coach modifie les objectifs / permissions d'un athlète
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, goalKcal, goalProtein, goalCarbs, goalFat, note, selfNutritionAllowed, selfMuscuAllowed } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const udb = userDb(athleteId);
  const current = await udb.get('userSettings') || {};
  const updated = {
    ...current,
    ...(goalKcal    != null && { goalKcal:    Number(goalKcal) }),
    ...(goalProtein != null && { goalProtein: Number(goalProtein) }),
    ...(goalCarbs   != null && { goalCarbs:   Number(goalCarbs) }),
    ...(goalFat     != null && { goalFat:     Number(goalFat) }),
    ...(selfNutritionAllowed != null && { selfNutritionAllowed: Boolean(selfNutritionAllowed) }),
    ...(selfMuscuAllowed     != null && { selfMuscuAllowed:     Boolean(selfMuscuAllowed) }),
  };
  await udb.set('userSettings', updated);

  // Historique des objectifs
  const today = new Date().toISOString().slice(0, 10);
  const history = await udb.get('goalsHistory') || [];
  const snapshot = { date: today, goalKcal: updated.goalKcal, goalProtein: updated.goalProtein, goalCarbs: updated.goalCarbs, goalFat: updated.goalFat, setByCoach: true };
  await udb.set('goalsHistory', [snapshot, ...history.filter(s => s.date !== today)].slice(0, 24));

  // Notification pour l'athlète
  const notifs = await udb.get('coachNotifications') || [];
  const newNotif = {
    id: Date.now(),
    date: new Date().toISOString(),
    coachName: v.coachName,
    type: 'goals',
    read: false,
    goals: { goalKcal: updated.goalKcal, goalProtein: updated.goalProtein, goalCarbs: updated.goalCarbs, goalFat: updated.goalFat },
    note: note || null,
  };
  await udb.set('coachNotifications', [newNotif, ...notifs].slice(0, 20));

  // Push notification
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    await sendPushToUser(athleteId, `🎯 ${v.coachName}`, note ? note : 'Tes objectifs nutritionnels ont été mis à jour', '/');
  } catch {}

  return Response.json({ ok: true });
}

// Marquer les notifications comme lues
export async function PATCH(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', notifs.map(n => ({ ...n, read: true })));
  return Response.json({ ok: true });
}

// Récupérer les notifications (athlète)
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const notifs = await userDb(auth.userId).get('coachNotifications') || [];
  return Response.json({ notifications: notifs });
}
