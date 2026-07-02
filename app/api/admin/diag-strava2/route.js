import { db, userDb } from '../../db';

// Diag ONE-SHOT v2 (2026-07-03) : contenu du cache Strava après la reconnexion
// de l'utilisateur — lecture seule, à SUPPRIMER après usage.
const ONE_SHOT_TOKEN = '076bef164c330ed952035cc73f71426c8465a1fca1630fad';

export async function POST(req) {
  const authz = req.headers.get('authorization') || '';
  if (authz !== `Bearer ${ONE_SHOT_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { email } = await req.json().catch(() => ({}));
  const id = await db.get(`useremail:${String(email || '').toLowerCase().trim()}`);
  if (!id) return Response.json({ found: false });

  const cache = await userDb(id).get('stravaCache');
  const token = await userDb(id).get('strava:token');
  return Response.json({
    hasToken: !!token,
    updatedAt: cache?.updatedAt || null,
    count: (cache?.activities || []).length,
    activities: (cache?.activities || []).slice(0, 10).map(a => ({
      date: a.date, type: a.type || a.typeLabel, name: a.name,
      durationMin: a.durationMin ?? Math.round((a.duration || 0) / 60),
      distance: a.distance, calories: a.calories, caloriesAdjusted: a.caloriesAdjusted,
      avg_hr: a.avg_hr, suffer: a.suffer_score,
    })),
  });
}
