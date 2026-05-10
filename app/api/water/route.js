import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return Response.json({ count: 0 });
  const count = await userDb(auth.userId).get(`water:${date}`) || 0;
  return Response.json({ count });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { date, count } = await req.json();
  if (!date || typeof count !== 'number') return Response.json({ error: 'Invalide' }, { status: 400 });
  await userDb(auth.userId).set(`water:${date}`, Math.max(0, count));
  return Response.json({ count: Math.max(0, count) });
}
