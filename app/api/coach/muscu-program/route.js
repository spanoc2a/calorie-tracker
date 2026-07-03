import { db, userDb } from '../../../api/db';
import { getUser } from '../../users';
import { requireAuth } from '../../../api/auth/session';
import { getHealthContext, buildStravaContext } from '../../../lib/healthContext';
import { exerciseNamesFor } from '../../../lib/exerciseNames';
import { detectLang, getUserLang, LANG_NAMES } from '../../../lib/lang';
import { pushText } from '../../../lib/pushTexts';

export const maxDuration = 120;

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

export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, daysPerWeek = 3, goal = 'prise de masse', level = 'intermédiaire', equipment = 'salle', preferences = '', program: directProgram } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const athlete = await getUser(athleteId);
  if (!athlete) return Response.json({ error: 'Athlète introuvable' }, { status: 404 });

  let program;

  if (directProgram) {
    program = { ...directProgram, id: Date.now(), generatedAt: new Date().toISOString(), status: 'draft', sentAt: null };
  } else {
    const [settings, stravaCache] = await Promise.all([
      userDb(athleteId).get('userSettings').then(s => s || {}),
      userDb(athleteId).get('stravaCache').then(s => s || null),
    ]);
    const { sex, weight, height } = settings;

    // Langue de génération = celle de l'ATHLÈTE destinataire du programme.
    const athleteLang = (settings.lang === 'en' || settings.lang === 'es') ? settings.lang : 'fr';
    // Vocabulaire de contrainte des exercices : FR canonique (démos mobiles) ou EN.
    const exerciseNames = exerciseNamesFor(athleteLang);

    const profileCtx = [`Athlète : ${athlete.name}`, sex && `Sexe : ${sex}`, weight && `Poids : ${weight} kg`, height && `Taille : ${height} cm`].filter(Boolean).join(', ');

    const DAYS_MAP_FR = { 2:['Lundi','Jeudi'], 3:['Lundi','Mercredi','Vendredi'], 4:['Lundi','Mardi','Jeudi','Vendredi'], 5:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], 6:['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'] };
    const DAYS_MAP_EN = { 2:['Monday','Thursday'], 3:['Monday','Wednesday','Friday'], 4:['Monday','Tuesday','Thursday','Friday'], 5:['Monday','Tuesday','Wednesday','Thursday','Friday'], 6:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] };
    const DAYS_MAP_ES = { 2:['Lunes','Jueves'], 3:['Lunes','Miércoles','Viernes'], 4:['Lunes','Martes','Jueves','Viernes'], 5:['Lunes','Martes','Miércoles','Jueves','Viernes'], 6:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'] };
    const DAYS_MAP = athleteLang === 'en' ? DAYS_MAP_EN : athleteLang === 'es' ? DAYS_MAP_ES : DAYS_MAP_FR;
    const trainingDays = DAYS_MAP[daysPerWeek] || DAYS_MAP[3];

    const system = `Tu es un coach sportif expert en musculation. Génère un programme d'entraînement hebdomadaire personnalisé.
Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après. Aucun backtick.
Format exact :
{"days":[{"day":"Lundi","label":"Push – Pectoraux/Épaules/Triceps","exercises":[{"name":"Développé couché","sets":4,"reps":"8-10","rest":"90s","note":"Contrôle excentrique"}]}],"weeklyNotes":"Conseils généraux."}
- Jours d'entraînement : ${trainingDays.join(', ')} (${daysPerWeek} séances/semaine)
- Objectif : ${goal}
- Niveau : ${level}
- Matériel : ${equipment}
- 5 à 7 exercices par séance
- Répartition intelligente des groupes musculaires
- Exercices avec nom précis, sets, reps, temps de repos, note technique si pertinent${athleteLang !== 'fr' ? `\n- IMPORTANT: Write ALL text fields (day, label, notes, weeklyNotes) in ${LANG_NAMES[athleteLang] || 'English'}.` : ''}
- Pour le nom de chaque exercice, utilise EXCLUSIVEMENT un nom de cette liste (recopié à l'identique) : ${exerciseNames.join(', ')}`;

    const stravaCtx = buildStravaContext(stravaCache, { periodLabel: '7j' });
    const stravaInstr = stravaCtx
      ? `\nIMPORTANT — tiens compte de la charge cardio/endurance RÉELLE ci-dessus (séances Strava) en plus de la muscu : si la charge d'entraînement (suffer_score) est élevée ou le volume cardio important, module le volume/intensité muscu et planifie la récupération en conséquence ; si la charge est faible, marge pour intensifier. Place les séances exigeantes loin des grosses sorties cardio. N'invente AUCUNE donnée absente.`
      : '';

    const userMsg = [profileCtx, `Objectif : ${goal}`, `Niveau : ${level}`, `Matériel : ${equipment}`, preferences && `Préférences/contraintes : ${preferences}`].filter(Boolean).join('\n') + stravaCtx + stravaInstr + (await getHealthContext(athleteId));

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

    program = { id: Date.now(), generatedAt: new Date().toISOString(), daysPerWeek, goal, level, equipment, preferences, status: 'draft', sentAt: null, ...parsed };
  }

  const udb = userDb(athleteId);
  const existing = await udb.get('coachMuscuPrograms') || [];
  await udb.set('coachMuscuPrograms', [program, ...existing].slice(0, 5));

  // Push au coach (destinataire = le coach appelant → langue de sa requête)
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    const coachLang = detectLang(req);
    await sendPushToUser(v.coachId, pushText(coachLang, 'muscu_draft_ready_title', { name: athlete.name }), pushText(coachLang, 'draft_ready_body'), '/coach');
  } catch {}

  return Response.json({ program });
}

// Récupérer les programmes muscu d'un athlète (coach) — pour afficher le programme actuel.
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { searchParams } = new URL(req.url);
  const athleteId = searchParams.get('athleteId');
  if (!athleteId) return Response.json({ error: 'athleteId manquant' }, { status: 400 });

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const programs = await userDb(athleteId).get('coachMuscuPrograms') || [];
  return Response.json({ programs });
}

export async function PATCH(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  // `program` optionnel : contenu édité par le coach, persisté au moment de l'envoi.
  const { athleteId, programId, program: edited } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const udb = userDb(athleteId);
  const programs = await udb.get('coachMuscuPrograms') || [];
  const updated = programs.map(p => p.id === programId
    ? { ...p, ...(edited || {}), id: p.id, status: 'sent', sentAt: new Date().toISOString() }
    : p);
  await udb.set('coachMuscuPrograms', updated);

  const coach = v.me;
  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{ id: Date.now(), date: new Date().toISOString(), coachName: coach?.name || 'Ton coach', type: 'muscuProgram', read: false }, ...notifs].slice(0, 20));

  // Push notification — langue du DESTINATAIRE (l'élève).
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    const { sendExpoPushToUser } = await import('../../../lib/expoPush');
    const title = `💪 ${coach?.name || 'Ton coach'}`;
    const body = pushText(await getUserLang(athleteId), 'coach_muscu_sent_body');
    await Promise.all([
      sendPushToUser(athleteId, title, body, '/?tab=programme'),
      sendExpoPushToUser(athleteId, title, body, { type: 'coach_muscu' }),
    ]);
  } catch {}

  return Response.json({ ok: true });
}
