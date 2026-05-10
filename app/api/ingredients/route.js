import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const library = await userDb(auth.userId).get('ingredientLibrary') || [];
  return Response.json({ ingredients: library });
}

export async function PATCH(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { id, lastQty } = await req.json();
  const library = await udb.get('ingredientLibrary') || [];
  const updated = library.map(i => i.id === id ? { ...i, usageCount: (i.usageCount || 0) + 1, ...(lastQty != null ? { lastQty } : {}) } : i);
  await udb.set('ingredientLibrary', updated);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { id } = await req.json();
  const library = await udb.get('ingredientLibrary') || [];
  await udb.set('ingredientLibrary', library.filter(i => i.id !== id));
  return Response.json({ ok: true });
}
