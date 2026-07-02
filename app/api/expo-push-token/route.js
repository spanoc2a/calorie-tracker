import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { token } = await req.json();
  if (!token) return Response.json({ error: 'Token manquant' }, { status: 400 });
  await userDb(auth.userId).set('expoPushToken', token);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  await userDb(auth.userId).set('expoPushToken', null);
  return Response.json({ ok: true });
}
