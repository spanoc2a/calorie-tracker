import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const weights = await userDb(auth.userId).get('muscuWeights') || {};
  return Response.json({ weights });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { exercise, weight } = await req.json();
  if (!exercise || !weight) return Response.json({ error: 'Données manquantes' }, { status: 400 });

  const udb = userDb(auth.userId);
  const weights = await udb.get('muscuWeights') || {};
  const history = weights[exercise] || [];
  const today = new Date().toISOString().slice(0, 10);

  // Remplacer l'entrée du jour si elle existe, sinon ajouter
  const existing = history.findIndex(e => e.date === today);
  if (existing >= 0) history[existing] = { date: today, weight };
  else history.push({ date: today, weight });

  weights[exercise] = history.slice(-20); // garder les 20 dernières séances
  await udb.set('muscuWeights', weights);
  return Response.json({ ok: true });
}
