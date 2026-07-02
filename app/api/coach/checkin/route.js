import { db, userDb } from '../../db';
import { requireAuth } from '../../auth/session';

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, users };
}

// Récupérer les check-ins d'un athlète lié au coach
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const checkins = await userDb(athleteId).get('checkins') || [];
  return Response.json({ checkins });
}
