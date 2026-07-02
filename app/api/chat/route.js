import { db, userDb } from '../db';
import { getUser } from '../users';
import { requireAuth } from '../auth/session';
import { signRead } from '../../lib/storage';

async function resolveThread(auth) {
  const me = await getUser(auth.userId);
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

  // peek=1 : juste le compteur, NE marque PAS comme lu (sondage pastille non-lu).
  if (searchParams.get('peek')) {
    return Response.json({ unreadCount });
  }

  // Marquer les messages de l'autre côté comme lus.
  // View-as (coach qui impersone l'élève) : lecture seule → on renvoie les messages
  // mais on ne marque RIEN comme lu (même comportement que ?peek=1 pour le marquage).
  let updated = messages;
  if (!auth.isViewAs) {
    let changed = false;
    updated = messages.map(m => {
      if (m.role !== t.role && !m.read) { changed = true; return { ...m, read: true }; }
      return m;
    });
    if (changed) await db.set(key, updated);
  }

  // Signe les éventuelles photos jointes (URLs temporaires de lecture).
  const withUrls = await Promise.all(updated.map(async m => m.image ? { ...m, imageUrl: await signRead(m.image) } : m));
  return Response.json({ messages: withUrls, unreadCount });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { text, imagePath, athleteId: bodyAthleteId } = await req.json();
  const hasImage = typeof imagePath === 'string' && imagePath.startsWith(`${auth.userId}/`) && !imagePath.includes('..');
  if (!text?.trim() && !hasImage) return Response.json({ error: 'Message vide' }, { status: 400 });

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
    text: (text || '').trim(),
    image: hasImage ? imagePath : null,
    date: new Date().toISOString(),
    read: false,
  };
  await db.set(key, [...existing, msg].slice(-500));

  // Push notification au destinataire
  try {
    const { sendPushToUser } = await import('../push/send/route');
    const { sendExpoPushToUser } = await import('../../lib/expoPush');
    if (t.role === 'coach') {
      const snippet = ((text || '').trim() || '📷 Photo').slice(0, 120);
      await Promise.all([
        sendPushToUser(athleteId, `💬 ${t.me.name}`, snippet, '/'),
        sendExpoPushToUser(athleteId, `💬 ${t.me.name}`, snippet, { type: 'chat' }),
      ]);
    } else {
      const snippet = ((text || '').trim() || '📷 Photo').slice(0, 120);
      await sendPushToUser(coachId, `💬 ${t.me.name}`, snippet, '/coach');
      await sendExpoPushToUser(coachId, `💬 ${t.me.name}`, snippet, { type: 'chat', athleteId: t.athleteId });
    }
  } catch {}

  return Response.json({ ok: true, message: msg });
}
