import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const recipes = await userDb(auth.userId).get('recipes') || [];
  return Response.json({ recipes });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { name, category, items } = await req.json();
  const recipes = await udb.get('recipes') || [];
  const newRecipe = { id: Date.now(), name, category, items };
  await udb.set('recipes', [...recipes, newRecipe]);
  return Response.json({ recipe: newRecipe });
}

export async function PATCH(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { id, items, name } = await req.json();
  const recipes = await udb.get('recipes') || [];
  const updated = recipes.map(r => r.id === id ? { ...r, ...(items !== undefined && { items }), ...(name !== undefined && { name }) } : r);
  await udb.set('recipes', updated);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { id } = await req.json();
  const recipes = await udb.get('recipes') || [];
  await udb.set('recipes', recipes.filter(r => r.id !== id));
  return Response.json({ ok: true });
}
