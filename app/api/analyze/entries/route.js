import Redis from 'ioredis';

const redis = new Redis(process.env.storage_REDIS_URL);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const key = `day:${date}`;
  const entries = JSON.parse(await redis.get(key) || "[]");
  return Response.json({ entries });
}

export async function DELETE(req) {
  const { date, id } = await req.json();
  const key = `day:${date}`;
  const existing = JSON.parse(await redis.get(key) || "[]");
  await redis.set(key, JSON.stringify(existing.filter(e => e.id !== id)));
  return Response.json({ ok: true });
}