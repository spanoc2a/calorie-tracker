import { db } from '../../../api/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return Response.json({ error: 'Code manquant' }, { status: 400 });

  // Essayer le nouveau système (token UUID)
  const invite = await db.get(`invite:${code}`);
  if (invite) {
    if (invite.usedAt) return Response.json({ error: 'Lien déjà utilisé' }, { status: 410 });
    if (new Date(invite.expiresAt) < new Date()) return Response.json({ error: 'Lien expiré' }, { status: 410 });
    return Response.json({ coachId: invite.coachId, coachName: invite.coachName });
  }

  // Fallback : ancien système code court (rétrocompatibilité)
  const coachId = await db.get(`coach:invite:${code.toUpperCase()}`);
  if (!coachId) return Response.json({ error: 'Lien invalide' }, { status: 404 });

  const users = await db.get('auth:users') || [];
  const coach = users.find(u => u.id === coachId);
  if (!coach) return Response.json({ error: 'Nutritionniste introuvable' }, { status: 404 });

  return Response.json({ coachId, coachName: coach.name });
}
