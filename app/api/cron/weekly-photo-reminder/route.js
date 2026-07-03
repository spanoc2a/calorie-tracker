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
  const { getUserLang } = await import('../../../lib/lang');
  const { pushText } = await import('../../../lib/pushTexts');

  return runBatchedCron(req, 'weekly-photo-reminder', {
    batch: 100,
    chunk: 10,
    filter: (u) => u.role !== 'coach',
    handler: async (u) => {
      const coachId = await userDb(u.id).get('coachId');
      if (!coachId) return false;
      const lang = await getUserLang(u.id);
      const title = pushText(lang, 'photo_reminder_title');
      const body = pushText(lang, 'photo_reminder_body');
      await Promise.all([
        sendExpoPushToUser(u.id, title, body, { type: 'media_reminder' }),
        sendPushToUser(u.id, title, body, '/').catch(() => {}),
      ]);
      return true;
    },
  });
}
