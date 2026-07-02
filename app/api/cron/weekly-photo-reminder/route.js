import { userDb } from '../../db';
import { runBatchedCron } from '../../../lib/cronBatch';

export const maxDuration = 300;

// Rappel hebdomadaire aux élèves coachés : « envoie ta photo de suivi de la semaine ».
// Formulé comme venant du coach (IA invisible).
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sendExpoPushToUser } = await import('../../../lib/expoPush');
  const { sendPushToUser } = await import('../../push/send/route');

  return runBatchedCron(req, 'weekly-photo-reminder', {
    batch: 100,
    chunk: 10,
    filter: (u) => u.role !== 'coach',
    handler: async (u) => {
      const coachId = await userDb(u.id).get('coachId');
      if (!coachId) return false;
      await Promise.all([
        sendExpoPushToUser(u.id, '📸 Photo de suivi', 'Envoie ta photo de progression de la semaine à ton coach.', { type: 'media_reminder' }),
        sendPushToUser(u.id, '📸 Photo de suivi', 'Envoie ta photo de progression de la semaine.', '/').catch(() => {}),
      ]);
      return true;
    },
  });
}
