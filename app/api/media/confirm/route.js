import { db, userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';

// L'élève confirme l'upload terminé → enregistre les métadonnées + notifie le coach.
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { storedPath, note, weight } = await req.json().catch(() => ({}));
  // Validation STRICTE du chemin (anti path-traversal / cross-compte) : <userId>/(photo|video)/<id>.<ext>
  const pm = typeof storedPath === 'string' && storedPath.match(/^([^/]+)\/(photo|video)\/[A-Za-z0-9_-]+\.[a-z0-9]+$/);
  if (!pm || pm[1] !== auth.userId || storedPath.includes('..')) {
    return Response.json({ error: 'chemin invalide' }, { status: 400 });
  }
  const type = pm[2]; // dérivé du chemin, jamais du body
  const mediaId = storedPath.split('/').pop().replace(/\.[a-z0-9]+$/, '');

  const udb = userDb(auth.userId);
  const items = await udb.get('mediaItems') || [];
  const item = {
    id: mediaId,
    type,
    path: storedPath,
    note: (note || '').slice(0, 300),
    weight: (typeof weight === 'number' && weight > 0 && weight < 500) ? weight : null,
    date: new Date().toISOString(),
    viewedAt: null,
    comment: null,
    isReference: false,
    expired: false,
  };
  await udb.set('mediaItems', [item, ...items].slice(0, 100));

  // Index global des vidéos (le KV n'a pas de scan par préfixe) → sert à la purge.
  // createdAt = backstop "max âge" pour purger même une vidéo jamais visionnée (anti-orphelins).
  if (item.type === 'video') {
    const idx = await db.get('media:videoIndex') || [];
    idx.push({ athleteId: auth.userId, mediaId: item.id, path: item.path, viewedAt: null, createdAt: item.date });
    await db.set('media:videoIndex', idx.slice(-5000));
  }

  // Notifier le coach
  const coachId = await udb.get('coachId');
  if (coachId) {
    try {
      const me = await getUser(auth.userId);
      const { sendPushToUser } = await import('../../push/send/route');
      const { sendExpoPushToUser } = await import('../../../lib/expoPush');
      const { getUserLang } = await import('../../../lib/lang');
      const { pushText } = await import('../../../lib/pushTexts');
      // Langue du DESTINATAIRE du push = le coach.
      const coachLang = await getUserLang(coachId);
      const titleKey = item.type === 'video' ? 'media_new_video_title' : 'media_new_photo_title';
      const title = pushText(coachLang, titleKey, { name: me?.name || 'un élève' });
      const body = pushText(coachLang, 'media_new_body');
      await Promise.all([
        sendPushToUser(coachId, title, body, '/coach'),
        sendExpoPushToUser(coachId, title, body, { type: 'media', athleteId: auth.userId }),
      ]);
    } catch {}
  }
  return Response.json({ ok: true, item });
}
