import { kv } from '@vercel/kv';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const key = `day:${date}`;
  const entries = await kv.get(key) || [];
  return Response.json({ entries });
}

export async function DELETE(req) {
  const { date, id } = await req.json();
  const key = `day:${date}`;
  const existing = await kv.get(key) || [];
  await kv.set(key, existing.filter(e => e.id !== id));
  return Response.json({ ok: true });
}