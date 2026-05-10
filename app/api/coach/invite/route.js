import crypto from 'crypto';
import { db } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, coachName: me.name };
}

// Générer un nouveau lien dynamique
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { label = '', selfNutritionAllowed = true, selfMuscuAllowed = false } = await req.json().catch(() => ({}));

  const token = crypto.randomUUID();
  const invite = {
    token,
    coachId: v.coachId,
    coachName: v.coachName,
    label: label.trim(),
    selfNutritionAllowed: Boolean(selfNutritionAllowed),
    selfMuscuAllowed: Boolean(selfMuscuAllowed),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    usedAt: null,
    usedBy: null,
  };

  await db.set(`invite:${token}`, invite);

  // Ajouter à la liste du coach
  const list = await db.get(`coach:invites:${v.coachId}`) || [];
  await db.set(`coach:invites:${v.coachId}`, [token, ...list].slice(0, 30));

  return Response.json({ token, invite });
}

// Lister les invitations du coach
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;

  const tokens = await db.get(`coach:invites:${v.coachId}`) || [];
  const invites = await Promise.all(tokens.map(t => db.get(`invite:${t}`)));
  const valid = invites.filter(Boolean).map(inv => ({
    ...inv,
    expired: new Date(inv.expiresAt) < new Date(),
  }));

  return Response.json({ invites: valid });
}

// Révoquer un lien
export async function DELETE(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { token } = await req.json();

  const invite = await db.get(`invite:${token}`);
  if (!invite || invite.coachId !== v.coachId) {
    return Response.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  await db.del(`invite:${token}`);
  const list = await db.get(`coach:invites:${v.coachId}`) || [];
  await db.set(`coach:invites:${v.coachId}`, list.filter(t => t !== token));

  return Response.json({ ok: true });
}
