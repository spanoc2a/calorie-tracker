import Redis from 'ioredis';

const redis = new Redis(process.env.storage_REDIS_URL);

export async function GET() {
  const recipes = JSON.parse(await redis.get('recipes') || "[]");
  return Response.json({ recipes });
}

export async function POST(req) {
  const { name, items } = await req.json();
  const recipes = JSON.parse(await redis.get('recipes') || "[]");
  const newRecipe = { id: Date.now(), name, items };
  await redis.set('recipes', JSON.stringify([...recipes, newRecipe]));
  return Response.json({ recipe: newRecipe });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const recipes = JSON.parse(await redis.get('recipes') || "[]");
  await redis.set('recipes', JSON.stringify(recipes.filter(r => r.id !== id)));
  return Response.json({ ok: true });
}