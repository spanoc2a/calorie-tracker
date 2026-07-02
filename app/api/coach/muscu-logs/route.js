import { db, userDb } from '../../db';
import { requireAuth } from '../../auth/session';

// Logs de musculation réellement enregistrés par l'athlète, vus par le coach.
// Stockage athlète : muscuSets = { exerciseName: { 'YYYY-MM-DD': [{weight, reps}] } }.
// On agrège en séances (par date, la plus récente d'abord).
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  const days = Math.min(Number(searchParams.get('days')) || 30, 90);
  if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });

  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const muscuSets = await userDb(athleteId).get('muscuSets') || {};
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  // date -> { exercise -> sets[] }
  const byDate = {};
  for (const [exercise, dateMap] of Object.entries(muscuSets || {})) {
    for (const [date, sets] of Object.entries(dateMap || {})) {
      if (date < sinceStr) continue;
      if (!Array.isArray(sets) || sets.length === 0) continue;
      (byDate[date] ||= {})[exercise] = sets;
    }
  }

  const sessions = Object.entries(byDate)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // plus récent d'abord
    .map(([date, exMap]) => {
      const exercises = Object.entries(exMap).map(([name, sets]) => {
        const volume = sets.reduce((v, s) => v + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
        const topWeight = sets.reduce((m, s) => Math.max(m, Number(s.weight) || 0), 0);
        return {
          name,
          sets: sets.map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
          volume,
          topWeight,
        };
      });
      const totalVolume = exercises.reduce((v, e) => v + e.volume, 0);
      return { date, exercises, totalSets: exercises.reduce((n, e) => n + e.sets.length, 0), totalVolume };
    });

  return Response.json({ sessions });
}
