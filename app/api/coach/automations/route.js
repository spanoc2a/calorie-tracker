import crypto from 'crypto';
import { userDb } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';

const DAY_MS = 86_400_000;

// Séquence de bienvenue par défaut (désactivée) : le coach n'a qu'à l'activer.
// RÈGLE PRODUIT : ces messages partent « du coach », donc ton chaleureux, première personne.
function defaultAutomations() {
  return {
    welcome: {
      enabled: false,
      steps: [
        { dayOffset: 0, text: "Bienvenue à bord ! 💪 Je suis ravi de t'accompagner. Prends le temps de découvrir l'app tranquillement, et surtout écris-moi ici dès que tu as une question : je suis là pour toi. On avance ensemble !" },
        { dayOffset: 2, text: "Hello ! J'espère que tu prends bien tes marques 😊 Pense à compléter ton questionnaire et à enregistrer tes premiers repas et entraînements : plus j'en sais sur toi, mieux je peux adapter ton suivi. À très vite !" },
        { dayOffset: 7, text: "Déjà une semaine ensemble ! 🎉 Dis-moi comment tu te sens : ton énergie, tes repas, tes séances… Raconte-moi tout, on fait un premier point et on ajuste ce qu'il faut pour la suite." },
      ],
    },
    scheduled: [],
  };
}

// Normalise ce qui sort de la base (objet partiel/absent → défauts).
function normalize(raw) {
  const d = defaultAutomations();
  if (!raw || typeof raw !== 'object') return d;
  return {
    welcome: raw.welcome && typeof raw.welcome === 'object'
      ? { enabled: raw.welcome.enabled === true, steps: Array.isArray(raw.welcome.steps) ? raw.welcome.steps : d.welcome.steps }
      : d.welcome,
    scheduled: Array.isArray(raw.scheduled) ? raw.scheduled : [],
  };
}

// Valide/normalise un objet welcome fourni par le client. Renvoie null si invalide.
function validateWelcome(w) {
  if (!w || typeof w !== 'object' || !Array.isArray(w.steps) || w.steps.length > 10) return null;
  const steps = [];
  for (const s of w.steps) {
    const dayOffset = Number(s?.dayOffset);
    const text = typeof s?.text === 'string' ? s.text.trim() : '';
    if (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 30) return null;
    if (!text || text.length > 1000) return null;
    steps.push({ dayOffset, text });
  }
  return { enabled: w.enabled === true, steps };
}

const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

async function requireCoach(req) {
  const auth = await requireAuth(req);
  if (auth.error) return { error: auth.error };
  const me = await getUser(auth.userId);
  if (me?.role !== 'coach') return { error: Response.json({ error: 'Réservé aux coachs' }, { status: 403 }) };
  return { auth, me };
}

// GET /api/coach/automations → { automations: { welcome, scheduled } }
export async function GET(req) {
  const c = await requireCoach(req); if (c.error) return c.error;
  const automations = normalize(await userDb(c.auth.userId).get('automations'));
  return Response.json({ automations });
}

// PATCH /api/coach/automations
//   { welcome: { enabled, steps } }                        → remplace la séquence de bienvenue
//   { action: 'addScheduled', text, athleteIds?, sendOn }  → ajoute un message programmé
//   { action: 'deleteScheduled', id }                      → supprime un message programmé
// Purge au passage les scheduled envoyés il y a plus de 90 jours. Réponse : { ok, automations }.
export async function PATCH(req) {
  const c = await requireCoach(req); if (c.error) return c.error;

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const cdb = userDb(c.auth.userId);
  const automations = normalize(await cdb.get('automations'));

  // Purge des messages programmés envoyés il y a plus de 90 jours.
  const now = Date.now();
  automations.scheduled = automations.scheduled.filter(it => !it?.sentAt || now - Date.parse(it.sentAt) < 90 * DAY_MS);

  if (body.welcome !== undefined) {
    const welcome = validateWelcome(body.welcome);
    if (!welcome) {
      return Response.json({ error: 'welcome invalide (10 étapes max, dayOffset entier 0-30, texte 1-1000 caractères)' }, { status: 400 });
    }
    automations.welcome = welcome;
  }

  if (body.action === 'addScheduled') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return Response.json({ error: 'Message vide' }, { status: 400 });
    if (text.length > 2000) return Response.json({ error: 'Message trop long (2000 caractères max)' }, { status: 400 });
    if (!isDateStr(body.sendOn)) return Response.json({ error: 'sendOn invalide (format YYYY-MM-DD)' }, { status: 400 });
    if (automations.scheduled.length >= 20) {
      return Response.json({ error: 'Limite de 20 messages programmés atteinte' }, { status: 400 });
    }
    // athleteIds absent/vide/invalide → null = tous les élèves (résolu à l'envoi).
    let athleteIds = null;
    if (Array.isArray(body.athleteIds)) {
      const ids = [...new Set(body.athleteIds.filter(id => typeof id === 'string' && id))];
      if (ids.length > 0) athleteIds = ids;
    }
    automations.scheduled.push({ id: crypto.randomUUID(), text, athleteIds, sendOn: body.sendOn, sentAt: null });
  } else if (body.action === 'deleteScheduled') {
    if (!body.id) return Response.json({ error: 'id manquant' }, { status: 400 });
    automations.scheduled = automations.scheduled.filter(it => it?.id !== body.id);
  } else if (body.action !== undefined) {
    return Response.json({ error: 'action inconnue' }, { status: 400 });
  }

  await cdb.set('automations', automations);
  return Response.json({ ok: true, automations });
}
