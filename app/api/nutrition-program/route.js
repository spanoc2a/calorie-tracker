import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { checkProgramLimit, incrementProgramUsage, upgradeResponse } from '../../lib/planServer';
import { sendExpoPushToUser } from '../../lib/expoPush';
import { getHealthContext, buildStravaContext } from '../../lib/healthContext';
import { rateLimit } from '../../lib/ratelimit';

export const maxDuration = 300;

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

function detectUnitSystem(req) {
  const h = req.headers.get('x-unit-system') || '';
  return h === 'imperial' ? 'imperial' : 'metric';
}

function unitSystemInstr(unitSystem) {
  if (unitSystem !== 'imperial') return '';
  return '\nIMPORTANT: Display all weights in lbs (1 kg = 2.205 lbs), heights in feet/inches, and distances in miles in the report text. Do the conversions yourself.';
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  return Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 3600 * 1000));
}

function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  });
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const [program, access] = await Promise.all([
    userDb(auth.userId).get('nutritionProgram'),
    checkProgramLimit(auth.userId),
  ]);
  const remaining = (access.count != null && access.limit != null && access.limit !== Infinity)
    ? access.limit - access.count
    : null;
  return Response.json({ program: program || null, ...(remaining != null ? { remaining } : {}) });
}

export async function POST(req) {
  try {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const allowed = await rateLimit(`nutrition-program:${auth.userId}`, 20, 3_600_000);
  if (!allowed) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 });
  // Élève rattaché à un coach : la génération est gérée par le coach (anti court-circuit).
  if (await userDb(auth.userId).get('coachId')) return Response.json({ error: 'COACH_MANAGED', message: 'Ton coach gère ton programme nutritionnel.' }, { status: 403 });
  const access = await checkProgramLimit(auth.userId);
  if (!access.allowed) return access.limitLabel
    ? Response.json({ error: 'PROGRAM_LIMIT', limitLabel: access.limitLabel }, { status: 429 })
    : upgradeResponse('program');
  const lang = detectLang(req);
  const unitSystem = detectUnitSystem(req);
  const udb = userDb(auth.userId);
  const { mainMeals = 3, snacks = 1, preferences = '', avoidFoods = '' } = await req.json();

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

  const profileCtx = `Profil : ${sex || '?'}, ${age ? age + ' ans' : 'âge ?'}${height ? ', ' + height + ' cm' : ''}${weight ? ', ' + weight + ' kg' : ''}
Objectif calorique : ${goalKcal} kcal/j · ${goalProtein}g protéines · ${goalCarbs}g glucides · ${goalFat}g lipides
Mode : ${mode || 'maintien'}${healthHistory ? `\nHistorique de santé IMPORTANT — adapter obligatoirement le programme : ${healthHistory}` : ''}`;

  let foodCtx = '';
  if (active.length > 0) {
    const foodCount = {};
    active.forEach(x => x.entries.forEach(e => { const n = (e.name || '').trim(); foodCount[n] = (foodCount[n] || 0) + 1; }));
    const top = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} (${c}×)`);
    foodCtx = `\nHabitudes récentes (${active.length} jours actifs) : ${top.join(', ') || '—'}`;
  }

  const blood = bloodTests[0] || null;
  const bloodCtx = blood
    ? `\nBilan sanguin : ${blood.summary || '—'}\nMarqueurs anormaux : ${(blood.markers || []).filter(m => m.status !== 'ok').map(m => `${m.name} ${m.value}${m.unit || ''} (${m.status})`).join(', ') || 'aucun'}${blood.weeklyFocus ? `\nFocus correctif : ${blood.weeklyFocus}` : ''}${(blood.markerRecos || []).length > 0 ? `\nAliments correcteurs à intégrer obligatoirement dans le programme :\n${blood.markerRecos.map(r => `- ${r.marker} : ${(r.foods||[]).map(f=>`${f.name} (${f.quantity}, ${f.frequency})`).join(', ')}${r.synergy ? ` — Synergie: ${r.synergy}` : ''}${r.avoid ? ` — Éviter avec: ${r.avoid}` : ''}`).join('\n')}` : ''}`
    : '';

  const stravaCtx = buildStravaContext(stravaCache, { sinceDate: dates[dates.length - 1], periodLabel: '14j' });
  const stravaInstr = stravaCtx
    ? `\nIMPORTANT — adapte le programme à la dépense et à la charge sportives RÉELLES ci-dessus : intègre la dépense énergétique sport (caloriesAdjusted) dans la répartition calorique (jours actifs = plus de glucides/calories), et tiens compte de la charge (suffer_score) : charge élevée → privilégie récupération, glucides de qualité et protéines ; charge faible → marge. N'invente AUCUNE donnée absente.`
    : '';

  const prefsCtx = [
    preferences && `Préférences : ${preferences}`,
    avoidFoods && `Aliments à éviter : ${avoidFoods}`,
  ].filter(Boolean).join('\n');

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const ALL_MAINS = ['Petit-déjeuner', 'Brunch', 'Déjeuner', 'Goûter', 'Dîner'];
  const MAIN = mainMeals === 2 ? ['Petit-déjeuner', 'Dîner']
    : mainMeals === 3 ? ['Petit-déjeuner', 'Déjeuner', 'Dîner']
    : mainMeals === 4 ? ['Petit-déjeuner', 'Déjeuner', 'Goûter', 'Dîner']
    : ['Petit-déjeuner', 'Brunch', 'Déjeuner', 'Goûter', 'Dîner'];

  const SNACK_NAMES = ['Collation matin', 'Collation après-midi', 'Collation soirée'];
  const SNACK_LIST = SNACK_NAMES.slice(0, snacks);

  // Intercaler les collations intelligemment selon le nombre de repas
  const MEAL_TYPES = [];
  MEAL_TYPES.push(MAIN[0]);
  if (snacks >= 1) MEAL_TYPES.push('Collation matin');
  if (MAIN[1]) MEAL_TYPES.push(MAIN[1]);
  if (snacks >= 2) MEAL_TYPES.push('Collation après-midi');
  if (MAIN[2]) MEAL_TYPES.push(MAIN[2]);
  if (snacks >= 3) MEAL_TYPES.push('Collation soirée');
  if (MAIN[3]) MEAL_TYPES.push(MAIN[3]);
  if (MAIN[4]) MEAL_TYPES.push(MAIN[4]);

  const langInstr = lang !== 'fr' ? `\nIMPORTANT: Generate the entire program in ${LANG_NAMES[lang] || 'English'} — food names, notes, and weeklyNotes must all be in ${LANG_NAMES[lang] || 'English'}.` : '';
  const system = `Tu es un diététicien-nutritionniste expert. Génère un programme alimentaire hebdomadaire complet et personnalisé.
Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après. Aucun backtick.
Format exact :
{"days":[{"day":"Lundi","meals":[{"type":"Petit-déjeuner","items":[{"name":"Flocons d'avoine","quantity":"80g","kcal":290,"protein":10,"carbs":50,"fat":5}],"totalKcal":400,"totalProtein":15,"totalCarbs":60,"totalFat":8,"note":"Optionnel"}]}],"weeklyNotes":"Conseils généraux."}
- 7 jours : ${DAYS.join(', ')}
- ${MEAL_TYPES.length} moments alimentaires par jour dans cet ordre : ${MEAL_TYPES.join(', ')}
- Repas principaux (${MAIN.join(', ')}) : repas complets et équilibrés, riches en protéines, légumes, féculents
- Collations (${SNACK_LIST.length > 0 ? SNACK_LIST.join(', ') : 'aucune'}) : légers et nutritifs — fruits, yaourt grec, fromage blanc, oléagineux, smoothie protéiné, compote, barre céréales maison, rice cake… PAS de repas complets
- Adapte les quantités pour atteindre l'objectif calorique journalier réparti intelligemment
- Si bilan sanguin anormal : intègre des aliments correcteurs
- Varie les repas d'un jour à l'autre, évite les répétitions exactes
- Cuisine méditerranéenne, ingrédients simples et accessibles${langInstr}${unitSystemInstr(unitSystem)}`;

  const mealsPerDay = MEAL_TYPES.length;

  const healthCtx = await getHealthContext(auth.userId);
  const userMsg = `${profileCtx}${foodCtx}${bloodCtx}${stravaCtx}${stravaInstr}${prefsCtx ? '\n' + prefsCtx : ''}${healthCtx}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 10000, system, messages: [{ role: 'user', content: userMsg }] }),
  });

  const apiData = await apiRes.json();
  if (!apiRes.ok) return Response.json({ error: apiData.error?.message }, { status: 500 });

  const stopReason = apiData.stop_reason || '';
  const raw = apiData.content?.find(b => b.type === 'text')?.text || '';
  const parsed = extractJSON(raw);
  if (!parsed) return Response.json({ error: `Génération impossible (stop: ${stopReason}, longueur: ${raw.length}) — réessaie.` }, { status: 500 });

  const program = { id: Date.now(), generatedAt: new Date().toISOString(), mainMeals, snacks, mealsPerDay, preferences, avoidFoods, ...parsed };
  await Promise.all([
    udb.set('nutritionProgram', program),
    incrementProgramUsage(auth.userId, access.usageKey),
  ]);
  sendExpoPushToUser(auth.userId, '⚡ Programme nutritionnel généré !', 'Ton plan alimentaire est prêt.', { type: 'program_ready', programType: 'nutrition' });

  const remaining = access.limit != null && access.limit !== Infinity ? access.limit - (access.count || 0) - 1 : null;
  return Response.json({ program, ...(remaining != null ? { remaining } : {}) });
  } catch(e) {
    console.error('nutrition-program error:', e);
    return Response.json({ error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(req) {
  // Sauvegarde après édition manuelle
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { program } = await req.json();
  if (!program) return Response.json({ error: 'Programme manquant' }, { status: 400 });
  await userDb(auth.userId).set('nutritionProgram', program);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  await userDb(auth.userId).set('nutritionProgram', null);
  return Response.json({ ok: true });
}
