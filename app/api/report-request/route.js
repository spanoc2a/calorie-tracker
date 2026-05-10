import { userDb, db } from '../db';
import { requireAuth } from '../auth/session';

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  await udb.set('reportRequest', { requestedAt: new Date().toISOString() });

  // Push au coach
  try {
    const coachId = await udb.get('coachId');
    if (coachId) {
      const users = await db.get('auth:users') || [];
      const athlete = users.find(u => u.id === auth.userId);
      const { sendPushToUser } = await import('../push/send/route');
      await sendPushToUser(coachId, `📄 Demande de bilan`, `${athlete?.name || 'Un patient'} demande un rapport nutritionnel`, '/coach');
    }
  } catch {}

  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { athleteId } = await req.json();
  await userDb(athleteId).set('reportRequest', null);
  return Response.json({ ok: true });
}
