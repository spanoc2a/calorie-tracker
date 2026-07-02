import { db, userDb } from '../db';
import { requireAuth } from '../auth/session';

// Lecture, côté ATHLÈTE, des commentaires de journal laissés par son coach.
// (La route /api/coach/journal-comment est réservée au coach pour l'écriture.)
// Clé de stockage : journalComment:<coachId>:<athleteId>:<date>.
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const coachId = await userDb(auth.userId).get('coachId');
  if (!coachId) return Response.json({ comment: null });

  const comment = await db.get(`journalComment:${coachId}:${auth.userId}:${date}`) || null;
  return Response.json({ comment });
}
