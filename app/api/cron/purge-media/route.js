import { db, userDb } from '../../db';
import { removeFiles } from '../../../lib/storage';

export const maxDuration = 60;

// Purge des VIDÉOS 48h après leur visionnage par le coach.
// Le commentaire + la ligne sont conservés (marqués expired), seul le fichier est supprimé.
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idx = await db.get('media:videoIndex') || [];
  const now = Date.now();
  const CUTOFF = 48 * 3600 * 1000;        // 48h après visionnage par le coach
  const MAX_AGE = 30 * 24 * 3600 * 1000;  // backstop : 30j après upload même si jamais visionnée (anti-orphelins)
  const toPurge = idx.filter(x => {
    const viewed = x.viewedAt && (now - new Date(x.viewedAt).getTime()) > CUTOFF;
    const tooOld = x.createdAt && (now - new Date(x.createdAt).getTime()) > MAX_AGE;
    return viewed || tooOld;
  });
  if (!toPurge.length) return Response.json({ purged: 0 });

  await removeFiles(toPurge.map(x => x.path));

  const byAthlete = {};
  for (const x of toPurge) (byAthlete[x.athleteId] = byAthlete[x.athleteId] || []).push(x.mediaId);
  await Promise.all(Object.entries(byAthlete).map(async ([aId, ids]) => {
    const udb = userDb(aId);
    const items = await udb.get('mediaItems') || [];
    const next = items.map(it => ids.includes(it.id) ? { ...it, path: null, expired: true } : it);
    await udb.set('mediaItems', next);
  }));

  const purgeSet = new Set(toPurge.map(x => x.mediaId));
  await db.set('media:videoIndex', idx.filter(x => !purgeSet.has(x.mediaId)));
  return Response.json({ purged: toPurge.length });
}
