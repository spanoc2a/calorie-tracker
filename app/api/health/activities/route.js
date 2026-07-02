import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const activities = await userDb(auth.userId).get(`health:activities:${date}`) || [];
  return Response.json({ activities });
}

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const { date, activities } = await req.json();
  if (!date || !Array.isArray(activities)) return Response.json({ error: 'invalid' }, { status: 400 });

  await userDb(auth.userId).set(`health:activities:${date}`, activities);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (date) await userDb(auth.userId).set(`health:activities:${date}`, null);
  return Response.json({ ok: true });
}
