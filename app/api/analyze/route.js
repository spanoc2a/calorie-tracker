export async function POST(req) {
  const { text } = await req.json();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
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
  return Response.json(data);
}