import { db, userDb } from '../db';
import { requireAuth } from '../auth/session';

async function resolveThread(auth) {
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me) return { error: 'Utilisateur introuvable' };

  if (me.role === 'coach') {
    return { coachId: auth.userId, role: 'coach', me };
  } else {
    const coachId = await userDb(auth.userId).get('coachId');
    if (!coachId) return { error: 'Pas de coach lié' };
    return { coachId, athleteId: auth.userId, role: 'athlete', me };
  }
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);

  const t = await resolveThread(auth);
  if (t.error) return Response.json({ messages: [] });

  let coachId = t.coachId;
  let athleteId = t.athleteId;

  if (t.role === 'coach') {
    athleteId = searchParams.get('athleteId');
    if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });
    const athleteIds = await db.get(`coach:${coachId}:athletes`) || [];
    if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const key = `chat:${coachId}:${athleteId}`;
  const messages = await db.get(key) || [];

  // Compter les non-lus AVANT de les marquer
  const unreadCount = messages.filter(m => m.role !== t.role && !m.read).length;

  // Marquer les messages de l'autre côté comme lus
  let changed = false;
  const updated = messages.map(m => {
    if (m.role !== t.role && !m.read) { changed = true; return { ...m, read: true }; }
    return m;
  });
  if (changed) await db.set(key, updated);

  return Response.json({ messages: updated, unreadCount });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { text, athleteId: bodyAthleteId } = await req.json();
  if (!text?.trim()) return Response.json({ error: 'Message vide' }, { status: 400 });

  const t = await resolveThread(auth);
  if (t.error) return Response.json({ error: t.error }, { status: 403 });

  let coachId = t.coachId;
  let athleteId = t.athleteId;

  if (t.role === 'coach') {
    athleteId = bodyAthleteId;
    if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });
    const athleteIds = await db.get(`coach:${coachId}:athletes`) || [];
    if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const key = `chat:${coachId}:${athleteId}`;
  const existing = await db.get(key) || [];
  const msg = {
    id: Date.now(),
    role: t.role,
    senderName: t.me.name,
    text: text.trim(),
    date: new Date().toISOString(),
    read: false,
  };
  await db.set(key, [...existing, msg].slice(-500));

  // Push notification au destinataire
  try {
    const { sendPushToUser } = await import('../push/send/route');
    if (t.role === 'coach') {
      // Coach → athlète
      await sendPushToUser(athleteId, `💬 ${t.me.name}`, text.trim().slice(0, 120), '/');
    } else {
      // Athlète → coach
      await sendPushToUser(coachId, `💬 ${t.me.name}`, text.trim().slice(0, 120), '/coach');
    }
  } catch {}

  return Response.json({ ok: true, message: msg });
}
