import { kv } from '@vercel/kv';

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
{"items":[{"name":"Nom court","kcal":120,"protein":5,"carbs":15,"fat":3}]}
- Estime les calories et macros de façon réaliste pour une portion standard si non précisé.
- name doit être court (max 30 chars).
- protein, carbs, fat en grammes.
- Si plusieurs aliments, crée plusieurs items.`,
      messages: [{ role: "user", content: text }],
    }),
  });
  
  const data = await res.json();
  const content = data.content?.find(b => b.type === "text")?.text || "";
  const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
  const items = parsed.items.map(i => ({ ...i, id: Date.now() + Math.random() }));
  
  // Sauvegarde dans KV
  const key = `day:${date}`;
  const existing = await kv.get(key) || [];
  await kv.set(key, [...existing, ...items]);
  
  return Response.json({ items });
}