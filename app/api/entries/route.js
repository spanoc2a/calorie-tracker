import { userDb } from '../db';
import { requireAuth } from '../auth/session';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  if (from && to) {
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return Response.json({ error: 'Dates invalides' }, { status: 400 });
    const start = new Date(from), end = new Date(to);
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
      dates.push(d.toISOString().slice(0, 10));
    const all = await Promise.all(dates.map(async dt => [dt, await udb.get(`day:${dt}`) || []]));
    const days = Object.fromEntries(all);
    return Response.json({ days });
  }
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
