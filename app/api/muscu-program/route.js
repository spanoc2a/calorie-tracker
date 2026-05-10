import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { checkMuscuProgramLimit, incrementProgramUsage, upgradeResponse } from '../../lib/planServer';

export const maxDuration = 120;

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const program = await userDb(auth.userId).get('muscuProgram') || null;
  return Response.json({ program });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req); if (auth.error) return auth.error;
    const access = await checkMuscuProgramLimit(auth.userId);
    if (!access.allowed) return access.limitLabel
      ? Response.json({ error: 'PROGRAM_LIMIT', limitLabel: access.limitLabel }, { status: 429 })
      : upgradeResponse('program');
    const udb = userDb(auth.userId);
    const { daysPerWeek = 3, goal = 'prise de masse', level = 'intermédiaire', preferences = '', equipment = 'salle' } = await req.json();

    const settings = await udb.get('userSettings').then(s => s || {});
    const { sex, weight, height } = settings;

    const profileCtx = [
      sex && `Sexe : ${sex}`,
      weight && `Poids : ${weight} kg`,
      height && `Taille : ${height} cm`,
    ].filter(Boolean).join(', ');

    const DAYS_MAP = {
      2: ['Lundi', 'Jeudi'],
      3: ['Lundi', 'Mercredi', 'Vendredi'],
      4: ['Lundi', 'Mardi', 'Jeudi', 'Vendredi'],
      5: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'],
      6: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    };
    const trainingDays = DAYS_MAP[daysPerWeek] || DAYS_MAP[3];

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
- weeklyNotes : conseils sur la progression, récupération, nutrition autour des séances`;

    const userMsg = [
      profileCtx && `Profil : ${profileCtx}`,
      `Objectif : ${goal}`,
      `Niveau : ${level}`,
      `Matériel disponible : ${equipment}`,
      preferences && `Préférences/contraintes : ${preferences}`,
    ].filter(Boolean).join('\n');

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

    return Response.json({ program, usage: { count: (access.count || 0) + 1, limit: access.limit } });
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
