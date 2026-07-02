import { db } from '../../db';
import { getUser, getUserByEmail } from '../../users';
import { requireAuth } from '../../auth/session';

// Invitation d'un élève PAR EMAIL : le coach pré-enregistre l'email ; quand l'élève
// s'inscrit avec cet email, il est auto-rattaché au signup (jamais de freemium).

async function requireCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, me };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req) {
  const v = await requireCoach(req); if (v.error) return v.error;
  const { email } = await req.json().catch(() => ({}));
  const e = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return Response.json({ error: 'Email invalide' }, { status: 400 });

  // Si l'utilisateur a DÉJÀ un compte, on ne peut pas l'auto-lier au signup → renvoyer le code.
  const existing = await getUserByEmail(e);
  if (existing) {
    if (existing.id === v.coachId) return Response.json({ error: 'C\'est ton propre email.' }, { status: 400 });
    return Response.json({ error: 'EXISTING_USER', message: "Cette personne a déjà un compte — partage-lui plutôt ton code d'invitation." }, { status: 409 });
  }

  await db.set(`coach:emailInvite:${e}`, { coachId: v.coachId, createdAt: Date.now() });
  const list = await db.get(`coach:${v.coachId}:emailInvites`) || [];
  if (!list.includes(e)) await db.set(`coach:${v.coachId}:emailInvites`, [...list, e].slice(-200));
  return Response.json({ ok: true });
}

export async function GET(req) {
  const v = await requireCoach(req); if (v.error) return v.error;
  const list = await db.get(`coach:${v.coachId}:emailInvites`) || [];
  // statut : "joined" si l'email a maintenant un compte rattaché, sinon "pending"
  const invites = await Promise.all(list.map(async e => {
    const stillPending = !!(await db.get(`coach:emailInvite:${e}`));
    return { email: e, status: stillPending ? 'pending' : 'joined' };
  }));
  return Response.json({ invites });
}

export async function DELETE(req) {
  const v = await requireCoach(req); if (v.error) return v.error;
  const { email } = await req.json().catch(() => ({}));
  const e = (email || '').trim().toLowerCase();
  const pending = await db.get(`coach:emailInvite:${e}`);
  if (pending?.coachId === v.coachId) await db.del(`coach:emailInvite:${e}`);
  const list = await db.get(`coach:${v.coachId}:emailInvites`) || [];
  await db.set(`coach:${v.coachId}:emailInvites`, list.filter(x => x !== e));
  return Response.json({ ok: true });
}
