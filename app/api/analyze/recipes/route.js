import { kv } from '@vercel/kv';

export async function GET() {
  const recipes = await kv.get('recipes') || [];
  return Response.json({ recipes });
}

export async function POST(req) {
  const { name, items } = await req.json();
  const recipes = await kv.get('recipes') || [];
  const newRecipe = { id: Date.now(), name, items };
  await kv.set('recipes', [...recipes, newRecipe]);
  return Response.json({ recipe: newRecipe });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const recipes = await kv.get('recipes') || [];
  await kv.set('recipes', recipes.filter(r => r.id !== id));
  return Response.json({ ok: true });
}