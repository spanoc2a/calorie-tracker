import { db, userDb } from '../../db';
import { runBatchedCron } from '../../../lib/cronBatch';
import { sendCoachChatMessage } from '../../coach/broadcast/route';
import { getUserLang } from '../../../lib/lang';
import { pushText, PUSH_TEXTS } from '../../../lib/pushTexts';

export const maxDuration = 300;

// Steps de bienvenue PAR DÉFAUT (non personnalisés par le coach) : si le texte du step
// est strictement le texte fr par défaut, on le sert dans la langue de l'ÉLÈVE.
// Un texte modifié par le coach est envoyé tel quel.
const WELCOME_KEY_BY_OFFSET = { 0: 'welcome_day0', 2: 'welcome_day2', 7: 'welcome_day7' };

async function localizeWelcomeText(step, athleteId) {
  const key = WELCOME_KEY_BY_OFFSET[step?.dayOffset];
  if (!key || step.text !== PUSH_TEXTS.fr[key]) return step.text;
  const lang = await getUserLang(athleteId);
  return pushText(lang, key);
}

const DAY_MS = 86_400_000;

function parisDateKey(d = new Date()) {
  return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

// (a) Séquence de bienvenue : pour chaque élève lié (coachLinkedAt), envoie le step dont
// dayOffset === nb de jours entiers écoulés depuis le rattachement. Les élèves SANS
// coachLinkedAt (comptes antérieurs à l'horodatage) sont skippés. Idempotence :
// u:<athleteId>:welcomeSent = liste des dayOffset déjà envoyés — marquée AVANT l'envoi
// (mieux vaut rater un message que l'envoyer deux fois).
async function runWelcome(coach, steps, athleteIds) {
  let sentAny = false;
  const now = Date.now();
  const coachName = coach.name || 'Coach';

  for (let i = 0; i < athleteIds.length; i += 10) {
    const results = await Promise.allSettled(athleteIds.slice(i, i + 10).map(async (athleteId) => {
      const adb = userDb(athleteId);
      const linkedAt = await adb.get('coachLinkedAt');
      if (!linkedAt) return;
      const days = Math.floor((now - Date.parse(linkedAt)) / DAY_MS);
      if (!Number.isFinite(days) || days < 0) return;

      const sentOffsets = await adb.get('welcomeSent') || [];
      // Un seul step par dayOffset (dédoublonné), jamais renvoyé si déjà marqué.
      const due = [];
      for (const s of steps) {
        if (s?.dayOffset === days && !sentOffsets.includes(days) && !due.some(d => d.dayOffset === days)) due.push(s);
      }
      if (due.length === 0) return;

      await adb.set('welcomeSent', [...new Set([...sentOffsets, ...due.map(s => s.dayOffset)])]);
      for (const step of due) {
        const text = await localizeWelcomeText(step, athleteId);
        await sendCoachChatMessage(coach.id, coachName, athleteId, text, { auto: true });
        sentAny = true;
      }
    }));
    for (const r of results) {
      if (r.status === 'rejected') console.error('[CRON coach-automations] welcome', r.reason);
    }
  }
  return sentAny;
}

// (b) Messages programmés : chaque item avec sendOn <= aujourd'hui (Paris) et sentAt null.
// Idempotence : sentAt est marqué et l'objet automations RÉÉCRIT AVANT les envois.
async function runScheduled(coach, cdb, automations, athleteIds) {
  const today = parisDateKey();
  const due = (automations.scheduled || []).filter(it => it && !it.sentAt && typeof it.sendOn === 'string' && it.sendOn <= today);
  if (due.length === 0) return false;

  const nowIso = new Date().toISOString();
  for (const it of due) it.sentAt = nowIso;
  await cdb.set('automations', automations);

  const coachName = coach.name || 'Coach';
  let sentAny = false;
  for (const it of due) {
    // athleteIds null/vide = tous ; sinon filtré sur la liste ACTUELLE du coach.
    const targets = Array.isArray(it.athleteIds) && it.athleteIds.length > 0
      ? it.athleteIds.filter(id => athleteIds.includes(id))
      : athleteIds;

    for (let i = 0; i < targets.length; i += 10) {
      const results = await Promise.allSettled(
        targets.slice(i, i + 10).map(id => sendCoachChatMessage(coach.id, coachName, id, it.text, { auto: true }))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') sentAny = true;
        else console.error('[CRON coach-automations] scheduled', r.reason);
      }
    }
  }
  return sentAny;
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  return runBatchedCron(req, 'coach-automations', {
    batch: 50,
    chunk: 5,
    filter: (u) => u.role === 'coach',
    handler: async (coach) => {
      const cdb = userDb(coach.id);
      const automations = await cdb.get('automations');
      if (!automations || typeof automations !== 'object') return false;

      const athleteIds = await db.get(`coach:${coach.id}:athletes`) || [];
      if (athleteIds.length === 0) return false;

      let sentAny = false;

      const steps = automations.welcome?.enabled === true && Array.isArray(automations.welcome.steps)
        ? automations.welcome.steps
        : [];
      if (steps.length > 0) {
        if (await runWelcome(coach, steps, athleteIds)) sentAny = true;
      }

      if (await runScheduled(coach, cdb, automations, athleteIds)) sentAny = true;

      return sentAny;
    },
  });
}
