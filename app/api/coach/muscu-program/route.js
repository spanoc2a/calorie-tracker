import { db, userDb } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';

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
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId, users };
}

export async function POST(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, daysPerWeek = 3, goal = 'prise de masse', level = 'intermédiaire', equipment = 'salle', preferences = '', program: directProgram } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const athlete = v.users.find(u => u.id === athleteId);
  if (!athlete) return Response.json({ error: 'Athlète introuvable' }, { status: 404 });

  let program;

  if (directProgram) {
    program = { ...directProgram, id: Date.now(), generatedAt: new Date().toISOString(), status: 'draft', sentAt: null };
  } else {
    const settings = await userDb(athleteId).get('userSettings').then(s => s || {});
    const { sex, weight, height } = settings;

    const profileCtx = [`Athlète : ${athlete.name}`, sex && `Sexe : ${sex}`, weight && `Poids : ${weight} kg`, height && `Taille : ${height} cm`].filter(Boolean).join(', ');

    const DAYS_MAP = { 2:['Lundi','Jeudi'], 3:['Lundi','Mercredi','Vendredi'], 4:['Lundi','Mardi','Jeudi','Vendredi'], 5:['Lundi','Mardi','Mercredi','Jeudi','Vendredi'], 6:['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'] };
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
- Exercices avec nom précis, sets, reps, temps de repos, note technique si pertinent`;

    const userMsg = [profileCtx, `Objectif : ${goal}`, `Niveau : ${level}`, `Matériel : ${equipment}`, preferences && `Préférences/contraintes : ${preferences}`].filter(Boolean).join('\n');

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

  // Push au coach
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    await sendPushToUser(v.coachId, `💪 Programme muscu prêt pour ${athlete.name}`, 'Reviens sur le tableau de bord pour réviser et envoyer', '/coach');
  } catch {}

  return Response.json({ program });
}

export async function PATCH(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const { athleteId, programId } = await req.json();

  const athleteIds = await db.get(`coach:${v.coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const udb = userDb(athleteId);
  const programs = await udb.get('coachMuscuPrograms') || [];
  const updated = programs.map(p => p.id === programId ? { ...p, status: 'sent', sentAt: new Date().toISOString() } : p);
  await udb.set('coachMuscuPrograms', updated);

  const coach = v.users.find(u => u.id === v.coachId);
  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{ id: Date.now(), date: new Date().toISOString(), coachName: coach?.name || 'Ton coach', type: 'muscuProgram', read: false }, ...notifs].slice(0, 20));

  // Push notification
  try {
    const { sendPushToUser } = await import('../../push/send/route');
    await sendPushToUser(athleteId, `💪 ${coach?.name || 'Ton coach'}`, 'Ton programme de musculation est prêt !', '/?tab=programme');
  } catch {}

  return Response.json({ ok: true });
}
