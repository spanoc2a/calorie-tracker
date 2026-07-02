import { db, userDb } from '../../db';

// Diagnostic ONE-SHOT (2026-07-03) : état du token Strava d'un compte, LECTURE SEULE
// (le refresh est testé sans jamais écrire — contrairement à getToken qui efface le
// token sur 400/401). Aucune valeur de token exposée, uniquement des métadonnées.
// Route à SUPPRIMER après exécution.
const ONE_SHOT_TOKEN = 'a240feb665704116bf1f177aa2ae6c30eec357e75f1fbdf0';

export async function POST(req) {
  const authz = req.headers.get('authorization') || '';
  if (authz !== `Bearer ${ONE_SHOT_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { email } = await req.json().catch(() => ({}));
  const id = await db.get(`useremail:${String(email || '').toLowerCase().trim()}`);
  if (!id) return Response.json({ found: false });

  const token = await userDb(id).get('strava:token');
  const out = {
    found: true,
    hasToken: !!token,
    expiresAt: token?.expires_at ? new Date(token.expires_at * 1000).toISOString() : null,
    expired: token?.expires_at ? Date.now() / 1000 >= token.expires_at - 300 : null,
    hasRefreshToken: !!token?.refresh_token,
    athleteId: token?.athlete?.id ?? null,
    envClientId: !!process.env.STRAVA_CLIENT_ID,
    envClientSecret: !!process.env.STRAVA_CLIENT_SECRET,
  };

  // Test de refresh NON destructif (aucune écriture KV, quel que soit le résultat).
  if (token?.refresh_token) {
    try {
      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: parseInt(process.env.STRAVA_CLIENT_ID),
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const data = await res.json().catch(() => ({}));
      out.refreshTest = { status: res.status, ok: res.ok, message: res.ok ? 'ok' : (data.message || 'échec') };
    } catch (e) {
      out.refreshTest = { status: 0, ok: false, message: 'réseau: ' + e.message };
    }
  }

  // Cache d'activités : dernière synchro connue.
  const cache = await userDb(id).get('stravaCache');
  out.cache = cache ? { updatedAt: cache.updatedAt || null, activities: (cache.activities || []).length } : null;

  return Response.json(out);
}
