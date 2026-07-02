import { db, userDb } from '../../db';

export const maxDuration = 60;

// Rappel hebdomadaire aux élèves coachés : « envoie ta photo de suivi de la semaine ».
// Formulé comme venant du coach (IA invisible). Pas d'index global d'élèves → on parcourt auth:users.
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await db.get('auth:users') || [];
  const athletes = users.filter(u => u.role !== 'coach');
  const { sendExpoPushToUser } = await import('../../../lib/expoPush');
  const { sendPushToUser } = await import('../../push/send/route');

  let sent = 0;
  await Promise.all(athletes.map(async u => {
    try {
      const coachId = await userDb(u.id).get('coachId');
      if (!coachId) return;
      await Promise.all([
        sendExpoPushToUser(u.id, '📸 Photo de suivi', 'Envoie ta photo de progression de la semaine à ton coach.', { type: 'media_reminder' }),
        sendPushToUser(u.id, '📸 Photo de suivi', 'Envoie ta photo de progression de la semaine.', '/').catch(() => {}),
      ]);
      sent++;
    } catch {}
  }));
  return Response.json({ sent });
}
