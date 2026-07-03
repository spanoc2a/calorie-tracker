import { db, userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';
import { getUserLang } from '../../../lib/lang';
import { pushText } from '../../../lib/pushTexts';

// Coach valide un bilan sanguin d'un athlète et le lui envoie
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  // `edits` optionnel : le coach corrige l'analyse IA (summary, weeklyFocus, markers…)
  // avant de valider. Fusionné en gardant l'id du bilan.
  const { athleteId, bloodTestId, edits } = await req.json();
  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non trouvé' }, { status: 404 });

  const udb = userDb(athleteId);
  const bloodTests = await udb.get('bloodTests') || [];
  const idx = bloodTests.findIndex(b => b.id === bloodTestId);
  if (idx === -1) return Response.json({ error: 'Bilan non trouvé' }, { status: 404 });

  bloodTests[idx] = {
    ...bloodTests[idx], ...(edits || {}), id: bloodTests[idx].id,
    pendingCoachValidation: false, coachValidated: true, validatedBy: me.name, validatedAt: new Date().toISOString(),
  };
  await udb.set('bloodTests', bloodTests);

  const athlete = await getUser(athleteId);
  // Langue du DESTINATAIRE du push = l'élève.
  const athleteLang = await getUserLang(athleteId);
  const btTitle = pushText(athleteLang, 'blood_ready_title');
  const btBody = pushText(athleteLang, 'blood_ready_body', { name: me.name });
  sendPushToUser(athleteId, btTitle, btBody, '/').catch(() => {});
  sendExpoPushToUser(athleteId, btTitle, btBody, { type: 'blood_ready' });

  // Notif in-app de l'élève (même pattern que blood-transfer / report) — fail-silent.
  try {
    const notifs = await udb.get('coachNotifications') || [];
    await udb.set('coachNotifications', [{
      id: Date.now(), date: new Date().toISOString(),
      coachName: me.name || 'Ton coach', type: 'bloodResult', read: false,
    }, ...notifs].slice(0, 20));
  } catch {}

  return Response.json({ ok: true });
}
