import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ connected: false }, { status: 401 });

  const tokenData = await userDb(auth.userId).get('strava:token');
  if (!tokenData) return Response.json({ connected: false });

  // Sonde légère : détecte un blocage côté Strava (403 = app suspendue / quota
  // athlètes — vu le 2026-07-03) pour que le Profil affiche un état honnête au
  // lieu de « connecté » avec zéro donnée. Best-effort : en cas d'échec réseau,
  // on ne conclut rien.
  let unavailable = false;
  if (tokenData.access_token && Date.now() / 1000 < (tokenData.expires_at || 0)) {
    try {
      const probe = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (probe.status === 403) unavailable = true;
    } catch {}
  }

  return Response.json({
    connected: true,
    unavailable,
    athleteName: tokenData.athlete?.name || null,
    athleteAvatar: tokenData.athlete?.avatar || null,
  });
}
