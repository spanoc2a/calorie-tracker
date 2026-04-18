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
{"items":[{"name":"Flocons d'avoine","quantity":60,"unit":"g","kcal":216,"protein":8,"carbs":39,"fat":4}]}
- name : nom de l'aliment, court (max 30 chars), sans la quantité.
- quantity : valeur numérique de la quantité (ex: 60, 2, 1, 200). Si non précisé, estime une portion standard.
- unit : unité telle que l'utilisateur l'a indiquée ou la plus naturelle (ex: "g", "ml", "unité", "tranche", "c.à.s", "tasse").
- kcal, protein, carbs, fat : valeurs POUR la quantity indiquée, en kcal et grammes.
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
  
  return Response.json({ items });
}