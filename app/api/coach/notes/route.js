import { db, userDb } from '../../../api/db';
import { getUser } from '../../users';
import { requireAuth } from '../../../api/auth/session';

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId };
}

// GET notes pour un patient
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const notes = await db.get(`coach:notes:${v.coachId}:${athleteId}`) || '';
  return Response.json({ notes });
}

// POST sauvegarder notes
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, notes } = await req.json();
  if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Accès refusé' }, { status: 403 });

  await db.set(`coach:notes:${v.coachId}:${athleteId}`, (notes || '').slice(0, 5000));
  return Response.json({ ok: true });
}
