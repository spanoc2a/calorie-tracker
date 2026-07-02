import { requireAuth } from '../../auth/session';
import { db, userDb } from '../../db';
import { getUser } from '../../users';

// Récupérer le formulaire d'intake de l'athlète connecté
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const intake = await userDb(auth.userId).get('intake') || null;
  return Response.json({ intake });
}

// Soumettre / mettre à jour le formulaire d'intake
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { allergies, goals, medicalHistory, injuries, lifestyle, motivation } = await req.json();
  const intake = {
    submittedAt: new Date().toISOString(),
    allergies,
    goals,
    medicalHistory,
    injuries,
    lifestyle,
    motivation,
  };
  await userDb(auth.userId).set('intake', intake);

  // Notifier le coach (web + Expo) — non bloquant.
  try {
    const coachId = await userDb(auth.userId).get('coachId');
    if (coachId) {
      const athlete = await getUser(auth.userId);
      const name = athlete?.name || 'Un élève';
      const { sendPushToUser } = await import('../../push/send/route');
      const { sendExpoPushToUser } = await import('../../../lib/expoPush');
      await Promise.all([
        sendPushToUser(coachId, '📋 Questionnaire reçu', `${name} a rempli son questionnaire`, '/coach'),
        sendExpoPushToUser(coachId, '📋 Questionnaire reçu', `${name} a rempli son questionnaire`, { type: 'intake_coach', athleteId: auth.userId }),
      ]);
    }
  } catch {}

  return Response.json({ intake });
}
