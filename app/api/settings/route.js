import { db, userDb } from '../db';
import { requireAuth } from '../auth/session';

const DEFAULTS = {
  goalKcal: 2000, goalProtein: 150, goalCarbs: 250, goalFat: 70,
  reminderEnabled: false, reminderTime: '12:00',
  selfNutritionAllowed: true, selfMuscuAllowed: true,
};

function goalsChanged(prev, next) {
  return ['goalKcal','goalProtein','goalCarbs','goalFat'].some(k => String(prev[k]||'') !== String(next[k]||''));
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const [settings, coachId] = await Promise.all([
    udb.get('userSettings').then(s => s || {}),
    udb.get('coachId'),
  ]);
  // Nom du coach (pour l'en-tête de la messagerie athlète) — lookup seulement si rattaché.
  let coachName = null;
  if (coachId) {
    const users = await db.get('auth:users') || [];
    coachName = users.find(u => u.id === coachId)?.name || null;
  }
  return Response.json({ settings: { ...DEFAULTS, ...settings, coachId: coachId || null, coachName } });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const body = await req.json();
  const current = await udb.get('userSettings') || {};
  const updated = { ...DEFAULTS, ...current, ...body };
  await udb.set('userSettings', updated);

  if (goalsChanged(current, updated)) {
    const history = await udb.get('goalsHistory') || [];
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = { date: today, goalKcal: updated.goalKcal, goalProtein: updated.goalProtein, goalCarbs: updated.goalCarbs, goalFat: updated.goalFat, weight: updated.weight || null };
    const filtered = history.filter(s => s.date !== today);
    await udb.set('goalsHistory', [snapshot, ...filtered].slice(0, 24));
  }

  return Response.json({ settings: updated });
}
