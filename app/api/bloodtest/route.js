import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { checkBloodTestLimit, upgradeResponse } from '../../lib/planServer';

export const maxDuration = 120;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

function makeSystem(lang) {
  const langInstr = lang !== 'fr' ? `\nIMPORTANT: Write "summary", "cause", "tip", "synergy", "avoid", "supplements", "weeklyFocus", "nextCheckup", and all "reason" fields in ${LANG_NAMES[lang] || 'English'}.` : '';
  return `Tu es un médecin nutritionniste expert en micronutrition.
Analyse le bilan de santé fourni (prise de sang, bilan hormonal, vitaminique, lipidique, NFS, ionogramme, bilan thyroïdien, etc.).
Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après. Aucun backtick.

Format EXACT :
{
  "reportType": "Prise de sang",
  "date": "2024-03-15",
  "markers": [{"name":"Glucose","value":5.2,"unit":"mmol/L","refMin":3.9,"refMax":5.6,"status":"ok"}],
  "summary": "Résumé global en 2-3 phrases. Cite les points critiques.",
  "markerRecos": [
    {
      "marker": "Fer",
      "status": "bad",
      "cause": "Apports alimentaires insuffisants ou pertes élevées (règles, sport intensif).",
      "foods": [
        {"name":"Boudin noir","quantity":"100g","frequency":"2×/semaine","tip":"Meilleure source de fer héminique, absorption 25%","emoji":"🩸"},
        {"name":"Palourdes","quantity":"150g","frequency":"1×/semaine","tip":"Très haute teneur en fer héminique","emoji":"🦪"},
        {"name":"Foie de veau","quantity":"100g","frequency":"1×/semaine","tip":"Riche en fer + vitamine B12","emoji":"🥩"},
        {"name":"Lentilles","quantity":"200g cuites","frequency":"3×/semaine","tip":"Associer à vitamine C pour absorption optimale","emoji":"🫘"}
      ],
      "synergy": "Consomme avec vitamine C (citron, poivron) pour doubler l'absorption. Évite thé/café dans les 2h après le repas.",
      "avoid": "Thé, café, calcium en même temps que les repas riches en fer.",
      "supplements": "Bisglycinate de fer 25mg/j si alimentation insuffisante. Réévaluer sous 3 mois."
    }
  ],
  "recommendations": [
    {"type":"eat","food":"Épinards","reason":"Riche en fer et folates","emoji":"🥬"},
    {"type":"avoid","food":"Café après repas","reason":"Inhibe l'absorption du fer","emoji":"☕"}
  ],
  "weeklyFocus": "Cette semaine : priorité fer et vitamine D. Objectif : 2 repas riches en fer héminique + exposition soleil 20min/j.",
  "nextCheckup": "Refaire bilan fer + vitamine D dans 3 mois."
}

Règles :
- date : date visible sur le document, ou null
- reportType : type de bilan détecté
- status marker : "ok" | "warn" | "bad"
- markerRecos : UNIQUEMENT pour les marqueurs warn ou bad, 3 à 6 foods par marqueur avec quantités précises
- recommendations : 6 à 10 items globaux actionnables
- weeklyFocus : 1 phrase d'action concrète pour cette semaine
- nextCheckup : recommandation de suivi temporelle
- Sois précis sur les quantités, fréquences et synergies nutritionnelles${langInstr}`;
}

function extractJSON(text) {
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  // Try to find the JSON object
  const start = clean.indexOf('{');
  if (start === -1) return null;
  const sub = clean.slice(start);
  try { return JSON.parse(sub); } catch {}
  // Response may be truncated — repair by closing open structures
  let depth = 0; let inStr = false; let escape = false; let lastValidPos = -1;
  for (let i = 0; i < sub.length; i++) {
    const c = sub[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) { lastValidPos = i; } }
  }
  // Try progressively closing the truncated JSON
  if (depth > 0) {
    let repaired = sub;
    // Remove trailing incomplete key/value
    repaired = repaired.replace(/,\s*"[^"]*"?\s*:\s*[^,}\]]*$/, '');
    repaired = repaired.replace(/,\s*"[^"]*"?\s*$/, '');
    // Close open structures
    const closes = [];
    let d2 = 0; let inS2 = false; let esc2 = false;
    const stack = [];
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (esc2) { esc2 = false; continue; }
      if (c === '\\' && inS2) { esc2 = true; continue; }
      if (c === '"') { inS2 = !inS2; continue; }
      if (inS2) continue;
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }
    repaired += stack.reverse().join('');
    try { return JSON.parse(repaired); } catch {}
  }
  return null;
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const results = await userDb(auth.userId).get('bloodTests') || [];
  return Response.json({ results });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const limit = await checkBloodTestLimit(auth.userId);
  if (!limit.allowed) return upgradeResponse('bloodtest');
  const lang = detectLang(req);
  const SYSTEM = makeSystem(lang);
  const udb = userDb(auth.userId);
  const formData = await req.formData();
  const files = formData.getAll('files');
  const recentFoods = formData.get('recentFoods') || '';
  const settings = await udb.get('userSettings') || {};
  const healthHistory = settings.healthHistory || '';

  if (!files || files.length === 0)
    return Response.json({ error: 'Aucun fichier fourni' }, { status: 400 });

  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.type))
      return Response.json({ error: `Format non supporté : ${file.name}` }, { status: 400 });
  }

  const blocks = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    if (file.type === 'application/pdf') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
    } else {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } });
    }
  }

  const foodCtx = recentFoods ? `\n\nAlimentation récente du patient (7 derniers jours) :\n${recentFoods}` : '';
  const healthCtx = healthHistory ? `\n\nHistorique de santé du patient (IMPORTANT — tenir compte pour les recommandations) : ${healthHistory}` : '';
  blocks.push({ type: 'text', text: `Analyse ce bilan de santé et fournis des recommandations nutritionnelles précises et personnalisées.${healthCtx}${foodCtx}` });

  const hasPDF = files.some(f => f.type === 'application/pdf');
  const apiHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    ...(hasPDF && { 'anthropic-beta': 'pdfs-2024-09-25' }),
  };

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: blocks }],
    }),
  });

  const apiData = await apiRes.json();
  if (!apiRes.ok) {
    console.error('API error:', JSON.stringify(apiData));
    return Response.json({ error: apiData.error?.message || `Erreur API ${apiRes.status}` }, { status: apiRes.status });
  }

  const raw = apiData.content?.find(b => b.type === 'text')?.text || '';
  const parsed = extractJSON(raw);

  if (!parsed) {
    console.error('Parse failed. Raw length:', raw.length, '| First 400:', raw.slice(0, 400));
    return Response.json({ error: 'Réponse inattendue du modèle — réessaie. (Debug: ' + raw.slice(0, 120) + ')' }, { status: 500 });
  }

  const filename = files.length === 1 ? files[0].name : `${files.length} fichiers`;
  const coachId = await udb.get('coachId');
  const pendingCoachValidation = !!coachId;
  const result = { id: Date.now(), uploadedAt: new Date().toISOString(), filename, pendingCoachValidation, ...parsed };
  const existing = await udb.get('bloodTests') || [];
  await udb.set('bloodTests', [result, ...existing].slice(0, 10));

  if (coachId) {
    const users = await import('../db').then(m => m.db.get('auth:users')).then(u => u || []);
    const athlete = users.find(u => u.id === auth.userId);
    import('../push/send/route').then(m =>
      m.sendPushToUser(coachId, '🩸 Nouveau bilan sanguin', `${athlete?.name || 'Un athlète'} a envoyé un bilan à analyser`, '/coach')
    ).catch(() => {});
  }

  return Response.json({ result, pendingCoachValidation });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { id } = await req.json();
  const existing = await udb.get('bloodTests') || [];
  await udb.set('bloodTests', existing.filter(r => r.id !== id));
  return Response.json({ ok: true });
}
