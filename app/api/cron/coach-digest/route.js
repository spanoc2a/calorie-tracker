import { db, userDb } from '../../db';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';

export const maxDuration = 300;

function parisDateKey(d = new Date()) {
  return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

function dateKeyDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return parisDateKey(d);
}

function plur(n, sing, plural) {
  return `${n} ${n > 1 ? plural : sing}`;
}

// « Ma journée coach » : agrège pour un coach les bilans à valider, médias non vus,
// messages non lus et élèves inactifs ≥ 3 jours. Renvoie null si tout est à zéro.
async function buildDigest(coachId) {
  const athleteIds = await db.get(`coach:${coachId}:athletes`) || [];
  if (athleteIds.length === 0) return null;

  const last3 = [0, 1, 2].map(dateKeyDaysAgo);
  let pendingReports = 0, unseenMedia = 0, unreadMessages = 0, inactiveAthletes = 0;

  for (const id of athleteIds) {
    const udb = userDb(id);
    const [bloodTests, mediaItems, chat, ...days] = await Promise.all([
      udb.get('bloodTests').then(b => b || []),
      udb.get('mediaItems').then(m => m || []),
      db.get(`chat:${coachId}:${id}`).then(c => c || []),
      ...last3.map(dk => udb.get(`day:${dk}`).then(e => e || [])),
    ]);

    // (a) Bilans en attente de validation coach (même détection que coach/athletes).
    pendingReports += bloodTests.filter(b => b.pendingCoachValidation).length;
    // (b) Médias non visionnés (même logique que le summary média de coach/athletes).
    unseenMedia += mediaItems.filter(m => !m.viewedAt && !m.expired).length;
    // (c) Messages de l'élève non lus par le coach (même définition que le peek du chat).
    unreadMessages += chat.filter(m => m.role !== 'coach' && !m.read).length;
    // (d) Élève inactif : aucun log sur les 3 derniers jours (aujourd'hui inclus).
    if (days.every(d => d.length === 0)) inactiveAthletes++;
  }

  const parts = [];
  if (pendingReports)   parts.push(plur(pendingReports, 'bilan à valider', 'bilans à valider'));
  if (unseenMedia)      parts.push(plur(unseenMedia, 'nouveau média', 'nouveaux médias'));
  if (unreadMessages)   parts.push(plur(unreadMessages, 'message', 'messages'));
  if (inactiveAthletes) parts.push(plur(inactiveAthletes, 'élève inactif', 'élèves inactifs'));
  if (parts.length === 0) return null;

  return {
    body: parts.join(' · '),
    counts: { pendingReports, unseenMedia, unreadMessages, inactiveAthletes },
  };
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const users = await db.get('auth:users') || [];
  const coaches = users.filter(u => u.role === 'coach');

  const results = { sent: 0, skipped: 0, errors: 0 };
  const title = '☀️ Ta journée coach';

  for (const coach of coaches) {
    try {
      const digest = await buildDigest(coach.id);
      if (!digest) { results.skipped++; continue; }

      await Promise.all([
        sendPushToUser(coach.id, title, digest.body, '/coach').catch(() => {}),
        sendExpoPushToUser(coach.id, title, digest.body, { type: 'coach_digest' }),
      ]);

      const cdb = userDb(coach.id);
      const notifs = await cdb.get('coachNotifications') || [];
      await cdb.set('coachNotifications', [
        { id: Date.now(), date: new Date().toISOString(), type: 'coach_digest', body: digest.body, counts: digest.counts, read: false },
        ...notifs,
      ].slice(0, 20));

      results.sent++;
    } catch (e) {
      console.error(`Coach digest error for ${coach.id}:`, e.message);
      results.errors++;
    }
  }

  return Response.json({ ok: true, ...results, total: coaches.length });
}
