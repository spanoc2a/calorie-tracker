import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { rateLimit } from '../../lib/ratelimit';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

function makeSystem(lang) {
  return `Tu es un expert en nutrition. L'utilisateur décrit ce qu'il a mangé.
Réponds UNIQUEMENT en JSON valide, sans backticks ni texte autour.
Format exact:
{"items":[{"name":"Flocons d'avoine","quantity":60,"unit":"g","kcal":216,"protein":8,"carbs":39,"fat":4,"macroType":"glucide","foodCategory":"céréale","emoji":"🌾"}]}
- name : nom de l'aliment, court (max 30 chars), sans la quantité. Écris le nom en ${LANG_NAMES[lang] || 'français'}.
- quantity : valeur numérique de la quantité. Si non précisé, estime une portion standard.
- unit : unité naturelle (ex: "g", "ml", "unité", "tranche", "c.à.s").
- kcal, protein, carbs, fat : valeurs POUR la quantity indiquée, en kcal et grammes.
- macroType : macro dominante parmi "proteine", "glucide", "lipide".
- foodCategory : exactement l'une de ces valeurs : "fruit", "légume", "viande", "poisson", "céréale", "produit laitier", "légumineuse", "matière grasse", "noix et graines", "boisson", "autre".
- emoji : un seul emoji représentant visuellement l'aliment de façon précise.
- Si plusieurs aliments, crée plusieurs items.`;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const lang = detectLang(req);
  const SYSTEM = makeSystem(lang);
  const allowed = await rateLimit(`ai:${auth.userId}`, 30, 60_000);
  if (!allowed) return Response.json({ error: 'Trop de requêtes, réessaie dans une minute' }, { status: 429 });

  const udb = userDb(auth.userId);
  const contentType = req.headers.get('content-type') || '';

  let text = null;
  let date = null;
  let meal = null;
  let imageBlocks = [];

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    // Multi-photos : champ "images" (plusieurs), avec compat ascendante sur "image" (une seule)
    const files = formData.getAll('images');
    const single = formData.get('image');
    if (single) files.push(single);
    date = formData.get('date');
    meal = formData.get('meal') || null;
    if (!files.length) return Response.json({ error: 'Aucune image fournie' }, { status: 400 });
    if (files.length > 6) return Response.json({ error: 'Maximum 6 photos par analyse' }, { status: 400 });
    for (const file of files) {
      if (!ALLOWED_MIME.includes(file.type)) {
        return Response.json({ error: 'Format non supporté. Utilise JPEG, PNG ou WebP.' }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength > MAX_IMAGE_BYTES) return Response.json({ error: 'Image trop volumineuse (max 5 Mo)' }, { status: 400 });
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: file.type, data: Buffer.from(bytes).toString('base64') } });
    }
  } else {
    const body = await req.json();
    text = body.text;
    date = body.date;
    meal = body.meal || null;
    if (body.programMode) {
      // Calcul macros uniquement — pas de sauvegarde journal
      const messages2 = [{ role: 'user', content: text }];
      const res2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, system: SYSTEM, messages: messages2 }),
      });
      const data2 = await res2.json();
      if (!res2.ok) return Response.json({ error: data2.error?.message }, { status: res2.status });
      const content2 = data2.content?.find(b => b.type === 'text')?.text || '';
      let parsed2;
      try { parsed2 = JSON.parse(content2.replace(/```json|```/g, '').trim()); } catch { return Response.json({ error: 'Réponse invalide' }, { status: 500 }); }
      const items2 = parsed2.items.map(i => ({ ...i, id: Date.now() + Math.random() }));
      // Sauvegarder dans la librairie
      const lib = await udb.get('ingredientLibrary') || [];
      for (const item of items2) {
        const nname = item.name.toLowerCase().trim();
        const idx = lib.findIndex(l => l.name.toLowerCase().trim() === nname);
        const isGram = item.unit === 'g' || item.unit === 'ml';
        const entry = { id: idx >= 0 ? lib[idx].id : Date.now() + Math.random(), name: item.name, macroType: item.macroType || 'autre', foodCategory: item.foodCategory || 'autre', baseUnit: isGram ? item.unit : (item.unit || 'unité'), ...(isGram && item.quantity > 0 ? { per100: { kcal: Math.round(item.kcal * 100 / item.quantity), protein: Math.round(item.protein * 100 / item.quantity * 10) / 10, carbs: Math.round(item.carbs * 100 / item.quantity * 10) / 10, fat: Math.round(item.fat * 100 / item.quantity * 10) / 10 } } : { perUnit: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat } }) };
        if (idx >= 0) lib[idx] = entry; else lib.push(entry);
      }
      await udb.set('ingredientLibrary', lib);
      return Response.json({ items: items2 });
    }
  }

  const photoPrompt = lang === 'en'
    ? "These photos show a single meal (possibly several dishes or angles). Identify every visible food, estimate quantities and nutritional macros, and list each distinct food only once (do not double-count the same dish seen from different angles)."
    : lang === 'es'
    ? "Estas fotos muestran una sola comida (posiblemente varios platos o ángulos). Identifica cada alimento visible, estima cantidades y macros, y lista cada alimento una sola vez (no cuentes dos veces el mismo plato visto desde otro ángulo)."
    : "Ces photos montrent un même repas (éventuellement plusieurs plats ou angles). Identifie chaque aliment visible, estime les quantités et macros, et liste chaque aliment distinct une seule fois (ne compte pas deux fois le même plat vu sous un autre angle).";
  const messages = imageBlocks.length
    ? [{ role: 'user', content: [...imageBlocks, { type: 'text', text: photoPrompt }] }]
    : [{ role: 'user', content: text }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: imageBlocks.length ? 2000 : 1000, system: SYSTEM, messages }),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: data.error?.message || `Erreur API ${res.status}` }, { status: res.status });
  }

  const content = data.content?.find(b => b.type === 'text')?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch {
    return Response.json({ error: 'Réponse invalide du modèle', raw: content }, { status: 500 });
  }

  const items = parsed.items.map(i => ({ ...i, id: Date.now() + Math.random(), ...(meal ? { meal } : {}) }));

  const key = `day:${date}`;
  const existing = await udb.get(key) || [];
  await udb.set(key, [...existing, ...items]);

  const library = await udb.get('ingredientLibrary') || [];
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
        },
      } : {
        perUnit: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
      }),
    };
    if (idx >= 0) library[idx] = entry;
    else library.push(entry);
  }
  await udb.set('ingredientLibrary', library);

  return Response.json({ items });
}
