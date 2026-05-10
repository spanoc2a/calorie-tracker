import { db, userDb } from '../../db';
import { requireAuth } from '../../auth/session';
import { sendPushToUser } from '../../push/send/route';

// Coach valide un bilan sanguin d'un athlète et le lui envoie
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const { athleteId, bloodTestId } = await req.json();
  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non trouvé' }, { status: 404 });

  const udb = userDb(athleteId);
  const bloodTests = await udb.get('bloodTests') || [];
  const idx = bloodTests.findIndex(b => b.id === bloodTestId);
  if (idx === -1) return Response.json({ error: 'Bilan non trouvé' }, { status: 404 });

  bloodTests[idx] = { ...bloodTests[idx], pendingCoachValidation: false, coachValidated: true, validatedBy: me.name, validatedAt: new Date().toISOString() };
  await udb.set('bloodTests', bloodTests);

  const athlete = users.find(u => u.id === athleteId);
  sendPushToUser(athleteId, '🩸 Ton bilan est prêt', `${me.name} a analysé ton bilan sanguin`, '/').catch(() => {});

  return Response.json({ ok: true });
}
