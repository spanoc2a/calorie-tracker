import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { checkMuscuProgramLimit, incrementProgramUsage, upgradeResponse } from '../../lib/planServer';
import { sendExpoPushToUser } from '../../lib/expoPush';
import { getHealthContext, buildStravaContext } from '../../lib/healthContext';
import { rateLimit } from '../../lib/ratelimit';

export const maxDuration = 120;

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
    userDb(auth.userId).get('muscuProgram'),
    checkMuscuProgramLimit(auth.userId),
  ]);
  const remaining = (access.count != null && access.limit != null && access.limit !== Infinity)
    ? access.limit - access.count
    : null;
  return Response.json({ program: program || null, ...(remaining != null ? { remaining } : {}) });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req); if (auth.error) return auth.error;
    const allowed = await rateLimit(`muscu-program:${auth.userId}`, 20, 3_600_000);
    if (!allowed) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 });
    // Élève rattaché à un coach : la génération est gérée par le coach (anti court-circuit),
    // sauf si le coach a explicitement autorisé l'autonomie (défaut = refusé, règle IA-invisible).
    const coachIdGate = await userDb(auth.userId).get('coachId');
    if (coachIdGate) {
      const gateSettings = await userDb(auth.userId).get('userSettings') || {};
      if (gateSettings.selfMuscuAllowed !== true) {
        return Response.json({ error: 'COACH_MANAGED', message: "Ton coach gère ton programme d'entraînement." }, { status: 403 });
      }
    }
    const access = await checkMuscuProgramLimit(auth.userId);
    if (!access.allowed) return access.limitLabel
      ? Response.json({ error: 'PROGRAM_LIMIT', limitLabel: access.limitLabel }, { status: 429 })
      : upgradeResponse('program');
    const lang = detectLang(req);
    const unitSystem = detectUnitSystem(req);
    const udb = userDb(auth.userId);
    const { daysPerWeek = 3, goal = 'prise de masse', level = 'intermédiaire', preferences = '', equipment = 'salle' } = await req.json();

    const [settings, stravaCache] = await Promise.all([
      udb.get('userSettings').then(s => s || {}),
      udb.get('stravaCache').then(s => s || null),
    ]);
    const { sex, weight, height } = settings;

    const profileCtx = [
      sex && `Sexe : ${sex}`,
      weight && `Poids : ${weight} kg`,
      height && `Taille : ${height} cm`,
    ].filter(Boolean).join(', ');

    const DAYS_MAP_FR = { 2:['Lundi','Jeudi'], 3:['Lundi','Mercredi','Vendredi'], 4:['Lundi','Mardi','Jeudi','Vendredi'], 5:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], 6:['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'] };
    const DAYS_MAP_EN = { 2:['Monday','Thursday'], 3:['Monday','Wednesday','Friday'], 4:['Monday','Tuesday','Thursday','Friday'], 5:['Monday','Tuesday','Wednesday','Thursday','Friday'], 6:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] };
    const DAYS_MAP_ES = { 2:['Lunes','Jueves'], 3:['Lunes','Miércoles','Viernes'], 4:['Lunes','Martes','Jueves','Viernes'], 5:['Lunes','Martes','Miércoles','Jueves','Viernes'], 6:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'] };
    const DAYS_MAP = lang === 'en' ? DAYS_MAP_EN : lang === 'es' ? DAYS_MAP_ES : DAYS_MAP_FR;
    const trainingDays = DAYS_MAP[daysPerWeek] || DAYS_MAP[3];

    const langInstr = lang !== 'fr' ? `\nIMPORTANT: Write ALL text fields (day, label, exercise names, notes, weeklyNotes) in ${LANG_NAMES[lang] || 'English'}.` : '';
    const system = `Tu es un coach sportif expert en musculation. Génère un programme d'entraînement hebdomadaire personnalisé.
Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après. Aucun backtick.
Format exact :
{"days":[{"day":"Lundi","label":"Push – Pectoraux/Épaules/Triceps","exercises":[{"name":"Développé couché","sets":4,"reps":"8-10","rest":"90s","note":"Contrôle excentrique"}]}],"weeklyNotes":"Conseils généraux sur le programme."}
- Jours d'entraînement : ${trainingDays.join(', ')} (${daysPerWeek} séances/semaine)
- Objectif : ${goal}
- Niveau : ${level}
- Matériel : ${equipment}
- 5 à 7 exercices par séance
- Inclure échauffement implicite dans les notes si pertinent
- Répartition intelligente des groupes musculaires selon le nombre de séances
- Exercices avec nom précis, sets, reps (peut être une fourchette), temps de repos
- Note optionnelle par exercice pour les points techniques importants
- weeklyNotes : conseils sur la progression, récupération, nutrition autour des séances${langInstr}${unitSystemInstr(unitSystem)}`;

    const stravaCtx = buildStravaContext(stravaCache, { periodLabel: '7j' });
    const stravaInstr = stravaCtx
      ? `\nIMPORTANT — tiens compte de la charge cardio/endurance RÉELLE ci-dessus (séances Strava) en plus de la muscu : si la charge d'entraînement (suffer_score) est élevée ou le volume cardio important, module le volume/intensité muscu et planifie la récupération en conséquence ; si la charge est faible, marge pour intensifier. Place les séances exigeantes loin des grosses sorties cardio. N'invente AUCUNE donnée absente.`
      : '';

    const userMsg = [
      profileCtx && `Profil : ${profileCtx}`,
      `Objectif : ${goal}`,
      `Niveau : ${level}`,
      `Matériel disponible : ${equipment}`,
      preferences && `Préférences/contraintes : ${preferences}`,
    ].filter(Boolean).join('\n') + stravaCtx + stravaInstr + (await getHealthContext(auth.userId));

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 6000, system, messages: [{ role: 'user', content: userMsg }] }),
    });

    const apiData = await apiRes.json();
    if (!apiRes.ok) return Response.json({ error: apiData.error?.message }, { status: 500 });

    const raw = apiData.content?.find(b => b.type === 'text')?.text || '';
    const parsed = extractJSON(raw);
    if (!parsed) return Response.json({ error: 'Génération impossible, réessaie.' }, { status: 500 });

    const program = { id: Date.now(), generatedAt: new Date().toISOString(), daysPerWeek, goal, level, equipment, preferences, ...parsed };
    await Promise.all([
      udb.set('muscuProgram', program),
      incrementProgramUsage(auth.userId, access.usageKey),
    ]);
    sendExpoPushToUser(auth.userId, '⚡ Programme muscu généré !', "Ton plan d'entraînement est prêt.", { type: 'program_ready', programType: 'muscu' });

    const remaining = access.limit != null && access.limit !== Infinity ? access.limit - (access.count || 0) - 1 : null;
    return Response.json({ program, ...(remaining != null ? { remaining } : {}) });
  } catch (e) {
    console.error('muscu-program error:', e);
    return Response.json({ error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { program } = await req.json();
  if (!program) return Response.json({ error: 'Programme manquant' }, { status: 400 });
  await userDb(auth.userId).set('muscuProgram', program);
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  await userDb(auth.userId).set('muscuProgram', null);
  return Response.json({ ok: true });
}
