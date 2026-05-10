import { db, userDb } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';

export const maxDuration = 60;

function calcAge(birthdate) {
  if (!birthdate) return null;
  return Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 3600 * 1000));
}

function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, users };
}

// Générer un programme alimentaire pour un athlète
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;

  const { athleteId, mealsPerDay = 4, preferences = '', avoidFoods = '', coachNotes = '', program: directProgram } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const athlete = v.users.find(u => u.id === athleteId);
  if (!athlete) return Response.json({ error: 'Athlète introuvable' }, { status: 404 });

  if (directProgram) {
    const program = { ...directProgram, id: Date.now(), generatedAt: new Date().toISOString(), status: 'draft', sentAt: null };
    const udb = userDb(athleteId);
    const existing = await udb.get('coachPrograms') || [];
    await udb.set('coachPrograms', [program, ...existing].slice(0, 5));
    return Response.json({ program });
  }

  const udb = userDb(athleteId);
  const dates = getLastNDates(14);

  const [settings, bloodTests, stravaCache] = await Promise.all([
    udb.get('userSettings').then(s => s || {}),
    udb.get('bloodTests').then(b => (b || []).slice(0, 1)),
    udb.get('stravaCache').then(s => s || null),
  ]);

  const allEntries = await Promise.all(dates.map(d => udb.get(`day:${d}`).then(e => ({ d, entries: e || [] }))));
  const active = allEntries.filter(x => x.entries.length > 0);

  const age = calcAge(settings.birthdate);
  const { sex, height, weight, goalKcal = 2000, goalProtein = 150, goalCarbs = 250, goalFat = 70, mode } = settings;

  const profileCtx = `Athlète : ${athlete.name}, ${sex || '?'}, ${age ? age + ' ans' : 'âge ?'}${height ? ', ' + height + ' cm' : ''}${weight ? ', ' + weight + ' kg' : ''}\nObjectif calorique : ${goalKcal} kcal/j · ${goalProtein}g protéines · ${goalCarbs}g glucides · ${goalFat}g lipides\nMode : ${mode || 'maintien'}`;

  let foodCtx = '';
  if (active.length > 0) {
    const foodCount = {};
    active.forEach(x => x.entries.forEach(e => { const n = (e.name || '').trim(); foodCount[n] = (foodCount[n] || 0) + 1; }));
    const top = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} (${c}×)`);
    foodCtx = `\nHabitudes alimentaires récentes (${active.length} jours) : ${top.join(', ') || '—'}`;
  }

  const bloodCtx = bloodTests.length > 0
    ? `\nBilan sanguin (${bloodTests[0].date || 'récent'}) : ${bloodTests[0].summary || '—'}\nMarqueurs anormaux : ${(bloodTests[0].markers || []).filter(m => m.status !== 'ok').map(m => `${m.name} ${m.value}${m.unit || ''} (${m.status})`).join(', ') || 'aucun'}`
    : '';

  const stravaCtx = stravaCache?.activities?.length > 0
    ? `\nActivité sportive (7j) : ${stravaCache.activities.length} séances — ${[...new Set(stravaCache.activities.map(a => a.typeLabel))].join(', ')}`
    : '';

  const prefsCtx = [
    preferences && `Préférences : ${preferences}`,
    avoidFoods && `Aliments à éviter : ${avoidFoods}`,
    coachNotes && `Notes du coach : ${coachNotes}`,
  ].filter(Boolean).join('\n');

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const MEAL_TYPES = mealsPerDay === 3
    ? ['Petit-déjeuner', 'Déjeuner', 'Dîner']
    : mealsPerDay === 4
    ? ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']
    : ['Petit-déjeuner', 'Collation matin', 'Déjeuner', 'Collation après-midi', 'Dîner'];

  const system = `Tu es un diététicien-nutritionniste expert. Génère un programme alimentaire hebdomadaire complet et personnalisé.
Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après. Aucun backtick.
Format exact :
{"days":[{"day":"Lundi","meals":[{"type":"Petit-déjeuner","items":[{"name":"Flocons d'avoine","quantity":"80g","kcal":290,"protein":10,"carbs":50,"fat":5}],"totalKcal":400,"totalProtein":15,"totalCarbs":60,"totalFat":8,"note":"Optionnel"}]}],"weeklyNotes":"Conseils généraux de la semaine."}
- 7 jours : ${DAYS.join(', ')}
- ${mealsPerDay} repas par jour : ${MEAL_TYPES.join(', ')}
- Adapte les quantités pour atteindre l'objectif calorique journalier
- Si bilan sanguin anormal : intègre des aliments correcteurs naturellement dans la semaine
- Varie les repas, évite les répétitions exactes
- Repas réalistes et accessibles, cuisine française/méditerranéenne`;

  const userMsg = `${profileCtx}${foodCtx}${bloodCtx}${stravaCtx}${prefsCtx ? '\n' + prefsCtx : ''}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 6000, system, messages: [{ role: 'user', content: userMsg }] }),
  });

  const apiData = await apiRes.json();
  if (!apiRes.ok) return Response.json({ error: apiData.error?.message }, { status: 500 });

  const raw = apiData.content?.find(b => b.type === 'text')?.text || '';
  const parsed = extractJSON(raw);
  if (!parsed) return Response.json({ error: 'Génération impossible' }, { status: 500 });

  const program = {
    id: Date.now(),
    generatedAt: new Date().toISOString(),
    mealsPerDay,
    preferences,
    avoidFoods,
    coachNotes,
    status: 'draft',
    sentAt: null,
    ...parsed,
  };

  // Sauvegarde côté athlète
  const existing = await udb.get('coachPrograms') || [];
  await udb.set('coachPrograms', [program, ...existing].slice(0, 5));

  // Push au coach
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    await sendPushToUser(v.coachId, `🥗 Programme prêt pour ${athlete.name}`, 'Reviens sur le tableau de bord pour réviser et envoyer', '/coach');
  } catch {}

  return Response.json({ program });
}

// Récupérer les programmes d'un athlète (coach)
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const programs = await userDb(athleteId).get('coachPrograms') || [];
  return Response.json({ programs });
}

// Envoyer le programme à l'athlète (changer status draft → sent)
export async function PATCH(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, programId } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const udb = userDb(athleteId);
  const programs = await udb.get('coachPrograms') || [];
  const updated = programs.map(p => p.id === programId ? { ...p, status: 'sent', sentAt: new Date().toISOString() } : p);
  await udb.set('coachPrograms', updated);

  // Push notification
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    const coach = v.users.find(u => u.id === v.coachId);
    await sendPushToUser(athleteId, `🥗 ${coach?.name || 'Ton nutritionniste'}`, 'Ton plan nutritionnel est prêt !', '/?tab=programme');
  } catch {}

  // Notification pour l'athlète
  const coach = v.users.find(u => u.id === v.coachId);
  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{
    id: Date.now(), date: new Date().toISOString(),
    coachName: coach?.name || 'Ton coach',
    type: 'program', read: false,
  }, ...notifs].slice(0, 20));

  return Response.json({ ok: true });
}
