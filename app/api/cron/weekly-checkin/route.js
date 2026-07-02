import { userDb } from '../../db';
import { runBatchedCron } from '../../../lib/cronBatch';

export const maxDuration = 300;

// Cron: every Monday 7am — mark weekly check-in as pending notification
// Athletes will see the check-in banner on their next app open
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runBatchedCron(req, 'weekly-checkin', {
    batch: 100,
    chunk: 10,
    filter: (u) => u.role !== 'coach',
    handler: async (athlete) => {
      const coachId = await userDb(athlete.id).get('coachId');
      if (!coachId) return false;

      // The checkin GET endpoint already computes pendingWeek dynamically,
      // so no action needed server-side — just send a push reminder
      const { sendPushToUser } = await import('../../push/send/route');
      const { sendExpoPushToUser } = await import('../../../lib/expoPush');
      await Promise.all([
        sendPushToUser(athlete.id, '✅ Check-in de la semaine', 'Ton coach attend ton retour hebdomadaire', '/'),
        sendExpoPushToUser(athlete.id, '✅ Check-in de la semaine', 'Ton coach attend ton retour hebdomadaire', { type: 'checkin' }),
      ]);
      return true;
    },
  });
}
