import { db } from '../db';

export async function GET() {
  const recipes = await db.get('recipes') || [];
  return Response.json({ recipes });
}

export async function POST(req) {
  const { name, category, items } = await req.json();
  const recipes = await db.get('recipes') || [];
  const newRecipe = { id: Date.now(), name, category, items };
  await db.set('recipes', [...recipes, newRecipe]);
  return Response.json({ recipe: newRecipe });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const recipes = await db.get('recipes') || [];
  await db.set('recipes', recipes.filter(r => r.id !== id));
  return Response.json({ ok: true });
}
