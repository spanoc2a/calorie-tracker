import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code || !/^\d{8,14}$/.test(code)) {
    return Response.json({ error: 'Code invalide' }, { status: 400 });
  }

  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
    { headers: { 'User-Agent': 'CalorieTracker/1.0 (contact@example.com)' } }
  );

  if (!res.ok) return Response.json({ error: 'Produit introuvable' }, { status: 404 });

  const data = await res.json();
  if (data.status === 0 || !data.product) {
    return Response.json({ error: 'Produit non trouvé dans Open Food Facts' }, { status: 404 });
  }

  const p = data.product;
  const n = p.nutriments || {};

  return Response.json({
    product: {
      name:    p.product_name_fr || p.product_name || 'Produit inconnu',
      brand:   p.brands || '',
      kcal:    Math.round(n['energy-kcal_100g'] || 0),
      protein: Math.round((n['proteins_100g']      || 0) * 10) / 10,
      carbs:   Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
      fat:     Math.round((n['fat_100g']           || 0) * 10) / 10,
    },
  });
}
