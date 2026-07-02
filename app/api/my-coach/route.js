import { db, userDb } from '../db';
import { requireAuth } from '../auth/session';

// Marque du coach côté élève : nom d'affichage, spécialité et logo (base64, cf. coach/profile).
// Aucune donnée sensible du coach n'est exposée (pas d'email, pas de bio interne).
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;

  const coachId = await userDb(auth.userId).get('coachId');
  if (!coachId) return Response.json({ coach: null });

  const users = await db.get('auth:users') || [];
  const coach = users.find(u => u.id === coachId);
  if (!coach) return Response.json({ coach: null }); // coach supprimé, lien orphelin

  const profile = await userDb(coachId).get('coachProfile') || {};
  return Response.json({
    coach: {
      name: profile.displayName || coach.name || '',
      specialty: profile.specialty || '',
      logo: profile.logo || null,
    },
  });
}
