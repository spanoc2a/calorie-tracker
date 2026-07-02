import { db, userDb } from '../../db';

// Diag ONE-SHOT v2 (2026-07-03) : contenu du cache Strava après la reconnexion
// de l'utilisateur — lecture seule, à SUPPRIMER après usage.
const ONE_SHOT_TOKEN = '076bef164c330ed952035cc73f71426c8465a1fca1630fad';

export async function POST(req) {
  const authz = req.headers.get('authorization') || '';
  if (authz !== `Bearer ${ONE_SHOT_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { email, all } = await req.json().catch(() => ({}));
  if (all) {
    const { listUsers } = await import('../../users');
    const users = await listUsers();
    const rows = [];
    for (const u of users) {
      const [tok, cache] = await Promise.all([
        userDb(u.id).get('strava:token'),
        userDb(u.id).get('stravaCache'),
      ]);
      rows.push({
        email: u.email,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : null,
        hasToken: !!tok,
        athleteId: tok?.athlete?.id ?? null,
        cacheUpdatedAt: cache?.updatedAt || null,
      });
    }
    rows.sort((a, b) => String(b.cacheUpdatedAt || '').localeCompare(String(a.cacheUpdatedAt || '')));
    return Response.json({ users: rows });
  }
  const id = await db.get(`useremail:${String(email || '').toLowerCase().trim()}`);
  if (!id) return Response.json({ found: false });

  const cache = await userDb(id).get('stravaCache');
  const token = await userDb(id).get('strava:token');

  // Test direct de l'API Strava avec le token stocké : statut + quotas app
  // (X-RateLimit-*). Lecture seule, 1 seul appel léger.
  let apiTest = null;
  if (token?.access_token) {
    try {
      const r = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=1', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const body = await r.json().catch(() => null);
      // /athlete (scope profile) vs /athlete/activities (scope activity:read) :
      // si le profil passe mais pas les activités → scope manquant, pas de suspension.
      const rp = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      apiTest = {
        athleteStatus: rp.status,
        status: r.status,
        rateUsage: r.headers.get('x-ratelimit-usage'),
        rateLimit: r.headers.get('x-ratelimit-limit'),
        readUsage: r.headers.get('x-readratelimit-usage'),
        readLimit: r.headers.get('x-readratelimit-limit'),
        sample: Array.isArray(body) && body[0] ? { date: body[0].start_date_local, name: body[0].name } : (body?.message || null),
      };
    } catch (e) {
      apiTest = { status: 0, error: e.message };
    }
  }
  return Response.json({
    apiTest,
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
