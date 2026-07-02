import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ connected: false }, { status: 401 });

  const tokenData = await userDb(auth.userId).get('strava:token');
  if (!tokenData) return Response.json({ connected: false });

  return Response.json({
    connected: true,
    athleteName: tokenData.athlete?.name || null,
    athleteAvatar: tokenData.athlete?.avatar || null,
  });
}
