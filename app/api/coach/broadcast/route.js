import { db } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';
import { rateLimit } from '../../../lib/ratelimit';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';

export const maxDuration = 300;

// Envoie un message « coach » dans le thread chat:<coachId>:<athleteId> — MÊME shape
// que le POST de /api/chat (id, role, senderName, text, image, date, read) + push
// web/Expo type 'chat'. Partagé avec le cron coach-automations (même mécanique).
export async function sendCoachChatMessage(coachId, coachName, athleteId, text, extra = {}) {
  const key = `chat:${coachId}:${athleteId}`;
  const existing = await db.get(key) || [];
  const msg = {
    id: Date.now(),
    role: 'coach',
    senderName: coachName,
    text: String(text).trim(),
    image: null,
    date: new Date().toISOString(),
    read: false,
    ...extra,
  };
  await db.set(key, [...existing, msg].slice(-500));

  // Push notification au destinataire (même forme que /api/chat).
  try {
    const snippet = msg.text.slice(0, 120);
    await Promise.all([
      sendPushToUser(athleteId, `💬 ${coachName}`, snippet, '/'),
      sendExpoPushToUser(athleteId, `💬 ${coachName}`, snippet, { type: 'chat' }),
    ]);
  } catch {}

  return msg;
}

// POST /api/coach/broadcast { text, athleteIds? }
// athleteIds absent/vide = TOUS les élèves du coach ; sinon on ne garde que ceux de
// SA liste (les ids étrangers sont ignorés silencieusement). Réponse : { sent: n }.
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const me = await getUser(auth.userId);
  if (me?.role !== 'coach') return Response.json({ error: 'Réservé aux coachs' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return Response.json({ error: 'Message vide' }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: 'Message trop long (2000 caractères max)' }, { status: 400 });
  if (body?.athleteIds != null && !Array.isArray(body.athleteIds)) {
    return Response.json({ error: 'athleteIds invalide' }, { status: 400 });
  }

  const myAthletes = await db.get(`coach:${auth.userId}:athletes`) || [];
  const requested = Array.isArray(body?.athleteIds) ? body.athleteIds : [];
  const targets = requested.length === 0
    ? myAthletes
    : [...new Set(requested.filter(id => myAthletes.includes(id)))];

  if (targets.length === 0) return Response.json({ sent: 0 });

  // Rate-limit 10 envois groupés / heure / coach.
  if (!(await rateLimit(`coach-broadcast:${auth.userId}`, 10, 3_600_000))) {
    return Response.json({ error: 'Trop de messages groupés, réessaie dans une heure' }, { status: 429 });
  }

  const coachName = me.name || 'Coach';
  let sent = 0;
  for (let i = 0; i < targets.length; i += 10) {
    const results = await Promise.allSettled(
      targets.slice(i, i + 10).map(id => sendCoachChatMessage(auth.userId, coachName, id, text, { broadcast: true }))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else console.error('[BROADCAST]', r.reason);
    }
  }

  return Response.json({ sent });
}
