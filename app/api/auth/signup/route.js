import crypto from 'crypto';
import { db, userDb } from '../../db';
import { getUser, getUserByEmail, createUser } from '../../users';
import { sessionCookie, registerSession } from '../session';
import { rateLimit } from '../../../lib/ratelimit';
import { sendWelcomeEmail } from '../../../lib/email';
import { detectLang, getUserLang } from '../../../lib/lang';
import { pushText, errorText } from '../../../lib/pushTexts';

const ITERATIONS = 100_000;

function hashPassword(password, salt, iterations = ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await rateLimit(`signup:${ip}`, 5, 3_600_000);
  if (!allowed) return Response.json({ error: errorText(detectLang(req), 'err_too_many_signups') }, { status: 429 });

  const { email, password, name, role = 'athlete', cguAcceptedAt } = await req.json();
  if (!email || !password || !name) return Response.json({ error: 'Champs manquants' }, { status: 400 });
  if (!cguAcceptedAt) return Response.json({ error: 'Vous devez accepter les CGU pour créer un compte' }, { status: 400 });
  if (password.length < 6) return Response.json({ error: 'Mot de passe trop court (6 caractères minimum)' }, { status: 400 });
  if (name.length > 100) return Response.json({ error: 'Nom trop long' }, { status: 400 });

  if (await getUserByEmail(email)) {
    return Response.json({ error: 'Email déjà utilisé' }, { status: 409 });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const id = crypto.randomUUID();
  const user = { id, email: email.toLowerCase(), name, role, salt, passwordHash: hashPassword(password, salt), iterations: ITERATIONS, createdAt: Date.now(), cguAcceptedAt, trialEndsAt: Date.now() + 7 * 24 * 3600 * 1000 };
  await createUser(user);

  const token = crypto.randomUUID();
  await db.set(`session:${token}`, { userId: id, email: user.email, name, role, expiresAt: Date.now() + 90 * 24 * 3600 * 1000 });
  await registerSession(id, token);

  // Auto-rattachement : si un coach a invité cet email, on lie l'élève DÈS l'inscription
  // → il atterrit direct en mode coaché, jamais sur le freemium / l'IA.
  let coachName = null;
  if (role !== 'coach') {
    try {
      const pending = await db.get(`coach:emailInvite:${user.email}`);
      if (pending?.coachId && pending.coachId !== id) {
        await userDb(id).set('coachId', pending.coachId);
        // Horodatage du rattachement — base de la séquence de bienvenue (cron coach-automations).
        await userDb(id).set('coachLinkedAt', new Date().toISOString());
        const athletes = await db.get(`coach:${pending.coachId}:athletes`) || [];
        if (!athletes.includes(id)) await db.set(`coach:${pending.coachId}:athletes`, [...athletes, id]);
        await db.del(`coach:emailInvite:${user.email}`);
        const coach = await getUser(pending.coachId);
        coachName = coach?.name || 'ton coach';

        // Notifier le coach du rattachement (push web + Expo + notif in-app) — fail-silent.
        try {
          const prenom = (name || 'Un élève').trim().split(/\s+/)[0];
          // Langue du DESTINATAIRE du push = le coach.
          const coachLang = await getUserLang(pending.coachId);
          const title = pushText(coachLang, 'new_athlete_title');
          const body = pushText(coachLang, 'new_athlete_body', { prenom });
          const { sendPushToUser } = await import('../../push/send/route');
          const { sendExpoPushToUser } = await import('../../../lib/expoPush');
          await Promise.all([
            sendPushToUser(pending.coachId, title, body, '/coach').catch(() => {}),
            sendExpoPushToUser(pending.coachId, title, body, { type: 'new_athlete', athleteId: id }),
          ]);
          const cdb = userDb(pending.coachId);
          const notifs = await cdb.get('coachNotifications') || [];
          await cdb.set('coachNotifications', [{
            id: Date.now(), date: new Date().toISOString(),
            type: 'new_athlete', athleteId: id, athleteName: name || null, read: false,
          }, ...notifs].slice(0, 20));
        } catch {}
      }
    } catch {}
  }

  sendWelcomeEmail(user.email, name).catch(e => console.error('[WELCOME]', e));

  return Response.json({ user: { id, email: user.email, name, role }, token, coachName }, {
    headers: { 'Set-Cookie': sessionCookie(token) },
  });
}
