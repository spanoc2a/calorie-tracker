import { userDb } from '../db';
import { requireAuth } from '../auth/session';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

// Patient envoie ses fichiers au nutritionniste
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  if (auth.isViewAs) return Response.json({ error: 'Non autorisé' }, { status: 403 });

  const formData = await req.formData();
  const files = formData.getAll('files');
  if (!files?.length) return Response.json({ error: 'Aucun fichier' }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Maximum ${MAX_FILES} fichiers` }, { status: 400 });

  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.type))
      return Response.json({ error: `Format non supporté : ${file.name}` }, { status: 400 });
    if (file.size > MAX_FILE_BYTES)
      return Response.json({ error: `Fichier trop volumineux : ${file.name} (max 10 Mo)` }, { status: 400 });
  }

  const fileData = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    fileData.push({ name: file.name, type: file.type, data: Buffer.from(bytes).toString('base64') });
  }

  await userDb(auth.userId).set('pendingBloodFiles', { files: fileData, sentAt: new Date().toISOString() });
  return Response.json({ ok: true });
}

// Vérifier fichiers en attente
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const pending = await userDb(auth.userId).get('pendingBloodFiles');
  return Response.json({ pending: pending ? { sentAt: pending.sentAt, count: pending.files.length } : null });
}

// Nutritionniste analyse les fichiers en attente (viewAs)
export async function PUT(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  if (!auth.isViewAs) return Response.json({ error: 'Réservé au nutritionniste' }, { status: 403 });

  const udb = userDb(auth.userId);
  const pending = await udb.get('pendingBloodFiles');
  if (!pending?.files?.length) return Response.json({ error: 'Aucun bilan en attente' }, { status: 400 });

  const settings = await udb.get('userSettings') || {};
  const healthHistory = settings.healthHistory || '';

  const blocks = [];
  for (const file of pending.files) {
    if (file.type === 'application/pdf') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } });
    } else {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: file.type, data: file.data } });
    }
  }
  const healthCtx = healthHistory ? `\n\nHistorique de santé du patient : ${healthHistory}` : '';
  blocks.push({ type: 'text', text: `Analyse ce bilan de santé et fournis des recommandations nutritionnelles précises et personnalisées.${healthCtx}` });

  const hasPDF = pending.files.some(f => f.type === 'application/pdf');
  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      ...(hasPDF && { 'anthropic-beta': 'pdfs-2024-09-25' }),
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: SYSTEM,
      messages: [{ role: 'user', content: blocks }],
    }),
  });

  const apiData = await apiRes.json();
  if (!apiRes.ok) return Response.json({ error: apiData.error?.message || 'Erreur API' }, { status: apiRes.status });

  const raw = apiData.content?.find(b => b.type === 'text')?.text || '';
  const parsed = extractJSON(raw);
  if (!parsed) return Response.json({ error: 'Analyse impossible' }, { status: 500 });

  const filename = pending.files.length === 1 ? pending.files[0].name : `${pending.files.length} fichiers`;
  const result = { id: Date.now(), uploadedAt: new Date().toISOString(), filename, ...parsed };
  // Ne sauvegarde pas encore — retourne pour révision par le nutritionniste
  return Response.json({ result });
}

// Nutritionniste confirme et envoie au patient
export async function PATCH(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  if (!auth.isViewAs) return Response.json({ error: 'Réservé au nutritionniste' }, { status: 403 });

  const { result } = await req.json();
  if (!result) return Response.json({ error: 'Résultat manquant' }, { status: 400 });

  const udb = userDb(auth.userId);
  const existing = await udb.get('bloodTests') || [];
  await udb.set('bloodTests', [result, ...existing].slice(0, 10));
  await udb.set('pendingBloodFiles', null);

  // Notification pour le patient
  const { db } = await import('../db');
  const users = await db.get('auth:users') || [];
  const coach = users.find(u => u.id === auth.coachId);
  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{
    id: Date.now(), date: new Date().toISOString(),
    coachName: coach?.name || 'Ton nutritionniste',
    type: 'bloodResult', read: false,
  }, ...notifs].slice(0, 20));

  // Push notification
  try {
    const { sendPushToUser } = await import('../push/send/route');
    await sendPushToUser(auth.userId, `🩺 ${coach?.name || 'Ton nutritionniste'}`, 'Ton bilan sanguin a été analysé', '/?tab=sante');
  } catch {}

  return Response.json({ ok: true });
}

// Supprimer les fichiers en attente
export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  await userDb(auth.userId).set('pendingBloodFiles', null);
  return Response.json({ ok: true });
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const SYSTEM = `Tu es un médecin nutritionniste expert en micronutrition.
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
      "cause": "Apports alimentaires insuffisants ou pertes élevées.",
      "foods": [
        {"name":"Boudin noir","quantity":"100g","frequency":"2×/semaine","tip":"Meilleure source de fer héminique","emoji":"🩸"}
      ],
      "synergy": "Consomme avec vitamine C pour doubler l'absorption.",
      "avoid": "Thé, café dans les 2h après le repas.",
      "supplements": "Bisglycinate de fer 25mg/j si alimentation insuffisante."
    }
  ],
  "recommendations": [
    {"type":"eat","food":"Épinards","reason":"Riche en fer et folates","emoji":"🥬"}
  ],
  "weeklyFocus": "Cette semaine : priorité fer et vitamine D.",
  "nextCheckup": "Refaire bilan fer + vitamine D dans 3 mois."
}

Règles :
- status marker : "ok" | "warn" | "bad"
- markerRecos : UNIQUEMENT pour les marqueurs warn ou bad
- recommendations : 6 à 10 items actionnables
- Sois précis sur les quantités, fréquences et synergies nutritionnelles`;
