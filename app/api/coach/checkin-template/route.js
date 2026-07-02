import { userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';

// Template par défaut = l'équivalent exact du formulaire de check-in historique.
// Exporté : /api/checkin l'utilise pour les élèves dont le coach n'a rien personnalisé
// (ou qui n'ont pas de coach).
export const DEFAULT_CHECKIN_TEMPLATE = [
  { id: 'mood', label: 'Humeur', type: 'scale' },
  { id: 'energy', label: 'Énergie', type: 'scale' },
  { id: 'sleep', label: 'Sommeil (h/nuit)', type: 'number' },
  { id: 'weight', label: 'Poids', type: 'number' },
  { id: 'notes', label: 'Notes libres', type: 'text' },
];

const TYPES = ['scale', 'number', 'text', 'bool'];

// Valide un tableau de questions. Renvoie { questions } normalisé ou { error: string }.
export function validateTemplate(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 12) {
    return { error: 'questions doit être un tableau de 1 à 12 questions' };
  }
  const seen = new Set();
  const clean = [];
  for (const q of questions) {
    if (!q || typeof q !== 'object') return { error: 'Question invalide' };
    const id = typeof q.id === 'string' ? q.id : '';
    if (!/^[a-z0-9_]{1,30}$/.test(id)) return { error: `id invalide : "${id}" (a-z, 0-9, _, max 30 caractères)` };
    if (seen.has(id)) return { error: `id en double : "${id}"` };
    seen.add(id);
    const label = typeof q.label === 'string' ? q.label.trim() : '';
    if (!label || label.length > 120) return { error: `label invalide pour "${id}" (1 à 120 caractères)` };
    if (!TYPES.includes(q.type)) return { error: `type invalide pour "${id}" (scale|number|text|bool)` };
    clean.push({ id, label, type: q.type });
  }
  return { questions: clean };
}

async function verifyCoach(req) {
  const auth = await requireAuth(req); if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (!me || me.role !== 'coach') return { error: Response.json({ error: 'Accès refusé' }, { status: 403 }) };
  return { coachId: auth.userId };
}

// Récupérer le template de check-in du coach (défaut si jamais personnalisé)
export async function GET(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  const stored = await userDb(v.coachId).get('checkinTemplate');
  const questions = Array.isArray(stored) && stored.length ? stored : DEFAULT_CHECKIN_TEMPLATE;
  return Response.json({ questions });
}

// Personnaliser le template de check-in
export async function PATCH(req) {
  const v = await verifyCoach(req); if (v.error) return v.error;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON invalide' }, { status: 400 }); }
  const check = validateTemplate(body?.questions);
  if (check.error) return Response.json({ error: check.error }, { status: 400 });
  await userDb(v.coachId).set('checkinTemplate', check.questions);
  return Response.json({ ok: true, questions: check.questions });
}
