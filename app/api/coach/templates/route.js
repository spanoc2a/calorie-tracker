import { db, userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId };
}

// Lister les templates du coach
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const templates = await db.get(`coach:templates:${v.coachId}`) || [];
  return Response.json({ templates });
}

// Créer un nouveau template
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { name, type, program, description = '' } = await req.json();
  if (!name || !type || !program) return Response.json({ error: 'name, type et program requis' }, { status: 400 });

  const template = { id: Date.now(), name, type, description, createdAt: new Date().toISOString(), program };
  const templates = await db.get(`coach:templates:${v.coachId}`) || [];
  const updated = [template, ...templates].slice(0, 100);
  await db.set(`coach:templates:${v.coachId}`, updated);
  return Response.json({ template });
}

// Supprimer un template
export async function DELETE(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { id } = await req.json();
  if (!id) return Response.json({ error: 'id requis' }, { status: 400 });

  const templates = await db.get(`coach:templates:${v.coachId}`) || [];
  await db.set(`coach:templates:${v.coachId}`, templates.filter(t => t.id !== id));
  return Response.json({ ok: true });
}
