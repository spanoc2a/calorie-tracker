import { db, userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, me };
}

// Récupérer un commentaire de journal du coach pour un athlète et une date
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  const date = searchParams.get('date');
  if (!athleteId || !date) return Response.json({ error: 'athleteId et date requis' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const comment = await db.get(`journalComment:${v.coachId}:${athleteId}:${date}`) || null;
  return Response.json({ comment });
}

// Créer ou mettre à jour un commentaire de journal
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, date, comment } = await req.json();
  if (!athleteId || !date || !comment) return Response.json({ error: 'athleteId, date et comment requis' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  await db.set(`journalComment:${v.coachId}:${athleteId}:${date}`, {
    coachId: v.coachId,
    athleteId,
    date,
    comment,
    updatedAt: new Date().toISOString(),
  });

  // Prévenir l'athlète (notif in-app + push) — sinon il ne voit jamais le commentaire.
  try {
    const coach = v.me;
    const udb = userDb(athleteId);
    const notifs = await udb.get('coachNotifications') || [];
    await udb.set('coachNotifications', [{
      id: Date.now(), date: new Date().toISOString(),
      coachName: coach?.name || 'Ton coach', type: 'journal_comment', day: date, read: false,
    }, ...notifs].slice(0, 20));

    const { sendPushToUser } = await import('../../push/send/route');
    const { sendExpoPushToUser } = await import('../../../lib/expoPush');
    const title = `📝 ${coach?.name || 'Ton coach'}`;
    const body = 'a commenté ton journal';
    await Promise.all([
      sendPushToUser(athleteId, title, body, '/?tab=journal'),
      sendExpoPushToUser(athleteId, title, body, { type: 'journal_comment', day: date }),
    ]);
  } catch {}

  return Response.json({ ok: true });
}

// Supprimer un commentaire de journal
export async function DELETE(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, date } = await req.json();
  if (!athleteId || !date) return Response.json({ error: 'athleteId et date requis' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  await db.del(`journalComment:${v.coachId}:${athleteId}:${date}`);
  return Response.json({ ok: true });
}
