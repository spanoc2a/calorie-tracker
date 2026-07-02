import { db, userDb } from '../../db';
import { getUserWithPlan, isPro } from '../../../lib/planServer';
import { sendExpoPushToUser } from '../../../lib/expoPush';

export const maxDuration = 300;

function dateKey(d) {
  return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return dateKey(d);
  });
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  const age = Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 3600 * 1000));
  return age > 0 ? age : null;
}

function fmtDate(str) {
  if (!str) return str;
  const d = new Date(str);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

// Extract training sessions in [startDate, endDate] from muscuSets
function extractTrainingSessions(muscuSets, startDate, endDate) {
  if (!muscuSets || typeof muscuSets !== 'object') return {};
  const sessions = {};
  for (const [exercise, byDate] of Object.entries(muscuSets)) {
    if (!byDate || typeof byDate !== 'object') continue;
    for (const [date, sets] of Object.entries(byDate)) {
      if (date < startDate || date > endDate) continue;
      if (!Array.isArray(sets) || sets.length === 0) continue;
      if (!sessions[date]) sessions[date] = [];
      const bestSet = sets.reduce((best, s) => (!best || (s.weight || 0) > (best.weight || 0)) ? s : best, null);
      const totalVol = sets.reduce((a, s) => a + ((s.weight || 0) * (s.reps || 0)), 0);
      sessions[date].push({ exercise, sets: sets.length, bestSet, totalVol: Math.round(totalVol) });
    }
  }
  return sessions;
}

function formatSessions(sessions, dates) {
  const lines = [];
  for (const date of dates) {
    if (!sessions[date]) continue;
    const exos = sessions[date]
      .sort((a, b) => b.totalVol - a.totalVol)
      .slice(0, 6)
      .map(s => {
        const best = s.bestSet;
        if (best?.weight && best?.reps) return `${s.exercise} ${best.weight}kg×${best.reps} (${s.sets} séries)`;
        if (best?.reps) return `${s.exercise} ${best.reps} reps (${s.sets} séries)`;
        return s.exercise;
      });
    lines.push(`${fmtDate(date)} : ${exos.join(', ')}`);
  }
  return lines.length ? lines.join('\n') : 'Aucune séance enregistrée';
}

function formatBloodTests(bloodTests) {
  if (!bloodTests?.length) return null;
  const latest = bloodTests[0];
  const date = latest.date || latest.uploadedAt?.slice(0, 10) || '?';
  const bad = (latest.markers || []).filter(m => m.status === 'warn' || m.status === 'bad');
  if (bad.length === 0) return `Dernier bilan (${date}) : tous marqueurs OK.`;
  return `Dernier bilan (${date}) — marqueurs hors norme :\n` + bad.map(m =>
    `  ${m.name}: ${m.value}${m.unit} (réf ${m.refMin ?? '?'}-${m.refMax ?? '?'}, ${m.status === 'bad' ? 'ANORMAL' : 'limite'})`
  ).join('\n');
}

function formatHealthConnect(hc) {
  if (!hc) return null;
  const parts = [];
  if (hc.avgSteps)   parts.push(`Pas moy: ${hc.avgSteps}/j`);
  if (hc.steps)      parts.push(`Pas aujourd'hui: ${hc.steps}`);
  if (hc.avgSleep)   parts.push(`Sommeil moy: ${hc.avgSleep}h/nuit`);
  if (hc.lastSleepHours) parts.push(`Dernière nuit: ${hc.lastSleepHours}h`);
  if (hc.restingHR)  parts.push(`FC repos: ${hc.restingHR} bpm`);
  if (hc.heartRate)  parts.push(`FC auj: ${hc.heartRate} bpm`);
  if (hc.hrv)        parts.push(`HRV: ${hc.hrv} ms`);
  if (hc.spo2)       parts.push(`SpO2: ${hc.spo2}%`);
  return parts.length ? parts.join(' | ') : null;
}

// Composition corporelle (mensurations) sur [startDate, endDate] — recomposition.
function formatMeasurements(measurements, startDate, endDate) {
  const inPeriod = (measurements || []).filter(m => m && m.date && m.date >= startDate && m.date <= endDate);
  if (inPeriod.length === 0) return null;
  const sorted = [...inPeriod].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const metrics = [['Taille', 'waist', 'cm'], ['Poitrine', 'chest', 'cm'], ['Hanches', 'hips', 'cm'], ['Bras', 'arm', 'cm'], ['Cuisse', 'thigh', 'cm'], ['% graisse', 'bodyFat', '%'], ['Masse musc', 'muscleMass', 'kg']];
  const lines = [];
  for (const [label, key, unit] of metrics) {
    const va = Number(first[key]), vb = Number(last[key]);
    if (sorted.length >= 2 && first[key] != null && first[key] !== '' && last[key] != null && last[key] !== '' && isFinite(va) && isFinite(vb)) {
      const d = Math.round((vb - va) * 10) / 10;
      lines.push(`${label}: ${va}→${vb}${unit} (${d > 0 ? '+' : ''}${d})`);
    } else if (last[key] != null && last[key] !== '' && isFinite(vb)) {
      lines.push(`${label}: ${vb}${unit}`);
    }
  }
  return lines.length ? lines.join(' | ') : null;
}

// Ressenti hebdo (check-ins) sur [startDate, endDate].
function formatCheckins(checkins, startDate, endDate) {
  const inPeriod = (checkins || []).filter(c => c && c.weekDate && c.weekDate >= startDate && c.weekDate <= endDate);
  if (inPeriod.length === 0) return null;
  const avg = (key) => {
    const vals = inPeriod.map(c => Number(c[key])).filter(v => isFinite(v));
    return vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10 : null;
  };
  const parts = [];
  if (avg('mood') != null) parts.push(`humeur ${avg('mood')}/5`);
  if (avg('energy') != null) parts.push(`énergie ${avg('energy')}/5`);
  if (avg('sleep') != null) parts.push(`sommeil ${avg('sleep')}h`);
  const notes = [...inPeriod].sort((a, b) => (b.weekDate || '').localeCompare(a.weekDate || ''))
    .filter(c => (c.notes || '').trim()).slice(0, 2).map(c => `"${c.notes.trim()}"`);
  if (parts.length === 0 && notes.length === 0) return null;
  return `${parts.join(' · ')}${notes.length ? '\nNotes élève: ' + notes.join(' ; ') : ''}`;
}

// Anamnèse (intake) — objectifs, blessures (à respecter), allergies.
function formatIntake(intake) {
  if (!intake) return null;
  const parts = [];
  if ((intake.goals || '').trim()) parts.push(`Objectifs: ${intake.goals.trim()}`);
  if ((intake.injuries || '').trim()) parts.push(`Blessures/limitations (à respecter): ${intake.injuries.trim()}`);
  if ((intake.allergies || '').trim()) parts.push(`Allergies: ${intake.allergies.trim()}`);
  if ((intake.lifestyle || '').trim()) parts.push(`Mode de vie: ${intake.lifestyle.trim()}`);
  return parts.length ? parts.join('\n') : null;
}

async function generateWeeklyReport(userId) {
  const user = await getUserWithPlan(userId);
  if (!user || !isPro(user.activePlan)) return null;

  const udb = userDb(userId);
  const dates = getLastNDates(7);
  const startDate = dates[dates.length - 1];
  const endDate = dates[0];

  // Load everything in parallel
  const [settings, weightLog, hc, bloodTests, muscuSets, muscuProgram, nutritionProgram, reportHistory, measurements, checkins, intake] = await Promise.all([
    udb.get('userSettings'),
    udb.get('weightLog').then(r => (r || []).filter(e => e.date >= startDate)),
    udb.get('healthConnectData'),
    udb.get('bloodTests'),
    udb.get('muscuSets'),
    udb.get('muscuProgram'),
    udb.get('nutritionProgram'),
    udb.get('reportHistory'),
    udb.get('measurements'),
    udb.get('checkins'),
    udb.get('intake'),
  ]);

  const dayEntries = await Promise.all(dates.map(dk => udb.get(`day:${dk}`).then(e => ({ dk, entries: e || [] }))));
  const activeDays = dayEntries.filter(d => d.entries.length > 0);

  if (activeDays.length < 2 && !Object.keys(extractTrainingSessions(muscuSets, startDate, endDate)).length) return null;

  // ── Nutrition stats ──────────────────────────────────────────────────────
  let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
  const foodCount = {};
  const perDayNutrition = [];
  for (const { dk, entries } of dayEntries) {
    if (!entries.length) continue;
    let dk_kcal = 0, dk_prot = 0;
    for (const e of entries) {
      totalKcal += e.kcal || 0; dk_kcal += e.kcal || 0;
      totalProtein += e.protein || 0; dk_prot += e.protein || 0;
      totalCarbs += e.carbs || 0;
      totalFat += e.fat || 0;
      const n = (e.name || '').trim();
      if (n) foodCount[n] = (foodCount[n] || 0) + 1;
    }
    perDayNutrition.push(`${fmtDate(dk)} : ${Math.round(dk_kcal)} kcal / ${Math.round(dk_prot)}g prot`);
  }
  const n = activeDays.length || 1;
  const avgKcal = Math.round(totalKcal / n);
  const avgProtein = Math.round(totalProtein / n);
  const avgCarbs = Math.round(totalCarbs / n);
  const avgFat = Math.round(totalFat / n);
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, c]) => `${f} (${c}×)`);

  // ── Profile ──────────────────────────────────────────────────────────────
  const s = settings || {};
  const age = calcAge(s.birthdate);
  const goalMode = { loss: 'perte de poids', gain: 'prise de masse', maintain: 'maintien', perte: 'perte de poids', masse: 'prise de masse', maintien: 'maintien' }[s.mode] || s.mode || '?';

  // ── Weight ───────────────────────────────────────────────────────────────
  let weightCtx = '';
  const allWeightLog = await udb.get('weightLog') || [];
  const recentWeight = allWeightLog.slice(-5);
  if (recentWeight.length >= 2) {
    const first = recentWeight[0];
    const last = recentWeight[recentWeight.length - 1];
    const delta = parseFloat(((last.value || last.weight) - (first.value || first.weight)).toFixed(1));
    weightCtx = `${last.value || last.weight} kg (${delta >= 0 ? '+' : ''}${delta} kg sur les 5 dernières mesures)`;
  } else if (recentWeight.length === 1) {
    weightCtx = `${recentWeight[0].value || recentWeight[0].weight} kg`;
  }

  // ── Training ─────────────────────────────────────────────────────────────
  const sessions = extractTrainingSessions(muscuSets, startDate, endDate);
  const sessionDates = Object.keys(sessions).sort();
  const sessionCount = sessionDates.length;
  const targetSessions = muscuProgram?.daysPerWeek || null;

  // ── Build context for prompt ─────────────────────────────────────────────
  const hcStr = formatHealthConnect(hc);
  const bloodStr = formatBloodTests(bloodTests);
  const measurementsStr = formatMeasurements(measurements, startDate, endDate);
  const checkinsStr = formatCheckins(checkins, startDate, endDate);
  const intakeStr = formatIntake(intake);

  let muscuProgramCtx = null;
  if (muscuProgram) {
    const seances = (muscuProgram.days || []).map(d => `${d.day} (${d.label})`).join(', ');
    muscuProgramCtx = `${muscuProgram.daysPerWeek || '?'}j/sem, objectif ${muscuProgram.goal || '?'}, niveau ${muscuProgram.level || '?'}${seances ? '\n  Séances prévues: ' + seances : ''}`;
  }

  let nutritionProgramCtx = null;
  if (nutritionProgram?.days?.length > 0) {
    const totalTarget = nutritionProgram.days.reduce((a, d) => a + (d.meals || []).reduce((b, m) => b + (m.totalKcal || 0), 0), 0);
    nutritionProgramCtx = `Programme actif (${nutritionProgram.manual ? 'manuel' : 'IA'}, ${Math.round(totalTarget / nutritionProgram.days.length)} kcal/j cible)`;
  }

  // Previous weekly report for comparison
  const prevReport = (reportHistory || []).find(r => r.type === 'hebdomadaire');
  let prevCtx = '';
  if (prevReport?.summary) {
    const ps = prevReport.summary;
    prevCtx = `\n\n[SEMAINE PRÉCÉDENTE — comparaison]\n${ps.avgKcal || '?'} kcal/j · ${ps.avgProtein || '?'}g prot · ${ps.activeDays || '?'} jours loggés · ${ps.sessionCount ?? '?'} séances${ps.avgSleep ? ' · ' + ps.avgSleep + 'h sommeil' : ''}`;
  }

  const userContent = `[PROFIL]
${s.name ? 'Prénom: ' + s.name.split(' ')[0] : ''}
${s.sex || '?'}, ${age ? age + ' ans' : '?'}${s.height ? ', ' + s.height + ' cm' : ''}${s.weight ? ', ' + s.weight + ' kg réf.' : ''}
Objectif: ${goalMode}
Cibles: ${s.goalKcal || '?'} kcal · ${s.goalProtein || '?'}g prot · ${s.goalCarbs || '?'}g gluc · ${s.goalFat || '?'}g lip
${s.healthHistory ? 'Historique santé: ' + s.healthHistory : ''}
${intakeStr ? '[ANAMNÈSE]\n' + intakeStr : ''}
${muscuProgramCtx ? '[PROGRAMME MUSCU]\n' + muscuProgramCtx : ''}
${nutritionProgramCtx ? '[PROGRAMME NUTRITION]\n' + nutritionProgramCtx : ''}

[NUTRITION — semaine du ${startDate} au ${endDate} (${activeDays.length}/7 jours loggés)]
Détail par jour:
${perDayNutrition.join('\n') || 'Aucun repas enregistré'}
Moyennes: ${avgKcal} kcal/j · ${avgProtein}g prot/j · ${avgCarbs}g gluc/j · ${avgFat}g lip/j${s.goalKcal ? ` (écart cible: ${avgKcal - s.goalKcal > 0 ? '+' : ''}${avgKcal - s.goalKcal} kcal/j)` : ''}
Aliments fréquents: ${topFoods.join(', ') || '—'}

[ENTRAÎNEMENT — ${sessionCount} séance(s)${targetSessions ? ' sur ' + targetSessions + ' prévues' : ''}]
${formatSessions(sessions, dates)}

[POIDS]
${weightCtx || 'Pas de mesure cette semaine'}
${measurementsStr ? '\n[COMPOSITION CORPORELLE / MENSURATIONS]\n' + measurementsStr + '\n(Croise poids + composition : recomposition = poids stable, masse musc ↑, % graisse ↓)' : ''}
${checkinsStr ? '\n[RESSENTI HEBDO — check-in élève]\n' + checkinsStr : ''}
${hcStr ? '\n[CAPTEURS / WEARABLE]\n' + hcStr : ''}
${bloodStr ? '\n[BILAN SANGUIN]\n' + bloodStr : ''}
${prevCtx}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      system: `Tu es un coach de performance personnel (nutrition, sport, santé). Rédige un bilan hebdomadaire complet (max 420 mots). HTML simple : <h2>,<p>,<ul>,<li>,<strong>. Sections : <h2>📊 Cette semaine en chiffres</h2> <h2>🍽 Nutrition</h2> <h2>💪 Entraînement</h2> <h2>📐 Composition corporelle</h2> (UNIQUEMENT si mensurations fournies : analyse la recomposition en croisant poids ET composition — poids stable + masse musc ↑ et % graisse ↓ = bonne recomp) <h2>❤️ Récupération & Santé</h2> (relie le ressenti — énergie/sommeil/humeur du check-in — à la charge) <h2>✅ Ce qui a bien marché</h2> <h2>⚠️ À améliorer</h2> <h2>🎯 Objectif semaine prochaine</h2>. Si des blessures/limitations sont déclarées dans l'anamnèse, respecte-les impérativement (contre-indications, alternatives). IMPORTANT : base-toi UNIQUEMENT sur les données fournies. N'invente JAMAIS de données. Si une information n'est pas disponible (ex. pas de Strava, pas de bilan sanguin, pas de mensurations, pas de check-in…), NE le signale PAS et ne mentionne JAMAIS qu'une donnée manque ou est absente : ignore simplement la section concernée et concentre-toi sur ce qui est disponible. N'inclus une section QUE si tu as des données pour l'alimenter — saute silencieusement les sections sans données. Ne rédige aucune phrase du type "aucune donnée X", "X non fourni", "il manque", "données indisponibles" ou équivalent. Cite uniquement les chiffres que tu as. Mentionne le prénom si disponible. Sois direct, encourageant et actionnable.`,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  const data = await apiRes.json();
  if (!apiRes.ok) throw new Error(data.error?.message || 'Erreur API');

  const html = data.content?.find(b => b.type === 'text')?.text || '';
  const summary = {
    avgKcal, avgProtein, avgCarbs, avgFat,
    activeDays: activeDays.length,
    sessionCount,
    weight: recentWeight.length > 0 ? (recentWeight[recentWeight.length - 1].value || recentWeight[recentWeight.length - 1].weight) : null,
    avgSleep: hc?.avgSleep || hc?.lastSleepHours || null,
    avgHR: hc?.restingHR || null,
    hrv: hc?.hrv || null,
  };

  const existing = await udb.get('reportHistory') || [];
  const entry = {
    id: Date.now(),
    title: `Bilan semaine du ${startDate}`,
    days: 7,
    date: endDate,
    html,
    type: 'hebdomadaire',
    summary,
  };
  await udb.set('reportHistory', [entry, ...existing].slice(0, 20));
  await sendExpoPushToUser(userId, '📊 Bilan hebdomadaire prêt', 'Ton bilan de la semaine est disponible dans Santé', { type: 'report' });
  return entry;
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const users = await db.get('auth:users') || [];
  const athletes = users.filter(u => u.role === 'athlete' || u.role === 'Particulier' || !u.role || u.role === 'user');

  const results = { generated: 0, skipped: 0, errors: 0 };

  for (const user of athletes) {
    try {
      const entry = await generateWeeklyReport(user.id);
      if (entry) results.generated++;
      else results.skipped++;
    } catch (e) {
      console.error(`Weekly report error for ${user.id}:`, e.message);
      results.errors++;
    }
  }

  return Response.json({ ok: true, ...results, total: athletes.length });
}
