import { requireAuth } from '../auth/session';
import { db, userDb } from '../db';
import { getUser } from '../users';
import { DEFAULT_CHECKIN_TEMPLATE } from '../coach/checkin-template/route';
import { detectLang, getUserLang } from '../../lib/lang';
import { pushText } from '../../lib/pushTexts';

// Labels du template PAR DÉFAUT dans la langue de l'élève qui le remplit.
// Un template personnalisé par le coach est servi tel quel (son texte).
function localizeDefaultTemplate(lang) {
  return DEFAULT_CHECKIN_TEMPLATE.map(q => ({ ...q, label: pushText(lang, `checkin_label_${q.id}`) }));
}

// Template applicable à un élève : celui de son coach, sinon le défaut
// (élève sans coach, ou coach n'ayant jamais personnalisé), localisé (`lang`).
async function getTemplateFor(userId, lang = 'fr') {
  const coachId = await userDb(userId).get('coachId');
  if (coachId) {
    const stored = await userDb(coachId).get('checkinTemplate');
    if (Array.isArray(stored) && stored.length) return stored;
  }
  return localizeDefaultTemplate(lang);
}

// Valide les réponses dynamiques contre le template. Renvoie { answers } ou { error }.
function validateAnswers(answers, template) {
  if (typeof answers !== 'object' || Array.isArray(answers)) return { error: 'answers doit être un objet' };
  const byId = new Map(template.map(q => [q.id, q]));
  const clean = {};
  for (const [id, value] of Object.entries(answers)) {
    const q = byId.get(id);
    if (!q) return { error: `Question inconnue : "${id}"` };
    if (value === null || value === undefined || value === '') continue; // question laissée vide
    if (q.type === 'scale') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) return { error: `"${id}" : valeur attendue entre 1 et 5` };
    } else if (q.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `"${id}" : nombre attendu` };
    } else if (q.type === 'text') {
      if (typeof value !== 'string' || value.length > 2000) return { error: `"${id}" : texte attendu (max 2000 caractères)` };
    } else if (q.type === 'bool') {
      if (typeof value !== 'boolean') return { error: `"${id}" : booléen attendu` };
    }
    clean[id] = value;
  }
  return { answers: clean };
}

function lastMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Récupérer les check-ins + semaine en attente
export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const [checkins, template] = await Promise.all([
    userDb(auth.userId).get('checkins').then(v => v || []),
    getTemplateFor(auth.userId, detectLang(req)),
  ]);
  const week = lastMonday();
  const pendingWeek = checkins.some(c => c.weekDate === week) ? null : week;
  return Response.json({ checkins, pendingWeek, template });
}

// Soumettre un check-in hebdomadaire
export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { weekDate, mood, energy, sleep, weight, notes, answers } = await req.json();
  if (!weekDate) return Response.json({ error: 'weekDate requis' }, { status: 400 });

  // Champs legacy (anciens clients) — inchangés, rétro-compat totale.
  const checkin = { id: Date.now(), weekDate, mood, energy, sleep, weight, notes, submittedAt: new Date().toISOString() };

  // Réponses dynamiques (nouveaux clients) : validées contre le template du coach,
  // stockées telles quelles sous `answers`. Compat affichage coach : les ids legacy
  // présents dans answers sont aussi recopiés à la racine de l'entrée.
  if (answers !== undefined && answers !== null) {
    const template = await getTemplateFor(auth.userId);
    const check = validateAnswers(answers, template);
    if (check.error) return Response.json({ error: check.error }, { status: 400 });
    checkin.answers = check.answers;
    for (const legacyId of ['mood', 'energy', 'sleep', 'weight', 'notes']) {
      if (legacyId in check.answers) checkin[legacyId] = check.answers[legacyId];
    }
  }
  const existing = await userDb(auth.userId).get('checkins') || [];
  const updated = [checkin, ...existing].slice(0, 52);
  await userDb(auth.userId).set('checkins', updated);

  // Notifier le coach (web + Expo) — non bloquant.
  try {
    const coachId = await userDb(auth.userId).get('coachId');
    if (coachId) {
      const athlete = await getUser(auth.userId);
      const name = athlete?.name || 'Un élève';
      const { sendPushToUser } = await import('../push/send/route');
      const { sendExpoPushToUser } = await import('../../lib/expoPush');
      // Langue du DESTINATAIRE du push = le coach.
      const coachLang = await getUserLang(coachId);
      const title = pushText(coachLang, 'checkin_received_title');
      const body = pushText(coachLang, 'checkin_received_body', { name });
      await Promise.all([
        sendPushToUser(coachId, title, body, '/coach'),
        sendExpoPushToUser(coachId, title, body, { type: 'checkin_coach', athleteId: auth.userId }),
      ]);
    }
  } catch {}

  return Response.json({ ok: true });
}
