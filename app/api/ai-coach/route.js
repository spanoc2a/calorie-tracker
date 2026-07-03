import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { getUserWithPlan, isPro, upgradeResponse, checkAiCoachLimit, incrementAiCoachUsage } from '../../lib/planServer';
import { summarizeStravaActivities, formatPace, trainingLoadLabel } from '../../lib/healthContext';
import { rateLimit } from '../../lib/ratelimit';
import { detectLang, LANG_NAMES } from '../../lib/lang';
import { errorText } from '../../lib/pushTexts';

export const maxDuration = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  const born  = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return age;
}

function goalLabel(mode) {
  const map = { loss: 'perte de poids', gain: 'prise de masse', maintain: 'maintien', perte: 'perte de poids', masse: 'prise de masse', maintien: 'maintien' };
  return mode ? (map[mode] || mode) : null;
}

function firstName(fullName) {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0];
}

// muscuSets structure: { exerciseName: { 'YYYY-MM-DD': sets[] } }
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

// ─── Weekly summary (cached in DB, recomputed daily) ──────────────────────────

async function computeAndCacheWeeklySummary(udb, profile, muscuSets, weightLog) {
  const WEEKS = 12;

  // Build date ranges for 12 weeks
  const weekRanges = [];
  for (let w = 0; w < WEEKS; w++) {
    const days = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - w * 7 - d);
      days.push(dt.toISOString().slice(0, 10));
    }
    weekRanges.push({ start: days[0], end: days[6], days });
  }

  // Fetch all 84 days in parallel
  const allDays  = weekRanges.flatMap(w => w.days);
  const allData  = await Promise.all(allDays.map(d => udb.get(`day:${d}`)));
  const dayMap   = Object.fromEntries(allDays.map((d, i) => [d, allData[i] || []]));

  // Weight map: date → weight
  const weightMap = {};
  for (const w of weightLog || []) {
    const d = w.date?.slice(0, 10);
    if (d) weightMap[d] = w.value ?? w.weight;
  }

  // Training dates
  const trainingSet = new Set(getTrainingDates(muscuSets));
  const targetSessions = profile?.muscuDaysPerWeek || null;

  // Month names
  const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  const fmtDay = (d) => { const dt = new Date(d); return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };

  // Build weekly summaries (oldest first)
  const weeks = weekRanges.reverse().map(({ start, end, days }) => {
    const entries    = days.flatMap(d => dayMap[d]);
    const daysLogged = days.filter(d => dayMap[d].length > 0).length;
    const sessions   = days.filter(d => trainingSet.has(d)).length;
    const weights    = days.map(d => weightMap[d]).filter(Boolean);

    let kcalAvg = null, proteinAvg = null, carbsAvg = null, fatAvg = null;
    if (daysLogged > 0) {
      kcalAvg    = Math.round(entries.reduce((a, e) => a + (e.kcal    || 0), 0) / daysLogged);
      proteinAvg = Math.round(entries.reduce((a, e) => a + (e.protein || 0), 0) / daysLogged);
      carbsAvg   = Math.round(entries.reduce((a, e) => a + (e.carbs   || 0), 0) / daysLogged);
      fatAvg     = Math.round(entries.reduce((a, e) => a + (e.fat     || 0), 0) / daysLogged);
    }

    const weightAvg = weights.length > 0
      ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length * 10) / 10
      : null;

    const hitKcalGoal = (kcalAvg != null && profile?.goalKcal)
      ? Math.abs(kcalAvg - profile.goalKcal) <= 250
      : null;

    return {
      label: `${fmtDay(start)}-${fmtDay(end)}`,
      weekStart: start,
      kcalAvg, proteinAvg, carbsAvg, fatAvg,
      daysLogged, sessions, weightAvg, hitKcalGoal,
    };
  });

  // Personal bests (top 6 exercises by max weight)
  const personalBests = [];
  if (muscuSets && typeof muscuSets === 'object') {
    for (const [exercise, byDate] of Object.entries(muscuSets)) {
      let best = null, bestDate = null;
      for (const [date, sets] of Object.entries(byDate || {})) {
        for (const set of (sets || [])) {
          if (set.weight && (!best || set.weight > best)) { best = set.weight; bestDate = date; }
        }
      }
      if (best) personalBests.push({ exercise, weight: best, date: bestDate });
    }
    personalBests.sort((a, b) => b.weight - a.weight).splice(6);
  }

  // Highlights: streaks + best/worst weeks
  let currentStreak = 0, longestStreak = 0, tempStreak = 0;
  let bestWeekLabel = null, bestWeekScore = -1;
  let worstWeekLabel = null, worstWeekScore = 999;

  for (let i = 0; i < weeks.length; i++) {
    const w      = weeks[i];
    const tgt    = targetSessions || 3;
    const score  = (w.hitKcalGoal === true ? 1 : 0) + (w.sessions >= tgt ? 1 : 0) + (w.daysLogged >= 5 ? 1 : 0);
    if (score > bestWeekScore)  { bestWeekScore = score;  bestWeekLabel = w.label; }
    if (score < worstWeekScore && w.daysLogged > 0) { worstWeekScore = score; worstWeekLabel = w.label; }

    const isGoodWeek = w.hitKcalGoal === true && w.sessions >= tgt;
    if (isGoodWeek) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      if (i >= weeks.length - 3) currentStreak = tempStreak;
    } else {
      if (i < weeks.length - 1) tempStreak = 0;
    }
  }

  // Trend detection (last 4 weeks vs previous 4 weeks)
  const recent4   = weeks.slice(-4).filter(w => w.kcalAvg != null);
  const previous4 = weeks.slice(-8, -4).filter(w => w.kcalAvg != null);
  let kcalTrend = null, trainingTrend = null;
  if (recent4.length >= 3 && previous4.length >= 3) {
    const recentKcal   = recent4.reduce((a, w) => a + w.kcalAvg,   0) / recent4.length;
    const previousKcal = previous4.reduce((a, w) => a + w.kcalAvg, 0) / previous4.length;
    const diff = recentKcal - previousKcal;
    if (diff > 200)       kcalTrend = `hausse (+${Math.round(diff)} kcal/j vs mois précédent)`;
    else if (diff < -200) kcalTrend = `baisse (${Math.round(diff)} kcal/j vs mois précédent)`;

    const recentSess   = recent4.reduce((a, w) => a + w.sessions,   0) / recent4.length;
    const previousSess = previous4.reduce((a, w) => a + w.sessions, 0) / previous4.length;
    const sdiff = recentSess - previousSess;
    if (sdiff > 0.5)       trainingTrend = `progression (+${sdiff.toFixed(1)} séances/sem vs mois précédent)`;
    else if (sdiff < -0.5) trainingTrend = `régression (${sdiff.toFixed(1)} séances/sem vs mois précédent)`;
  }

  const summary = {
    computedAt: new Date().toISOString(),
    weeks,
    personalBests,
    highlights: {
      currentStreak,
      longestStreak,
      bestWeekLabel,
      kcalTrend,
      trainingTrend,
    },
  };

  await udb.set('coachWeeklySummary', summary);
  return summary;
}

function buildWeeklySummarySection(summary, targetSessions) {
  if (!summary?.weeks?.length) return 'Pas encore assez de données pour les tendances.';

  const target = targetSessions || 3;
  const lines  = [];

  for (const w of summary.weeks) {
    if (w.daysLogged === 0 && w.sessions === 0) continue;
    const parts = [];
    if (w.kcalAvg != null) {
      const flag = w.hitKcalGoal === true ? ' ✓' : w.hitKcalGoal === false ? ' ⚠' : '';
      parts.push(`${w.kcalAvg} kcal/j${flag}`);
    }
    if (w.proteinAvg != null) parts.push(`${w.proteinAvg}g prot`);
    parts.push(`${w.sessions}/${target} séances${w.sessions >= target ? ' ✓' : ''}`);
    if (w.weightAvg) parts.push(`${w.weightAvg} kg`);
    if (w.daysLogged < 4 && w.kcalAvg != null) parts.push(`(${w.daysLogged}j tracés)`);
    lines.push(`${w.label}: ${parts.join(' | ')}`);
  }

  const h = summary.highlights;
  if (h) {
    if (h.currentStreak >= 2) lines.push(`\nSérie actuelle: ${h.currentStreak} semaines consécutives d'objectifs atteints 🔥`);
    if (h.longestStreak > h.currentStreak) lines.push(`Record série: ${h.longestStreak} semaines`);
    if (h.kcalTrend) lines.push(`Tendance calories: ${h.kcalTrend}`);
    if (h.trainingTrend) lines.push(`Tendance entraînement: ${h.trainingTrend}`);
    if (h.bestWeekLabel) lines.push(`Meilleure semaine: ${h.bestWeekLabel}`);
  }

  if (summary.personalBests?.length > 0) {
    lines.push('\nRecords personnels: ' + summary.personalBests.map(p => `${p.exercise} ${p.weight} kg`).join(', '));
  }

  return lines.join('\n');
}

// ─── Daily insights (real-time, computed on every request) ────────────────────

function computeDailyInsights(profile, hc, todayEntries, avgJournal, muscuSets, muscuProgram, weightLog, stravaActivities) {
  const entries    = todayEntries || [];
  const trainingDates = getTrainingDates(muscuSets);
  const insights   = [];

  // Calories today
  if (profile?.goalKcal) {
    const eaten = Math.round(entries.reduce((a, e) => a + (e.kcal || 0), 0));
    const goal  = profile.goalKcal;
    const rem   = goal - eaten;
    if (entries.length === 0) {
      insights.push(`⚠ Aucun repas enregistré aujourd'hui (objectif: ${goal} kcal)`);
    } else if (rem > 400) {
      insights.push(`↑ Calories: ${eaten}/${goal} kcal — ${rem} kcal restantes`);
    } else if (rem < -300) {
      insights.push(`↓ Calories: ${eaten}/${goal} kcal — dépassement de ${Math.abs(rem)} kcal`);
    } else {
      insights.push(`✓ Calories: ${eaten}/${goal} kcal (dans l'objectif)`);
    }
  }

  // Protein today
  if (profile?.goalProtein && entries.length > 0) {
    const protein = Math.round(entries.reduce((a, e) => a + (e.protein || 0), 0));
    const rem     = profile.goalProtein - protein;
    if (rem > 40) insights.push(`↑ Protéines: ${protein}/${profile.goalProtein}g — encore ${rem}g`);
    else          insights.push(`✓ Protéines: ${protein}/${profile.goalProtein}g`);
  }

  // 7-day calorie trend
  if (avgJournal && profile?.goalKcal) {
    const diff = avgJournal.kcal - profile.goalKcal;
    if (diff < -400)      insights.push(`⚠ Tendance 7j: ${avgJournal.kcal} kcal/j — déficit chronique de ${Math.abs(diff)} kcal/j`);
    else if (diff > 400)  insights.push(`⚠ Tendance 7j: ${avgJournal.kcal} kcal/j — excédent de ${diff} kcal/j`);
  }

  // Sleep
  const sleep = hc?.lastSleepHours ?? hc?.avgSleep ?? null;
  if (sleep !== null) {
    if (sleep < 5.5)      insights.push(`🔴 Sommeil: ${sleep}h — très insuffisant (réduire intensité, +glucides)`);
    else if (sleep < 6.5) insights.push(`🟡 Sommeil: ${sleep}h — court (performance réduite)`);
    else if (sleep < 7.5) insights.push(`🟡 Sommeil: ${sleep}h — légèrement sous l'optimal`);
    else                  insights.push(`✓ Sommeil: ${sleep}h`);
  }

  // Sommeil profond (phases) — indicateur de récupération physique
  if (hc?.sleepStages) {
    const st = hc.sleepStages; const tot = (st.deep || 0) + (st.light || 0) + (st.rem || 0);
    if (tot > 0) {
      const dp = Math.round(st.deep / tot * 100);
      if (dp < 13)       insights.push(`🟡 Sommeil profond: ${dp}% — peu réparateur (récup physique limitée)`);
      else if (dp >= 18) insights.push(`✓ Sommeil profond: ${dp}% — excellente récupération physique`);
    }
  }

  // HRV
  if (hc?.hrv) {
    if (hc.hrv < 25)      insights.push(`🔴 HRV: ${hc.hrv} ms — récupération critique, repos ou séance légère`);
    else if (hc.hrv < 40) insights.push(`🟡 HRV: ${hc.hrv} ms — fatigue détectée`);
  }

  // Resting HR
  if (hc?.restingHR) {
    if (hc.restingHR > 75) insights.push(`🟡 FC repos: ${hc.restingHR} bpm — élevée (surveiller)`);
    else                   insights.push(`✓ FC repos: ${hc.restingHR} bpm`);
  }

  // Steps
  if (hc?.steps != null) {
    if (hc.steps < 3000)       insights.push(`↓ Pas: ${hc.steps} aujourd'hui (très sédentaire)`);
    else if (hc.steps > 14000) insights.push(`✓ Pas: ${hc.steps} aujourd'hui (très actif)`);
  }

  // Training this week
  if (muscuProgram?.daysPerWeek) {
    const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const done   = trainingDates.filter(d => d >= weekAgoStr).length;
    const target = muscuProgram.daysPerWeek;
    if (done === 0)         insights.push(`⚠ Muscu: aucune séance cette semaine (objectif: ${target}/sem)`);
    else if (done < target) insights.push(`Muscu: ${done}/${target} séances cette semaine`);
    else                    insights.push(`✓ Muscu: ${done}/${target} séances (objectif atteint)`);

    if (trainingDates.length > 0) {
      const lastDate  = trainingDates[trainingDates.length - 1];
      const daysSince = Math.floor((Date.now() - new Date(lastDate)) / 86400000);
      if (daysSince > 3 && done < target) insights.push(`Dernière séance: il y a ${daysSince} jours`);
    }
  }

  // Weight trend (recent)
  if (weightLog?.length >= 3) {
    const recent = weightLog.slice(-5);
    const oldest = recent[0]?.value ?? recent[0]?.weight;
    const newest = recent[recent.length - 1]?.value ?? recent[recent.length - 1]?.weight;
    if (oldest && newest) {
      const diff = parseFloat((newest - oldest).toFixed(1));
      const mode = profile?.mode;
      if (Math.abs(diff) >= 0.5) {
        const trend   = diff > 0 ? `+${diff} kg` : `${diff} kg`;
        const aligned =
          (diff > 0 && (mode === 'gain' || mode === 'masse'))  ? ' (aligné objectif masse)' :
          (diff < 0 && (mode === 'loss' || mode === 'perte'))  ? ' (aligné objectif perte)' :
          (diff > 0 && (mode === 'loss' || mode === 'perte'))  ? ' ⚠ (hausse — objectif perte)' :
          (diff < 0 && (mode === 'gain' || mode === 'masse'))  ? ' ⚠ (baisse — objectif masse)' : '';
        insights.push(`Poids récent: ${newest} kg (${trend}${aligned})`);
      }
    }
  }

  // Strava today
  if (stravaActivities?.activities?.length) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayActs = stravaActivities.activities.filter(a => a.date === todayStr);
    if (todayActs.length > 0) {
      const burned = todayActs.reduce((a, act) => a + (act.caloriesAdjusted || act.calories || 0), 0);
      const names  = todayActs.map(a => a.typeLabel).join(', ');
      insights.push(`⚡ Strava aujourd'hui: ${names} — ${burned} kcal brûlées`);
    }

    // Charge d'entraînement Strava sur 7j (suffer_score) — signal de récup/volume
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = stravaActivities.activities.filter(a => (a.date || '') >= cutoff);
    const s = summarizeStravaActivities(recent);
    if (s) {
      if (s.sufferTotal != null) {
        const label = trainingLoadLabel(s.sufferTotal);
        if (label === 'élevée')      insights.push(`🟡 Charge sport 7j élevée (suffer ${s.sufferTotal}, ${s.count} séances) — surveiller la récupération`);
        else if (label === 'faible') insights.push(`Charge sport 7j faible (suffer ${s.sufferTotal}) — marge pour intensifier`);
      }
      if (s.totalKcal > 0) insights.push(`⚡ Dépense sport 7j: ${s.totalKcal} kcal sur ${s.count} séance(s) — penser à recharger les jours actifs`);
    }
  }

  return insights;
}

// ─── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(prenom, profile, muscuProgram, nutritionProgram, avgJournal, todayEntries, hc, weightLog, bloodTests, muscuSets, weeklySummary, stravaActivities, lang = 'fr') {
  const age   = calcAge(profile?.birthdate);
  const label = prenom || 'l\'utilisateur';

  const dailyInsights = computeDailyInsights(profile, hc, todayEntries, avgJournal, muscuSets, muscuProgram, weightLog, stravaActivities);
  const insightsBlock = dailyInsights.length > 0 ? dailyInsights.join('\n') : 'Pas encore de données aujourd\'hui.';

  const profilBlock = [
    `Prénom: ${prenom || 'non renseigné'}`,
    `Sexe: ${profile?.sex || '?'}, Poids: ${profile?.weight ? profile.weight + ' kg' : '?'}, Taille: ${profile?.height ? profile.height + ' cm' : '?'}, Âge: ${age ? age + ' ans' : '?'}`,
    `Objectif: ${goalLabel(profile?.mode) || '?'}`,
    `Cibles: ${profile?.goalKcal || '?'} kcal | ${profile?.goalProtein || '?'}g prot | ${profile?.goalCarbs || '?'}g gluc | ${profile?.goalFat || '?'}g lip`,
    profile?.healthHistory ? `Historique santé: ${profile.healthHistory}` : null,
  ].filter(Boolean).join('\n');

  let muscuBlock = 'Aucun programme muscu.';
  if (muscuProgram) {
    const seances = (muscuProgram.days || []).map(d => `${d.day} (${d.label})`).join(', ');
    muscuBlock = `${muscuProgram.daysPerWeek || '?'}j/sem, objectif ${muscuProgram.goal || '?'}, niveau ${muscuProgram.level || '?'}${seances ? '\nSéances: ' + seances : ''}`;
  }

  let nutritionBlock = 'Aucun programme nutritionnel.';
  if (nutritionProgram?.days?.length > 0) {
    const days = nutritionProgram.days.map(d => {
      const kcal = (d.meals || []).reduce((a, m) => a + (m.totalKcal || 0), 0);
      return `${d.day}: ${Math.round(kcal)} kcal`;
    }).join(', ');
    nutritionBlock = `(${nutritionProgram.manual ? 'manuel' : 'IA'}, ${nutritionProgram.generatedAt?.slice(0, 10) || '?'}) ${days}`;
  }

  const journalBlock = avgJournal
    ? `${avgJournal.kcal} kcal/j | ${avgJournal.protein}g prot | ${avgJournal.carbs}g gluc | ${avgJournal.fat}g lip`
    : 'Pas de données récentes.';

  const todayBlock = (() => {
    const e = todayEntries || [];
    if (e.length === 0) return 'Aucun repas enregistré.';
    const byMeal = {};
    for (const item of e) {
      const m = item.meal || 'Repas';
      if (!byMeal[m]) byMeal[m] = [];
      byMeal[m].push(`${item.name} (${Math.round(item.kcal || 0)} kcal)`);
    }
    const lines = Object.entries(byMeal).map(([m, items]) => `${m}: ${items.join(', ')}`);
    lines.push(`→ Total: ${Math.round(e.reduce((a,i)=>a+(i.kcal||0),0))} kcal | ${Math.round(e.reduce((a,i)=>a+(i.protein||0),0))}g prot`);
    return lines.join('\n');
  })();

  const hcParts = [];
  if (hc?.avgSteps)  hcParts.push(`Pas moy: ${hc.avgSteps}/j`);
  if (hc?.restingHR) hcParts.push(`FC repos: ${hc.restingHR} bpm`);
  if (hc?.avgHR)     hcParts.push(`FC moy: ${hc.avgHR} bpm`);
  if (hc?.maxHR)     hcParts.push(`FC max: ${hc.maxHR} bpm`);
  if (hc?.hrv)       hcParts.push(`HRV: ${hc.hrv} ms`);
  if (hc?.avgSleep)  hcParts.push(`Sommeil moy: ${hc.avgSleep}h`);
  if (hc?.sleepStages) {
    const st = hc.sleepStages; const tot = (st.deep || 0) + (st.light || 0) + (st.rem || 0);
    if (tot > 0) hcParts.push(`Profond ${Math.round(st.deep / tot * 100)}%`);
  }
  if (hc?.spo2)      hcParts.push(`SpO2: ${hc.spo2}%`);
  const hcBlock = hcParts.length ? hcParts.join(' | ') : 'Aucune donnée capteur.';

  const stravaBlock = (() => {
    const acts = stravaActivities?.activities;
    if (!acts?.length) return 'Aucune activité Strava récente.';
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = acts.filter(a => (a.date || '') >= cutoff);
    if (!recent.length) return 'Aucune activité Strava cette semaine.';

    const s = summarizeStravaActivities(recent);
    const summaryParts = [`${s.count} séance(s) · ${s.totalDurationMin} min · ${s.totalKcal} kcal (caloriesAdjusted)`];
    if (s.totalDistanceKm > 0) summaryParts.push(`${s.totalDistanceKm} km`);
    if (s.totalElevation > 0) summaryParts.push(`+${s.totalElevation} m D+`);
    if (s.avgHr != null) summaryParts.push(`FC moy ${s.avgHr}${s.maxHr != null ? `/max ${s.maxHr}` : ''} bpm`);
    if (s.sufferTotal != null) summaryParts.push(`charge ${trainingLoadLabel(s.sufferTotal)} (suffer ${s.sufferTotal})`);
    if (s.avgWatts != null) summaryParts.push(`${s.avgWatts} W`);

    const lines = recent.map(a => {
      const dur  = Math.floor((a.duration || 0) / 60);
      const dist = a.distance > 0 ? ` · ${(a.distance / 1000).toFixed(1)} km` : '';
      const pace = formatPace(a); const paceStr = pace ? ` · ${pace}` : '';
      const hr   = a.avg_hr != null ? ` · FC ${a.avg_hr}` : '';
      const suf  = a.suffer_score != null ? ` · effort ${a.suffer_score}` : '';
      const kcal = a.caloriesAdjusted || a.calories || 0;
      return `${a.date}: ${a.typeLabel || a.type} ${dur}min${dist}${paceStr}${hr}${suf} · ${kcal} kcal`;
    });
    return `Total 7j: ${summaryParts.join(' · ')}\n` + lines.join('\n');
  })();

  const bloodBlock = (() => {
    if (!bloodTests?.length) return 'Aucun bilan.';
    const latest = bloodTests[0];
    const date   = latest.date || latest.uploadedAt?.slice(0, 10) || '?';
    const bad    = (latest.markers || []).filter(m => m.status === 'warn' || m.status === 'bad');
    if (bad.length === 0) return `Bilan du ${date}: tous marqueurs OK.`;
    return `Bilan du ${date} — hors norme:\n` + bad.map(m =>
      `${m.name}: ${m.value}${m.unit} (réf ${m.refMin ?? '?'}-${m.refMax ?? '?'}, ${m.status === 'bad' ? 'ANORMAL' : 'limite'})`
    ).join('\n');
  })();

  const weightBlock = weightLog?.length > 0
    ? weightLog.slice(-3).map(e => `${e.value ?? e.weight ?? '?'} kg (${e.date})`).join(', ')
    : 'Pas de données.';

  const weeklyBlock = buildWeeklySummarySection(weeklySummary, muscuProgram?.daysPerWeek);

  return `Tu es le coach IA personnel de ${label}. Pas un chatbot — un vrai coach qui suit l'évolution sur 3 mois et adapte ses conseils à l'état réel de ${label} chaque jour.

COMPORTEMENT :
- Réponds à la question EN PREMIER, de façon concise et pratique (3-5 phrases en général)
- Utilise les données pour personnaliser chaque réponse — jamais de conseil générique
- Appelle toujours ${label} par son prénom, naturellement
- Si les données du jour ou les tendances révèlent quelque chose d'important, mentionne-le en 1 phrase (max)
- Sois direct, chaleureux, motivant — comme un coach de haut niveau
- Repère les progressions pour féliciter sincèrement, les dérives pour recadrer sans juger

RÈGLES D'ADAPTATION AUTOMATIQUE :
- Sommeil < 6h → réduire intensité entraînement, suggérer +glucides pour l'énergie
- HRV < 30 ms ou FC repos > 75 bpm → récupération prioritaire sur performance
- Charge sport Strava 7j élevée (suffer_score) → prudence : alléger volume/intensité, prioriser récup et glucides ; faible → marge pour intensifier. Adapter les calories à la dépense réelle (caloriesAdjusted) les jours actifs. N'invente jamais une donnée Strava absente.
- Déficit calorique chronique (tendance 7j) → ne pas couper davantage, ajuster à la hausse
- Dérive sur plusieurs semaines (tendances 12 sem) → recadrer progressivement, identifier la cause
- Série de bonnes semaines → féliciter et encourager à maintenir
- Records personnels → les mentionner comme motivation quand pertinent

[ÉTAT DU JOUR — indicateurs en temps réel]
${insightsBlock}

[PROFIL]
${profilBlock}

[PROGRAMME MUSCU]
${muscuBlock}

[PROGRAMME NUTRITION]
${nutritionBlock}

[JOURNAL (6 derniers jours, moyenne)]
${journalBlock}

[REPAS D'AUJOURD'HUI]
${todayBlock}

[CAPTEURS / HEALTH CONNECT]
${hcBlock}

[ACTIVITÉS STRAVA (7 derniers jours)]
${stravaBlock}

[BILAN SANGUIN]
${bloodBlock}

[POIDS RÉCENT]
${weightBlock}

[TENDANCES 12 SEMAINES — historique complet]
${weeklyBlock}${lang !== 'fr' ? `\n\nIMPORTANT: The user speaks ${LANG_NAMES[lang] || 'English'}. ALWAYS reply entirely in ${LANG_NAMES[lang] || 'English'} (the data above stays in French — never quote it verbatim, rephrase it in the user's language).` : ''}`;
}

// ─── Daily brief (generated once per day via Claude Haiku) ────────────────────

async function generateDailyBrief(prenom, profile, hc, todayEntries, avgJournal, muscuSets, muscuProgram, weightLog, weeklySummary, stravaActivities, lang = 'fr') {
  const label    = prenom || 'toi';
  const insights = computeDailyInsights(profile, hc, todayEntries, avgJournal, muscuSets, muscuProgram, weightLog, stravaActivities);
  const priority = insights.filter(i => /^[⚠🔴🟡↑↓]/.test(i));
  const toShow   = (priority.length > 0 ? priority : insights).slice(0, 3);
  if (toShow.length === 0) return null;

  // Add a long-term highlight if available
  const h = weeklySummary?.highlights;
  const longTermNote = h?.currentStreak >= 3
    ? `Série: ${h.currentStreak} semaines consécutives d'objectifs atteints.`
    : h?.trainingTrend?.includes('régression')
    ? `Tendance entraînement: ${h.trainingTrend}`
    : h?.kcalTrend?.includes('baisse')
    ? `Tendance calories: ${h.kcalTrend}`
    : null;

  const contextLines = [...toShow, ...(longTermNote ? [longTermNote] : [])];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 130,
      system:     `Tu es le coach IA personnel de ${label}. Génère un message d'accueil du jour (2-3 phrases MAX). Chaleureux, direct, UN conseil concret. ${
        lang === 'en' ? `Start with "Good morning ${label}!" or a natural variant. No lists — natural coach sentences. Write the ENTIRE message in English.`
        : lang === 'es' ? `Empieza con "¡Buenos días ${label}!" o una variante natural. Sin listas — frases naturales de coach. Escribe TODO el mensaje en español (tuteo).`
        : `Commence par "Bonjour ${label} !" ou variante naturelle. Pas de liste — phrases naturelles de coach. En français.`}`,
      messages:   [{ role: 'user', content: `Données du jour:\n${contextLines.join('\n')}` }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.find(b => b.type === 'text')?.text?.trim() || null;
}

// ─── Shared data loader ──────────────────────────────────────────────────────

async function loadFullContext(udb, today) {
  const last6 = Array.from({ length: 6 }, (_, i) => getDateString(i + 1));

  const [profile, muscuProgram, nutritionProgram, hc, journalDays, todayEntries, weightLog, bloodTests, muscuSets, existingHistory, cachedSummary, stravaCache] = await Promise.all([
    udb.get('userSettings'),
    udb.get('muscuProgram'),
    udb.get('nutritionProgram'),
    udb.get('healthConnectData'), // FIX: la donnée est stockée sous 'healthConnectData' (avant: 'healthconnect' → toujours null)
    Promise.all(last6.map(d => udb.get(`day:${d}`))),
    udb.get(`day:${today}`),
    udb.get('weightLog'),
    udb.get('bloodTests'),
    udb.get('muscuSets'),
    udb.get('aiCoachHistory'),
    udb.get('coachWeeklySummary'),
    udb.get('stravaCache'),
  ]);

  // 6-day average (excluding today)
  let avgJournal = null;
  const activeDays = journalDays.filter(d => Array.isArray(d) && d.length > 0);
  if (activeDays.length > 0) {
    let tK = 0, tP = 0, tC = 0, tF = 0;
    for (const day of activeDays) for (const e of day) {
      tK += e.kcal || 0; tP += e.protein || 0; tC += e.carbs || 0; tF += e.fat || 0;
    }
    const n = activeDays.length;
    avgJournal = { kcal: Math.round(tK/n), protein: Math.round(tP/n), carbs: Math.round(tC/n), fat: Math.round(tF/n) };
  }

  return { profile, muscuProgram, nutritionProgram, hc, avgJournal, todayEntries: todayEntries || [], weightLog, bloodTests, muscuSets, existingHistory, cachedSummary, stravaCache };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb  = userDb(auth.userId);
  const today = getDateString(0);

  // Peek mode: just check if there's an unread brief today (no generation)
  const url = new URL(req.url);
  if (url.searchParams.get('peek') === '1') {
    const history = await udb.get('aiCoachHistory') || [];
    const last = history[history.length - 1];
    const hasBrief = last?.date?.slice(0, 10) === today && last?.source === 'daily';
    return Response.json({ hasBrief });
  }

  const history = await udb.get('aiCoachHistory') || [];

  // Fast path: already have a message today
  const lastMsgDate = history[history.length - 1]?.date?.slice(0, 10);
  if (lastMsgDate === today) return Response.json({ history });

  // New day: generate daily brief + recompute weekly summary if stale
  try {
    const user = await getUserWithPlan(auth.userId);
    if (!user || !isPro(user.activePlan)) return Response.json({ history });

    const ctx = await loadFullContext(udb, today);

    // Recompute weekly summary if missing or older than 20 hours
    const summaryAge = ctx.cachedSummary?.computedAt
      ? (Date.now() - new Date(ctx.cachedSummary.computedAt)) / 3600000
      : 999;
    const weeklySummary = summaryAge > 20
      ? await computeAndCacheWeeklySummary(udb, ctx.profile, ctx.muscuSets, ctx.weightLog)
      : ctx.cachedSummary;

    const prenom = firstName(auth.name || user?.name);
    const brief  = await generateDailyBrief(
      prenom, ctx.profile, ctx.hc, ctx.todayEntries, ctx.avgJournal,
      ctx.muscuSets, ctx.muscuProgram, ctx.weightLog, weeklySummary, ctx.stravaCache,
      detectLang(req)
    );

    if (brief) {
      const dailyMsg   = { role: 'assistant', content: brief, date: new Date().toISOString(), source: 'daily' };
      const newHistory = [...history, dailyMsg].slice(-50);
      await udb.set('aiCoachHistory', newHistory);
      return Response.json({ history: newHistory });
    }
  } catch {}

  return Response.json({ history });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const auth = await requireAuth(req); if (auth.error) return auth.error;
    const lang = detectLang(req);
    const allowed = await rateLimit(`ai-coach:${auth.userId}`, 20, 3_600_000);
    if (!allowed) return Response.json({ error: errorText(lang, 'err_too_many_requests') }, { status: 429 });
    // Élève rattaché à un coach : pas de coach IA (il parle à son vrai coach).
    if (await userDb(auth.userId).get('coachId')) return Response.json({ error: 'COACH_MANAGED', message: errorText(lang, 'coach_managed_ai') }, { status: 403 });

    const user = await getUserWithPlan(auth.userId);
    if (!user || !isPro(user.activePlan)) return upgradeResponse('ai_coach');

    const access = await checkAiCoachLimit(auth.userId);
    if (!access.allowed) return Response.json({
      error: 'LIMIT_REACHED',
      limitLabel: access.limitLabel || `${access.limit} messages/mois`,
      count: access.count,
      limit: access.limit,
    }, { status: 429 });

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message manquant' }, { status: 400 });
    }

    const udb   = userDb(auth.userId);
    const today = getDateString(0);

    const ctx = await loadFullContext(udb, today);

    const muscuSummary = ctx.muscuProgram ? {
      goal: ctx.muscuProgram.goal, level: ctx.muscuProgram.level,
      daysPerWeek: ctx.muscuProgram.daysPerWeek,
      days: (ctx.muscuProgram.days || []).map(d => ({ day: d.day, label: d.label })),
    } : null;

    const prenom       = firstName(auth.name || user?.name);
    const recentWeight = ctx.weightLog ? ctx.weightLog.slice(-5) : [];

    // Use cached weekly summary (recompute only if very stale, non-blocking for chat)
    let weeklySummary = ctx.cachedSummary;
    if (!weeklySummary) {
      weeklySummary = await computeAndCacheWeeklySummary(udb, ctx.profile, ctx.muscuSets, ctx.weightLog);
    }

    const systemPrompt = buildSystemPrompt(
      prenom, ctx.profile, muscuSummary, ctx.nutritionProgram,
      ctx.avgJournal, ctx.todayEntries, ctx.hc,
      recentWeight, ctx.bloodTests, ctx.muscuSets, weeklySummary, ctx.stravaCache,
      lang
    );

    // Sanitize history: strict alternating roles (Anthropic requirement)
    const sanitized = [];
    for (const m of history.slice(-14)) {
      if (!m.role || !m.content) continue;
      if (sanitized.length === 0 && m.role !== 'user') continue;
      if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === m.role) continue;
      sanitized.push({ role: m.role, content: m.content });
    }

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 600,
        system:     systemPrompt,
        messages:   [...sanitized, { role: 'user', content: message }],
      }),
    });

    const apiData = await apiRes.json();
    if (!apiRes.ok) return Response.json({ error: apiData.error?.message || 'Erreur API' }, { status: 500 });

    const reply = apiData.content?.find(b => b.type === 'text')?.text || '';

    const now        = new Date().toISOString();
    const newHistory = [
      ...(ctx.existingHistory || []),
      { role: 'user',      content: message, date: now },
      { role: 'assistant', content: reply,   date: now },
    ].slice(-50);
    await Promise.all([
      udb.set('aiCoachHistory', newHistory),
      incrementAiCoachUsage(auth.userId, access.usageKey),
    ]);

    return Response.json({ reply, remaining: access.limit === Infinity ? null : access.limit - access.count - 1 });
  } catch (e) {
    console.error('ai-coach error:', e);
    return Response.json({ error: e.message || 'Erreur serveur' }, { status: 500 });
  }
}
