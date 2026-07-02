import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

// Renvoie l'historique complet des séances de muscu par exercice.
// Shape attendue par le mobile (vue perf) :
// { exercises: { [exerciseName]: [ { date, sets } ] } } trié par date croissante.
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const all = await userDb(auth.userId).get('muscuSets') || {};

  const exercises = {};
  for (const [exercise, byDate] of Object.entries(all)) {
    if (!byDate || typeof byDate !== 'object') continue;
    exercises[exercise] = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, sets]) => ({ date, sets: Array.isArray(sets) ? sets : [] }));
  }

  return Response.json({ exercises });
}
