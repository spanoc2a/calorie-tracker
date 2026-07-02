import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { db, userDb } from '../../db';
import { requireAuth, revokeAllSessions } from '../session';
import { BUCKET, removeFiles } from '../../../lib/storage';

const ITERATIONS = 100_000;
function hashPassword(password, salt, iterations = ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
}

// Client Storage local (storage.js n'exporte pas de fonction de listing) —
// mêmes variables d'env que app/lib/storage.js pour cibler le même projet/bucket.
const storageClient = createClient(
  process.env.SUPABASE_STORAGE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_STORAGE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Liste tous les fichiers du préfixe <userId>/ (structure <userId>/<type>/<fichier>)
// pour attraper les orphelins non référencés dans mediaItems (ex. photos de chat).
async function listStoragePaths(userId) {
  const paths = [];
  try {
    const { data: entries } = await storageClient.storage.from(BUCKET).list(userId, { limit: 200 });
    for (const entry of entries || []) {
      if (entry.id) { paths.push(`${userId}/${entry.name}`); continue; } // fichier à la racine
      // Dossier (photo/video/…) → lister son contenu
      const { data: files } = await storageClient.storage.from(BUCKET).list(`${userId}/${entry.name}`, { limit: 1000 });
      for (const f of files || []) {
        if (f.id) paths.push(`${userId}/${entry.name}/${f.name}`);
      }
    }
  } catch {}
  return paths;
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  if (auth.isViewAs) return Response.json({ error: 'Non autorisé' }, { status: 403 });

  const { password } = await req.json().catch(() => ({}));
  if (!password) return Response.json({ error: 'Mot de passe requis' }, { status: 400 });

  const users = await db.get('auth:users') || [];
  const user = users.find(u => u.id === auth.userId);
  if (!user || hashPassword(password, user.salt, user.iterations || ITERATIONS) !== user.passwordHash) {
    return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }

  const userId = auth.userId;
  const udb = userDb(userId);

  // 0. Lire AVANT toute suppression ce qui est nécessaire au nettoyage croisé.
  const [coachId, mediaItems] = await Promise.all([
    udb.get('coachId').catch(() => null),
    udb.get('mediaItems').then(m => m || []).catch(() => []),
  ]);

  // 1. Fichiers Supabase Storage : chemins référencés + listing du préfixe (orphelins, photos de chat).
  const referencedPaths = mediaItems.map(m => m?.path).filter(Boolean);
  const listedPaths = await listStoragePaths(userId);
  await removeFiles([...new Set([...referencedPaths, ...listedPaths])]);

  // 2. TOUTES les clés de données de l'utilisateur (journal, settings, programmes, etc.).
  await db.deletePrefix(`u:${userId}:`);

  // 3. Données croisées côté coach.
  if (coachId) {
    await Promise.all([
      db.del(`chat:${coachId}:${userId}`),
      db.del(`coach:notes:${coachId}:${userId}`),
      db.deletePrefix(`journalComment:${coachId}:${userId}:`),
    ]);
    const athleteIds = await db.get(`coach:${coachId}:athletes`) || [];
    await db.set(`coach:${coachId}:athletes`, athleteIds.filter(id => id !== userId));
  }

  // 4. Nettoyer l'index global des vidéos.
  const videoIndex = await db.get('media:videoIndex') || [];
  if (videoIndex.some(x => x.athleteId === userId)) {
    await db.set('media:videoIndex', videoIndex.filter(x => x.athleteId !== userId));
  }

  // 5. Retirer de auth:users.
  await db.set('auth:users', users.filter(u => u.id !== userId));

  // 6. Révoquer toutes les sessions connues.
  await revokeAllSessions(userId);

  return Response.json({ ok: true }, {
    headers: {
      'Set-Cookie': [
        'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'viewAs=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      ].join(', '),
    },
  });
}
