import { db, userDb } from '../../db';

export const maxDuration = 60;

// Cron: every Monday 7am — mark weekly check-in as pending notification
// Athletes will see the check-in banner on their next app open
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await db.get('auth:users') || [];
  const athletes = users.filter(u => u.role !== 'coach');

  let notified = 0;
  for (const athlete of athletes) {
    try {
      const coachId = await userDb(athlete.id).get('coachId');
      if (!coachId) continue;

      // The checkin GET endpoint already computes pendingWeek dynamically,
      // so no action needed server-side — just send a push reminder
      const { sendPushToUser } = await import('../../push/send/route');
      const { sendExpoPushToUser } = await import('../../../lib/expoPush');
      await Promise.all([
        sendPushToUser(athlete.id, '✅ Check-in de la semaine', 'Ton coach attend ton retour hebdomadaire', '/'),
        sendExpoPushToUser(athlete.id, '✅ Check-in de la semaine', 'Ton coach attend ton retour hebdomadaire', { type: 'checkin' }),
      ]);
      notified++;
    } catch {}
  }

  return Response.json({ ok: true, notified });
}
