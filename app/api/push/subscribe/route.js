import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { subscription } = await req.json();
  if (!subscription?.endpoint) return Response.json({ error: 'Subscription invalide' }, { status: 400 });
  await userDb(auth.userId).set('pushSubscription', subscription);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  await userDb(auth.userId).set('pushSubscription', null);
  return Response.json({ ok: true });
}
