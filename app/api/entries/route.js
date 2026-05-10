import { userDb } from '../db';
import { requireAuth } from '../auth/session';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date || !DATE_RE.test(date)) return Response.json({ error: 'Date invalide' }, { status: 400 });
  const entries = await udb.get(`day:${date}`) || [];
  return Response.json({ entries });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { date, items } = await req.json();
  if (!date || !DATE_RE.test(date)) return Response.json({ error: 'Date invalide' }, { status: 400 });
  const key = `day:${date}`;
  const existing = await udb.get(key) || [];
  const newItems = items.map(i => ({ ...i, id: Date.now() + Math.random() }));
  await udb.set(key, [...existing, ...newItems]);
  return Response.json({ items: newItems });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { date, id } = await req.json();
  if (!date || !DATE_RE.test(date)) return Response.json({ error: 'Date invalide' }, { status: 400 });
  const key = `day:${date}`;
  const existing = await udb.get(key) || [];
  await udb.set(key, existing.filter(e => e.id !== id));
  return Response.json({ ok: true });
}
