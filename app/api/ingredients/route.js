import { db } from '../db';

export async function GET() {
  const library = await db.get('ingredientLibrary') || [];
  return Response.json({ ingredients: library });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const library = await db.get('ingredientLibrary') || [];
  await db.set('ingredientLibrary', library.filter(i => i.id !== id));
  return Response.json({ ok: true });
}
