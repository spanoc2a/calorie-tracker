import { db as kv } from '../db';

export async function POST(req) {
  const { text, date } = await req.json();
  
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: `Tu es un expert en nutrition. L'utilisateur décrit ce qu'il a mangé.
Réponds UNIQUEMENT en JSON valide, sans backticks ni texte autour.
Format exact:
{"items":[{"name":"Flocons d'avoine","quantity":60,"unit":"g","kcal":216,"protein":8,"carbs":39,"fat":4,"macroType":"glucide","foodCategory":"céréale","emoji":"🌾"}]}
- name : nom de l'aliment, court (max 30 chars), sans la quantité.
- quantity : valeur numérique de la quantité. Si non précisé, estime une portion standard.
- unit : unité naturelle (ex: "g", "ml", "unité", "tranche", "c.à.s").
- kcal, protein, carbs, fat : valeurs POUR la quantity indiquée, en kcal et grammes.
- macroType : macro dominante parmi "proteine", "glucide", "lipide".
- foodCategory : exactement l'une de ces valeurs : "fruit", "légume", "viande", "poisson", "céréale", "produit laitier", "légumineuse", "matière grasse", "noix et graines", "boisson", "autre".
- emoji : un seul emoji représentant visuellement l'aliment de façon précise (ex: 🥚 pour oeuf, 🍗 pour poulet, 🐟 pour poisson, 🫐 pour myrtille).
- Si plusieurs aliments, crée plusieurs items.`,
      messages: [{ role: "user", content: text }],
    }),
  });
  
  const data = await res.json();

  if (!res.ok) {
    const msg = data.error?.message || `Erreur API ${res.status}`;
    return Response.json({ error: msg }, { status: res.status });
  }

  const content = data.content?.find(b => b.type === "text")?.text || "";
  let parsed;
  try {
    parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
  } catch {
    return Response.json({ error: "Réponse invalide du modèle", raw: content }, { status: 500 });
  }
  const items = parsed.items.map(i => ({ ...i, id: Date.now() + Math.random() }));

  const key = `day:${date}`;
  const existing = await kv.get(key) || [];
  await kv.set(key, [...existing, ...items]);

  // Save to ingredient library normalized to 100g (deduplicated by name)
  const library = await kv.get('ingredientLibrary') || [];
  for (const item of items) {
    const normalizedName = item.name.toLowerCase().trim();
    const idx = library.findIndex(l => l.name.toLowerCase().trim() === normalizedName);
    const isGram = item.unit === 'g' || item.unit === 'ml';
    const entry = {
      id: idx >= 0 ? library[idx].id : Date.now() + Math.random(),
      name: item.name,
      macroType: item.macroType || 'autre',
      foodCategory: item.foodCategory || 'autre',
      baseUnit: isGram ? item.unit : (item.unit || 'unité'),
      ...(isGram && item.quantity > 0 ? {
        per100: {
          kcal:    Math.round(item.kcal    * 100 / item.quantity),
          protein: Math.round(item.protein * 100 / item.quantity * 10) / 10,
          carbs:   Math.round(item.carbs   * 100 / item.quantity * 10) / 10,
          fat:     Math.round(item.fat     * 100 / item.quantity * 10) / 10,
        }
      } : {
        perUnit: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat }
      })
    };
    if (idx >= 0) { library[idx] = entry; } else { library.push(entry); }
  }
  await kv.set('ingredientLibrary', library);

  return Response.json({ items });
}