import { db, userDb } from '../../../api/db';
import { getUser } from '../../users';
import { requireAuth } from '../../../api/auth/session';
import { getHealthContext, buildStravaContext } from '../../../lib/healthContext';

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
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, me };
}

// Générer un programme alimentaire pour un athlète
export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;

  const { athleteId, mainMeals = 3, snacks = 1, preferences = '', avoidFoods = '', coachNotes = '', program: directProgram } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const athlete = await getUser(athleteId);
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
  const { sex, height, weight, goalKcal = 2000, goalProtein = 150, goalCarbs = 250, goalFat = 70, mode, healthHistory = '' } = settings;

  const profileCtx = `Athlète : ${athlete.name}, ${sex || '?'}, ${age ? age + ' ans' : 'âge ?'}${height ? ', ' + height + ' cm' : ''}${weight ? ', ' + weight + ' kg' : ''}\nObjectif calorique : ${goalKcal} kcal/j · ${goalProtein}g protéines · ${goalCarbs}g glucides · ${goalFat}g lipides\nMode : ${mode || 'maintien'}${healthHistory ? `\nHistorique de santé IMPORTANT — adapter obligatoirement le programme : ${healthHistory}` : ''}`;

  let foodCtx = '';
  if (active.length > 0) {
    const foodCount = {};
    active.forEach(x => x.entries.forEach(e => { const n = (e.name || '').trim(); foodCount[n] = (foodCount[n] || 0) + 1; }));
    const top = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} (${c}×)`);
    foodCtx = `\nHabitudes alimentaires récentes (${active.length} jours) : ${top.join(', ') || '—'}`;
  }

  const blood = bloodTests[0] || null;
  const bloodCtx = blood
    ? `\nBilan sanguin (${blood.date || 'récent'}) : ${blood.summary || '—'}\nMarqueurs anormaux : ${(blood.markers || []).filter(m => m.status !== 'ok').map(m => `${m.name} ${m.value}${m.unit || ''} (${m.status})`).join(', ') || 'aucun'}${blood.weeklyFocus ? `\nFocus correctif : ${blood.weeklyFocus}` : ''}${(blood.markerRecos || []).length > 0 ? `\nAliments correcteurs à intégrer obligatoirement dans le programme :\n${blood.markerRecos.map(r => `- ${r.marker} : ${(r.foods||[]).map(f=>`${f.name} (${f.quantity}, ${f.frequency})`).join(', ')}${r.synergy ? ` — Synergie: ${r.synergy}` : ''}${r.avoid ? ` — Éviter avec: ${r.avoid}` : ''}`).join('\n')}` : ''}`
    : '';

  const stravaCtx = buildStravaContext(stravaCache, { sinceDate: dates[dates.length - 1], periodLabel: '14j' });
  const stravaInstr = stravaCtx
    ? `\nIMPORTANT — adapte le programme à la dépense et à la charge sportives RÉELLES ci-dessus : intègre la dépense énergétique sport (caloriesAdjusted) dans la répartition calorique (jours actifs = plus de glucides/calories), et tiens compte de la charge (suffer_score) : charge élevée → privilégie récupération, glucides de qualité et protéines ; charge faible → marge. N'invente AUCUNE donnée absente.`
    : '';

  const prefsCtx = [
    preferences && `Préférences : ${preferences}`,
    avoidFoods && `Aliments à éviter : ${avoidFoods}`,
    coachNotes && `Notes du coach : ${coachNotes}`,
  ].filter(Boolean).join('\n');

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const MAIN = mainMeals === 2 ? ['Petit-déjeuner', 'Dîner']
    : mainMeals === 3 ? ['Petit-déjeuner', 'Déjeuner', 'Dîner']
    : mainMeals === 4 ? ['Petit-déjeuner', 'Déjeuner', 'Goûter', 'Dîner']
    : ['Petit-déjeuner', 'Brunch', 'Déjeuner', 'Goûter', 'Dîner'];

  const SNACK_NAMES = ['Collation matin', 'Collation après-midi', 'Collation soirée'];
  const SNACK_LIST = SNACK_NAMES.slice(0, snacks);

  const MEAL_TYPES = [];
  MEAL_TYPES.push(MAIN[0]);
  if (snacks >= 1) MEAL_TYPES.push('Collation matin');
  if (MAIN[1]) MEAL_TYPES.push(MAIN[1]);
  if (snacks >= 2) MEAL_TYPES.push('Collation après-midi');
  if (MAIN[2]) MEAL_TYPES.push(MAIN[2]);
  if (snacks >= 3) MEAL_TYPES.push('Collation soirée');
  if (MAIN[3]) MEAL_TYPES.push(MAIN[3]);
  if (MAIN[4]) MEAL_TYPES.push(MAIN[4]);

  const mealsPerDay = MEAL_TYPES.length;

  const system = `Tu es un diététicien-nutritionniste expert. Génère un programme alimentaire hebdomadaire complet et personnalisé.
Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après. Aucun backtick.
Format exact :
{"days":[{"day":"Lundi","meals":[{"type":"Petit-déjeuner","items":[{"name":"Flocons d'avoine","quantity":"80g","kcal":290,"protein":10,"carbs":50,"fat":5}],"totalKcal":400,"totalProtein":15,"totalCarbs":60,"totalFat":8,"note":"Optionnel"}]}],"weeklyNotes":"Conseils généraux de la semaine."}
- 7 jours : ${DAYS.join(', ')}
- ${mealsPerDay} moments alimentaires par jour dans cet ordre : ${MEAL_TYPES.join(', ')}
- Repas principaux (${MAIN.join(', ')}) : repas complets et équilibrés, riches en protéines, légumes, féculents
- Collations (${SNACK_LIST.length > 0 ? SNACK_LIST.join(', ') : 'aucune'}) : légers et nutritifs — fruits, yaourt grec, fromage blanc, oléagineux, smoothie protéiné
- Adapte les quantités pour atteindre l'objectif calorique journalier
- Si bilan sanguin anormal : intègre des aliments correcteurs
- Varie les repas, évite les répétitions exactes
- Cuisine méditerranéenne, ingrédients simples et accessibles`;

  const healthCtx = await getHealthContext(athleteId);
  const userMsg = `${profileCtx}${foodCtx}${bloodCtx}${stravaCtx}${stravaInstr}${prefsCtx ? '\n' + prefsCtx : ''}${healthCtx}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 10000, system, messages: [{ role: 'user', content: userMsg }] }),
  });

  const apiData = await apiRes.json();
  if (!apiRes.ok) return Response.json({ error: apiData.error?.message }, { status: 500 });

  const raw = apiData.content?.find(b => b.type === 'text')?.text || '';
  const parsed = extractJSON(raw);
  if (!parsed) return Response.json({ error: 'Génération impossible' }, { status: 500 });

  const program = {
    id: Date.now(),
    generatedAt: new Date().toISOString(),
    mainMeals,
    snacks,
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
  // `program` optionnel : contenu édité par le coach, persisté au moment de l'envoi.
  const { athleteId, programId, program: edited } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const udb = userDb(athleteId);
  const programs = await udb.get('coachPrograms') || [];
  const updated = programs.map(p => p.id === programId
    ? { ...p, ...(edited || {}), id: p.id, status: 'sent', sentAt: new Date().toISOString() }
    : p);
  await udb.set('coachPrograms', updated);

  // Push notification
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    const { sendExpoPushToUser } = await import('../../../lib/expoPush');
    const coach = v.me;
    const title = `🥗 ${coach?.name || 'Ton nutritionniste'}`;
    const body = 'Ton plan nutritionnel est prêt !';
    await Promise.all([
      sendPushToUser(athleteId, title, body, '/?tab=programme'),
      sendExpoPushToUser(athleteId, title, body, { type: 'coach_program' }),
    ]);
  } catch {}

  // Notification pour l'athlète
  const coach = v.me;
  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{
    id: Date.now(), date: new Date().toISOString(),
    coachName: coach?.name || 'Ton coach',
    type: 'program', read: false,
  }, ...notifs].slice(0, 20));

  return Response.json({ ok: true });
}
