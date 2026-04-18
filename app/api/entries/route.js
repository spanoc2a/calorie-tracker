import { db } from '../db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const entries = await db.get(`day:${date}`) || [];
  return Response.json({ entries });
}

export async function POST(req) {
  const { date, items } = await req.json();
  const key = `day:${date}`;
  const existing = await db.get(key) || [];
  const newItems = items.map(i => ({ ...i, id: Date.now() + Math.random() }));
  await db.set(key, [...existing, ...newItems]);
  return Response.json({ items: newItems });
}

export async function DELETE(req) {
  const { date, id } = await req.json();
  const key = `day:${date}`;
  const existing = await db.get(key) || [];
  await db.set(key, existing.filter(e => e.id !== id));
  return Response.json({ ok: true });
}
