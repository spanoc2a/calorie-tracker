import { requireAuth } from '../auth/session';
import { db, userDb } from '../db';
import { getUser } from '../users';

function lastMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Récupérer les check-ins + semaine en attente
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const checkins = await userDb(auth.userId).get('checkins') || [];
  const week = lastMonday();
  const pendingWeek = checkins.some(c => c.weekDate === week) ? null : week;
  return Response.json({ checkins, pendingWeek });
}

// Soumettre un check-in hebdomadaire
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { weekDate, mood, energy, sleep, weight, notes } = await req.json();
  if (!weekDate) return Response.json({ error: 'weekDate requis' }, { status: 400 });

  const checkin = { id: Date.now(), weekDate, mood, energy, sleep, weight, notes, submittedAt: new Date().toISOString() };
  const existing = await userDb(auth.userId).get('checkins') || [];
  const updated = [checkin, ...existing].slice(0, 52);
  await userDb(auth.userId).set('checkins', updated);

  // Notifier le coach (web + Expo) — non bloquant.
  try {
    const coachId = await userDb(auth.userId).get('coachId');
    if (coachId) {
      const athlete = await getUser(auth.userId);
      const name = athlete?.name || 'Un élève';
      const { sendPushToUser } = await import('../push/send/route');
      const { sendExpoPushToUser } = await import('../../lib/expoPush');
      await Promise.all([
        sendPushToUser(coachId, '✅ Check-in reçu', `${name} a fait son check-in`, '/coach'),
        sendExpoPushToUser(coachId, '✅ Check-in reçu', `${name} a fait son check-in`, { type: 'checkin_coach', athleteId: auth.userId }),
      ]);
    }
  } catch {}

  return Response.json({ ok: true });
}
