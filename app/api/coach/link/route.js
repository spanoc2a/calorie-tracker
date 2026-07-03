import { db, userDb } from '../../../api/db';
import { getUser } from '../../users';
import { requireAuth } from '../../../api/auth/session';
import { rateLimit } from '../../../lib/ratelimit';

export async function POST(req) {
  // Rate-limit par IP contre le brute-force de codes d'invitation.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await rateLimit(`coach-link:${ip}`, 20, 3_600_000))) {
    return Response.json({ error: 'Trop de tentatives, réessaie plus tard' }, { status: 429 });
  }

  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { code } = await req.json();
  if (!code) return Response.json({ error: 'Code manquant' }, { status: 400 });

  // Nouveau système : token UUID
  let coachId;
  let invitePerms = {};
  const invite = await db.get(`invite:${code}`);
  if (invite) {
    if (invite.usedAt) return Response.json({ error: 'Lien déjà utilisé' }, { status: 410 });
    if (new Date(invite.expiresAt) < new Date()) return Response.json({ error: 'Lien expiré' }, { status: 410 });
    coachId = invite.coachId;
    invitePerms = { selfNutritionAllowed: invite.selfNutritionAllowed === true, selfMuscuAllowed: invite.selfMuscuAllowed === true };
    // Marquer comme utilisé
    await db.set(`invite:${code}`, { ...invite, usedAt: new Date().toISOString(), usedBy: auth.userId });
  } else {
    // Fallback ancien système
    coachId = await db.get(`coach:invite:${code.toUpperCase()}`);
    if (!coachId) return Response.json({ error: 'Lien invalide' }, { status: 404 });
  }

  if (coachId === auth.userId) return Response.json({ error: 'Vous ne pouvez pas vous lier à vous-même' }, { status: 400 });

  const udb = userDb(auth.userId);
  const existingCoach = await udb.get('coachId');
  if (existingCoach === coachId) return Response.json({ error: 'Déjà lié à ce coach' }, { status: 400 });

  await udb.set('coachId', coachId);
  // Horodatage du rattachement — base de la séquence de bienvenue (cron coach-automations).
  await udb.set('coachLinkedAt', new Date().toISOString());
  if (Object.keys(invitePerms).length > 0) {
    const currentSettings = await udb.get('userSettings') || {};
    await udb.set('userSettings', { ...currentSettings, ...invitePerms });
  }

  const athletes = await db.get(`coach:${coachId}:athletes`) || [];
  if (!athletes.includes(auth.userId)) {
    await db.set(`coach:${coachId}:athletes`, [...athletes, auth.userId]);
  }

  const coach = await getUser(coachId);

  // Notifier le coach du rattachement (push web + Expo + notif in-app) — fail-silent.
  try {
    const athlete = await getUser(auth.userId);
    const prenom = (athlete?.name || 'Un élève').trim().split(/\s+/)[0];
    const title = '🎉 Nouvel élève !';
    const body = `${prenom} vient de rejoindre ton coaching.`;
    const { sendPushToUser } = await import('../../push/send/route');
    const { sendExpoPushToUser } = await import('../../../lib/expoPush');
    await Promise.all([
      sendPushToUser(coachId, title, body, '/coach').catch(() => {}),
      sendExpoPushToUser(coachId, title, body, { type: 'new_athlete', athleteId: auth.userId }),
    ]);
    const cdb = userDb(coachId);
    const notifs = await cdb.get('coachNotifications') || [];
    await cdb.set('coachNotifications', [{
      id: Date.now(), date: new Date().toISOString(),
      type: 'new_athlete', athleteId: auth.userId, athleteName: athlete?.name || null, read: false,
    }, ...notifs].slice(0, 20));
  } catch {}

  return Response.json({ ok: true, coachName: coach?.name || 'Coach' });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;

  const udb = userDb(auth.userId);
  const coachId = await udb.get('coachId');
  if (!coachId) return Response.json({ ok: true });

  await udb.set('coachId', null);
  const athletes = await db.get(`coach:${coachId}:athletes`) || [];
  await db.set(`coach:${coachId}:athletes`, athletes.filter(id => id !== auth.userId));
  return Response.json({ ok: true });
}
