import { db } from '../db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const entries = await db.get(`day:${date}`) || [];
  return Response.json({ entries });
}

export async function DELETE(req) {
  const { date, id } = await req.json();
  const key = `day:${date}`;
  const existing = await db.get(key) || [];
  await db.set(key, existing.filter(e => e.id !== id));
  return Response.json({ ok: true });
}
