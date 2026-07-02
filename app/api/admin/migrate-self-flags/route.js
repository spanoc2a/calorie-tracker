import { db, userDb } from '../../db';

// Migration ONE-SHOT (2026-07-02) : les flags selfNutritionAllowed/selfMuscuAllowed stockés à true
// viennent de l'ancien défaut d'invitation, jamais d'un choix délibéré du coach (aucune UI ne les pose).
// L'ancien verrou blanket les ignorait ; le nouveau gate les honore → on les remet à false pour
// conserver le comportement existant (IA invisible). Route à SUPPRIMER après exécution.
const ONE_SHOT_TOKEN = 'bfde02d51240b7dcf95da592cd465d46bdb249b3d5c137d5';

export async function POST(req) {
  const authz = req.headers.get('authorization') || '';
  if (authz !== `Bearer ${ONE_SHOT_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const users = (await db.get('auth:users')) || [];
  let scanned = 0, migrated = 0;
  for (const u of users) {
    const udb = userDb(u.id);
    const coachId = await udb.get('coachId');
    if (!coachId) continue;
    scanned++;
    const settings = (await udb.get('userSettings')) || {};
    if (settings.selfNutritionAllowed === true || settings.selfMuscuAllowed === true) {
      await udb.set('userSettings', { ...settings, selfNutritionAllowed: false, selfMuscuAllowed: false });
      migrated++;
    }
  }
  return Response.json({ ok: true, coached: scanned, migrated });
}
