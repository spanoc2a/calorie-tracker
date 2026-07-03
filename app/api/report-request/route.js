import { userDb, db } from '../db';
import { getUser } from '../users';
import { requireAuth } from '../auth/session';

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  await udb.set('reportRequest', { requestedAt: new Date().toISOString() });

  // Push au coach
  try {
    const coachId = await udb.get('coachId');
    if (coachId) {
      const athlete = await getUser(auth.userId);
      const { sendPushToUser } = await import('../push/send/route');
      const { getUserLang } = await import('../../lib/lang');
      const { pushText } = await import('../../lib/pushTexts');
      // Langue du DESTINATAIRE du push = le coach.
      const coachLang = await getUserLang(coachId);
      await sendPushToUser(coachId, pushText(coachLang, 'report_request_title'), pushText(coachLang, 'report_request_body', { name: athlete?.name || 'Un patient' }), '/coach');
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
