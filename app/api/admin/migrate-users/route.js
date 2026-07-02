import { db } from '../../db';
import { createUser } from '../../users';

// Migration ONE-SHOT (2026-07-02) : copie le blob auth:users vers le magasin
// user:<id> + useremail:<email>. Le blob est conservé (archive/fallback legacy).
// Route à SUPPRIMER après exécution.
const ONE_SHOT_TOKEN = '48984dc518a65754b8f3263ee911c1fef026de6550b5d71d';

export async function POST(req) {
  const authz = req.headers.get('authorization') || '';
  if (authz !== `Bearer ${ONE_SHOT_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const legacy = (await db.get('auth:users')) || [];
  let migrated = 0, skipped = 0;
  for (const u of legacy) {
    if (!u?.id) { skipped++; continue; }
    const existing = await db.get(`user:${u.id}`);
    if (existing) { skipped++; continue; } // déjà migré (lazy) : ne pas écraser plus frais
    await createUser(u);
    migrated++;
  }
  const rows = await db.listPrefix('user:');
  return Response.json({ ok: true, legacy: legacy.length, migrated, skipped, totalStore: rows.length });
}
