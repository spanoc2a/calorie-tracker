import { db, userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';
import { signRead } from '../../../lib/storage';

async function requireCoachAthlete(req, athleteId) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  if (athleteId) {
    const list = await db.get(`coach:${auth.userId}:athletes`) || [];
    if (!list.includes(athleteId)) return { error: Response.json({ error: 'Athlète non lié' }, { status: 403 }) };
  }
  return { coachId: auth.userId, me };
}

// Le coach consulte le suivi photo/vidéo d'un élève (ou le total non-vus en mode résumé).
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');

  // Mode résumé (pastille mobile) : total des médias non visionnés sur tous les élèves.
  if (!athleteId || searchParams.get('summary')) {
    const v = await requireCoachAthlete(req, null); if (v.error) return v.error;
    const ids = await db.get(`coach:${v.coachId}:athletes`) || [];
    const counts = await Promise.all(ids.map(async id => {
      const items = await userDb(id).get('mediaItems') || [];
      return items.filter(m => !m.viewedAt && !m.expired).length;
    }));
    return Response.json({ total: counts.reduce((s, n) => s + n, 0) });
  }

  const v = await requireCoachAthlete(req, athleteId); if (v.error) return v.error;
  const items = await userDb(athleteId).get('mediaItems') || [];
  const withUrls = await Promise.all(items.map(async it => ({
    ...it,
    url: it.expired ? null : await signRead(it.path),
  })));
  return Response.json({ items: withUrls });
}

// Le coach marque vu (déclenche la purge 48h pour les vidéos) et/ou commente.
export async function PATCH(req) {
  const { athleteId, mediaId, action, comment } = await req.json().catch(() => ({}));
  const v = await requireCoachAthlete(req, athleteId); if (v.error) return v.error;
  const udb = userDb(athleteId);
  const items = await udb.get('mediaItems') || [];
  let changed = null;
  const next = items.map(it => {
    if (it.id !== mediaId) return it;
    changed = { ...it };
    if (action === 'view' && !it.viewedAt) changed.viewedAt = new Date().toISOString();
    if (action === 'reference') changed.isReference = !it.isReference;
    if (typeof comment === 'string') changed.comment = comment.slice(0, 500);
    return changed;
  });
  if (!changed) return Response.json({ error: 'introuvable' }, { status: 404 });
  await udb.set('mediaItems', next);

  // Synchroniser l'index vidéo (viewedAt arme la purge 48h)
  if (changed.type === 'video' && changed.viewedAt) {
    const idx = await db.get('media:videoIndex') || [];
    const i = idx.findIndex(x => x.athleteId === athleteId && x.mediaId === mediaId);
    if (i >= 0 && !idx[i].viewedAt) { idx[i].viewedAt = changed.viewedAt; await db.set('media:videoIndex', idx); }
  }

  // Notifier l'élève d'un nouveau commentaire (web + Expo) — avec un extrait du commentaire.
  if (typeof comment === 'string' && comment.trim()) {
    try {
      const { sendPushToUser } = await import('../../push/send/route');
      const { sendExpoPushToUser } = await import('../../../lib/expoPush');
      const { getUserLang } = await import('../../../lib/lang');
      const { pushText } = await import('../../../lib/pushTexts');
      // Langue du DESTINATAIRE du push = l'élève (le commentaire du coach reste tel quel).
      const title = pushText(await getUserLang(athleteId), 'media_comment_title');
      const extrait = comment.trim().slice(0, 60);
      await Promise.all([
        sendPushToUser(athleteId, title, extrait, '/').catch(() => {}),
        sendExpoPushToUser(athleteId, title, extrait, { type: 'media_comment' }),
      ]);
    } catch {}
  }
  return Response.json({ ok: true, item: changed });
}
