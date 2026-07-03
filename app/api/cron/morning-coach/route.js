import { db, userDb } from '../../db';
import { runBatchedCron } from '../../../lib/cronBatch';
import { getUserWithPlan, isPro } from '../../../lib/planServer';
import { sendPushToUser } from '../../push/send/route';
import { sendExpoPushToUser } from '../../../lib/expoPush';

export const maxDuration = 300;

// ── Séance du jour ─────────────────────────────────────────────────────────────
// Résolution de la séance prévue aujourd'hui à partir d'un programme muscu
// (days[].day = noms génériques type « Lundi ») + des overrides datés
// sessionSchedule = { 'YYYY-MM-DD': { dayLabel, skipped } } (voir /api/session-schedule).

const WEEKDAY_NAMES = [
  ['dimanche', 'sunday', 'domingo'],
  ['lundi', 'monday', 'lunes'],
  ['mardi', 'tuesday', 'martes'],
  ['mercredi', 'wednesday', 'miércoles'],
  ['jeudi', 'thursday', 'jueves'],
  ['vendredi', 'friday', 'viernes'],
  ['samedi', 'saturday', 'sábado'],
];

function parisToday() {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

function parisWeekdayIndex() {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Paris' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

// → { label } si une séance est prévue aujourd'hui, sinon null.
function resolveTodaySession(program, overrides) {
  const days = program?.days;
  if (!Array.isArray(days) || days.length === 0) return null;
  const norm = (s) => String(s || '').trim().toLowerCase();
  const o = overrides?.[parisToday()];
  if (o) {
    if (o.dayLabel) {
      // Séance déplacée SUR aujourd'hui : retrouver le jour de programme correspondant.
      const day = days.find(d => norm(d.day) === norm(o.dayLabel) || norm(d.label) === norm(o.dayLabel));
      return { label: day?.label || day?.day || String(o.dayLabel) };
    }
    if (o.skipped) return null; // séance du jour sautée/déplacée ailleurs
    return null;
  }
  const names = WEEKDAY_NAMES[parisWeekdayIndex()] || [];
  const day = days.find(d => names.includes(norm(d.day)));
  return day ? { label: day.label || day.day } : null;
}

// Élève coaché : pas d'IA (règle « IA invisible ») mais un rappel factuel de la séance
// du jour issue du programme envoyé par son coach. 1 envoi max par jour.
async function processCoachedSessionReminder(userId) {
  const udb = userDb(userId);
  const today = parisToday();

  // Idempotence : ne pas renvoyer si déjà envoyé aujourd'hui (relance du cron, etc.)
  const last = await udb.get('lastSessionReminder');
  if (last === today) return false;

  const [programs, overrides] = await Promise.all([
    udb.get('coachMuscuPrograms').then(p => (p || []).filter(x => x.status === 'sent')),
    udb.get('sessionSchedule').then(s => s || {}),
  ]);
  if (programs.length === 0) return false; // même source que /api/athlete/program

  const session = resolveTodaySession(programs[0], overrides);
  if (!session) return false; // pas de séance aujourd'hui → rien

  await udb.set('lastSessionReminder', today);
  const title = `💪 Au programme aujourd'hui : ${session.label}`;
  const body = 'Programmé par ton coach — bonne séance !';
  await Promise.all([
    sendPushToUser(userId, title, body, '/').catch(() => {}),
    sendExpoPushToUser(userId, title, body, { type: 'session' }),
  ]);
  return true;
}

function getDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return age;
}

function firstName(fullName) {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0];
}

function getTrainingDates(muscuSets) {
  if (!muscuSets || typeof muscuSets !== 'object') return [];
  const dateSet = new Set();
  for (const byDate of Object.values(muscuSets)) {
    if (!byDate || typeof byDate !== 'object') continue;
    for (const [date, sets] of Object.entries(byDate)) {
      if (Array.isArray(sets) && sets.length > 0) dateSet.add(date);
    }
  }
  return [...dateSet].sort();
}

// Morning brief uses yesterday's nutrition + sleep/HRV recovery data.
// Never checks today's food/steps (it's morning, nothing is logged yet).
function computeMorningInsights(profile, hc, yesterdayEntries, avgJournal, muscuSets, muscuProgram, weightLog) {
  const trainingDates = getTrainingDates(muscuSets);
  const insights = [];

  // ── Recovery signals (most important for morning) ──
  const sleep = hc?.lastSleepHours ?? hc?.avgSleep ?? null;
  if (sleep !== null) {
    if (sleep < 5.5) insights.push(`🔴 Sommeil cette nuit: ${sleep}h — récupération très compromise`);
    else if (sleep < 6.5) insights.push(`🟡 Sommeil cette nuit: ${sleep}h — court`);
    else if (sleep < 7.5) insights.push(`🟡 Sommeil cette nuit: ${sleep}h — légèrement sous l'optimal`);
    else insights.push(`✓ Bonne nuit: ${sleep}h de sommeil`);
  }

  if (hc?.hrv) {
    if (hc.hrv < 25) insights.push(`🔴 HRV: ${hc.hrv} ms — récupération critique, évite l'intensité`);
    else if (hc.hrv < 40) insights.push(`🟡 HRV: ${hc.hrv} ms — corps fatigué`);
    else insights.push(`✓ HRV: ${hc.hrv} ms — bonne récupération`);
  }

  if (hc?.restingHR) {
    if (hc.restingHR > 75) insights.push(`🟡 FC repos: ${hc.restingHR} bpm — élevée ce matin`);
  }

  // ── Yesterday's nutrition recap (relevant, not intrusive) ──
  const yEntries = yesterdayEntries || [];
  if (profile?.goalKcal && yEntries.length > 0) {
    const eaten = Math.round(yEntries.reduce((a, e) => a + (e.kcal || 0), 0));
    const goal = profile.goalKcal;
    const rem = goal - eaten;
    if (rem > 500) insights.push(`↑ Hier: ${eaten} kcal/${goal} — objectif non atteint`);
    else if (rem < -400) insights.push(`↓ Hier: ${eaten} kcal — dépassement de ${Math.abs(rem)} kcal`);
    else insights.push(`✓ Hier: ${eaten}/${goal} kcal`);

    if (profile?.goalProtein) {
      const protein = Math.round(yEntries.reduce((a, e) => a + (e.protein || 0), 0));
      if (protein < profile.goalProtein - 40) {
        insights.push(`↑ Protéines hier: ${protein}/${profile.goalProtein}g — pense à en avoir plus aujourd'hui`);
      }
    }
  }

  // ── 7-day trend ──
  if (avgJournal && profile?.goalKcal) {
    const diff = avgJournal.kcal - profile.goalKcal;
    if (diff < -500) insights.push(`⚠ Tendance 7j: ${avgJournal.kcal} kcal/j — déficit chronique`);
    else if (diff > 500) insights.push(`⚠ Tendance 7j: ${avgJournal.kcal} kcal/j — excédent régulier`);
  }

  // ── Training this week ──
  if (muscuProgram?.daysPerWeek) {
    const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const done = trainingDates.filter(d => d >= weekAgoStr).length;
    const target = muscuProgram.daysPerWeek;
    if (done === 0) insights.push(`⚠ Aucune séance cette semaine (objectif: ${target}/sem)`);
    else if (done < target) insights.push(`Muscu: ${done}/${target} séances cette semaine`);
    else insights.push(`✓ Objectif muscu atteint: ${done}/${target} séances`);
  }

  // ── Weight trend (only if misaligned with goal) ──
  if (weightLog?.length >= 3) {
    const recent = weightLog.slice(-5);
    const oldest = recent[0]?.value ?? recent[0]?.weight;
    const newest = recent[recent.length - 1]?.value ?? recent[recent.length - 1]?.weight;
    if (oldest && newest) {
      const diff = parseFloat((newest - oldest).toFixed(1));
      const mode = profile?.mode;
      if (Math.abs(diff) >= 0.5) {
        const misaligned =
          (diff > 0 && (mode === 'loss' || mode === 'perte')) ? `Poids en hausse (+${diff} kg) — objectif perte` :
          (diff < 0 && (mode === 'gain' || mode === 'masse')) ? `Poids en baisse (${diff} kg) — objectif masse` : null;
        if (misaligned) insights.push(`⚠ ${misaligned}`);
      }
    }
  }

  return insights;
}

async function generateMorningBrief(prenom, profile, hc, yesterdayEntries, avgJournal, muscuSets, muscuProgram, weightLog, weeklySummary, todaySessionLabel) {
  const label = prenom || 'toi';
  const insights = computeMorningInsights(profile, hc, yesterdayEntries, avgJournal, muscuSets, muscuProgram, weightLog);
  const priority = insights.filter(i => /^[⚠🔴🟡↑↓]/.test(i));
  const toShow = (priority.length > 0 ? priority : insights).slice(0, 3);
  if (toShow.length === 0) return null;

  const h = weeklySummary?.highlights;
  const longTermNote = h?.currentStreak >= 3
    ? `Série: ${h.currentStreak} semaines consécutives d'objectifs atteints.`
    : h?.trainingTrend?.includes('régression') ? `Tendance entraînement: ${h.trainingTrend}`
    : null;

  const sessionNote = todaySessionLabel ? `Séance prévue aujourd'hui : ${todaySessionLabel}` : null;

  const contextLines = [...toShow, ...(sessionNote ? [sessionNote] : []), ...(longTermNote ? [longTermNote] : [])];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 130,
      system: `Tu es le coach IA personnel de ${label}. C'est le matin — l'utilisateur vient de se lever. Génère un message de réveil motivant (2-3 phrases MAX). Chaleureux, direct. Base-toi sur les données de récupération (sommeil, HRV) et ce qui s'est passé HIER — jamais sur ce qui n'a pas encore été fait aujourd'hui. Commence par "Bonjour ${label} !" ou variante. Pas de liste. En français.`,
      messages: [{ role: 'user', content: `Données de cette nuit et d'hier:\n${contextLines.join('\n')}` }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.find(b => b.type === 'text')?.text?.trim() || null;
}

async function sendExpoPush(token, title, body, data = {}) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'normal' }),
    });
  } catch {}
}

async function processMorningCoach(userId, userName) {
  const user = await getUserWithPlan(userId);
  if (!user || !isPro(user.activePlan)) return false;
  // Règle produit "IA invisible" : un élève rattaché à un coach ne reçoit JAMAIS
  // de contenu IA non validé — à la place, rappel factuel (non-IA) de la séance du jour
  // issue du programme envoyé par son coach.
  if (user.hasCoach) return processCoachedSessionReminder(userId);

  const udb = userDb(userId);
  const today = getDateString(0);

  // Fast path: brief already generated today
  const history = await udb.get('aiCoachHistory') || [];
  const lastMsgDate = history[history.length - 1]?.date?.slice(0, 10);
  if (lastMsgDate === today) return false;

  // Need an Expo push token
  const expoPushToken = await udb.get('expoPushToken');
  if (!expoPushToken) return false;

  // Only send to active users (logged something in last 7 days or has a profile)
  const settings = await udb.get('userSettings');
  const last7 = Array.from({ length: 7 }, (_, i) => getDateString(i + 1));
  const recentEntries = await Promise.all(last7.map(d => udb.get(`day:${d}`)));
  const hasActivity = recentEntries.some(e => Array.isArray(e) && e.length > 0);
  if (!hasActivity && !settings?.goalKcal) return false;

  // Load context in parallel
  const [hc, muscuSets, muscuProgram, weightLog, weeklySummary, sessionOverrides] = await Promise.all([
    udb.get('healthConnectData'),
    udb.get('muscuSets'),
    udb.get('muscuProgram'),
    udb.get('weightLog'),
    udb.get('coachWeeklySummary'),
    udb.get('sessionSchedule').then(s => s || {}),
  ]);

  // Use yesterday's entries — it's morning, today's journal is empty
  const yesterdayEntries = recentEntries[0] || [];

  // 6-day average (excluding today)
  const activeDays = recentEntries.slice(0, 6).filter(d => Array.isArray(d) && d.length > 0);
  let avgJournal = null;
  if (activeDays.length > 0) {
    let tK = 0, tP = 0, tC = 0, tF = 0;
    for (const day of activeDays) for (const e of day) {
      tK += e.kcal || 0; tP += e.protein || 0; tC += e.carbs || 0; tF += e.fat || 0;
    }
    const n = activeDays.length;
    avgJournal = { kcal: Math.round(tK/n), protein: Math.round(tP/n), carbs: Math.round(tC/n), fat: Math.round(tF/n) };
  }

  const prenom = firstName(userName || settings?.name);

  // Séance prévue aujourd'hui (programme muscu solo + overrides) — mentionnée dans le brief.
  const todaySession = resolveTodaySession(muscuProgram, sessionOverrides);

  const brief = await generateMorningBrief(
    prenom, settings, hc, yesterdayEntries, avgJournal,
    muscuSets, muscuProgram, weightLog, weeklySummary, todaySession?.label || null
  );

  if (!brief) return false;

  // Save to history
  const dailyMsg = { role: 'assistant', content: brief, date: new Date().toISOString(), source: 'daily' };
  const newHistory = [...history, dailyMsg].slice(-50);
  await udb.set('aiCoachHistory', newHistory);

  // Push: strip "Bonjour X !" from body to keep it short
  const pushBody = brief.replace(/^(Bonjour|Salut|Hello)[^!,]*[!,]\s*/i, '').slice(0, 130);
  const pushTitle = prenom ? `✦ Bonjour ${prenom} !` : '✦ Coach IA';
  await sendExpoPush(expoPushToken, pushTitle, pushBody, { type: 'coach_brief' });

  return true;
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // 1 appel IA potentiel par user → lots courts auto-enchaînés (anti-timeout à l'échelle).
  return runBatchedCron(req, 'morning-coach', {
    batch: 15,
    chunk: 5,
    filter: (u) => u.role !== 'coach',
    handler: (user) => processMorningCoach(user.id, user.name),
  });
}
