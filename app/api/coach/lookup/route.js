import { db } from '../../../api/db';
import { getUser } from '../../users';
import { rateLimit } from '../../../lib/ratelimit';

export async function GET(req) {
  // Endpoint volontairement non authentifié → rate-limit par IP contre le brute-force de codes.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await rateLimit(`coach-lookup:${ip}`, 20, 3_600_000))) {
    return Response.json({ error: 'Trop de tentatives, réessaie plus tard' }, { status: 429 });
  }

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

  const coach = await getUser(coachId);
  if (!coach) return Response.json({ error: 'Nutritionniste introuvable' }, { status: 404 });

  return Response.json({ coachId, coachName: coach.name });
}
