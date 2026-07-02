import { db, userDb } from '../db';
import { requireAuth } from '../auth/session';
import { signRead, removeFiles } from '../../lib/storage';

// L'élève liste son propre suivi (avec URLs signées + commentaires du coach).
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const items = await userDb(auth.userId).get('mediaItems') || [];
  const withUrls = await Promise.all(items.map(async it => ({
    ...it,
    url: it.expired ? null : await signRead(it.path),
  })));
  return Response.json({ items: withUrls });
}

// L'élève supprime un de ses médias.
export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { mediaId } = await req.json().catch(() => ({}));
  const udb = userDb(auth.userId);
  const items = await udb.get('mediaItems') || [];
  const item = items.find(i => i.id === mediaId);
  await udb.set('mediaItems', items.filter(i => i.id !== mediaId));
  if (item?.path) await removeFiles([item.path]);
  // Nettoie l'index vidéo (évite les entrées fantômes / la pollution de l'index).
  if (item?.type === 'video') {
    const idx = await db.get('media:videoIndex') || [];
    await db.set('media:videoIndex', idx.filter(x => !(x.athleteId === auth.userId && x.mediaId === mediaId)));
  }
  return Response.json({ ok: true });
}
