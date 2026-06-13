import { requireAuth } from '../auth/session';
import { userDb } from '../db';

// Récupérer les mensurations de l'utilisateur
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const measurements = await userDb(auth.userId).get('measurements') || [];
  return Response.json({ measurements });
}

// Ajouter une nouvelle mensuration
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { date, weight, waist, chest, hips, arm, thigh, bodyFat, muscleMass, note } = await req.json();
  if (!date) return Response.json({ error: 'date requis' }, { status: 400 });

  const measurement = { id: Date.now(), date, weight, waist, chest, hips, arm, thigh, bodyFat, muscleMass, note };
  const existing = await userDb(auth.userId).get('measurements') || [];
  const updated = [measurement, ...existing].slice(0, 100);
  await userDb(auth.userId).set('measurements', updated);
  return Response.json({ measurement });
}

// Supprimer une mensuration
export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return Response.json({ error: 'id requis' }, { status: 400 });

  const existing = await userDb(auth.userId).get('measurements') || [];
  await userDb(auth.userId).set('measurements', existing.filter(m => m.id !== id));
  return Response.json({ ok: true });
}
