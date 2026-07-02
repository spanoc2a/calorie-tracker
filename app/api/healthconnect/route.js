import { userDb } from '../db';
import { requireAuth } from '../auth/session';

// GET — récupère les dernières données Health Connect
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const data = await userDb(auth.userId).get('healthConnectData') || null;
  return Response.json({ data });
}

// POST — sauvegarde le résumé Health Connect envoyé par l'app mobile
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const body = await req.json();
  const entry = {
    ...body,
    syncedAt: new Date().toISOString(),
  };
  await userDb(auth.userId).set('healthConnectData', entry);
  return Response.json({ ok: true });
}

// DELETE — déconnecte Health Connect
export async function DELETE(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  await userDb(auth.userId).set('healthConnectData', null);
  return Response.json({ ok: true });
}
