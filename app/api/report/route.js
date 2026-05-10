import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { checkReportAccess, incrementReportUsage, upgradeResponse } from '../../lib/planServer';

export const maxDuration = 300;

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

function dateKey(d) { return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); }

function calcAge(birthdate) {
  if (!birthdate) return null;
  const age = Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 3600 * 1000));
  return age > 0 ? age : null;
}

function goalsForDate(history, date, fallback) {
  if (!history || history.length === 0) return fallback;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let applicable = fallback;
  for (const s of sorted) { if (s.date <= date) applicable = s; }
  return applicable;
}

function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (i + 1)); return dateKey(d);
  });
}

// ─── Strava ──────────────────────────────────────────────────────────────────
async function fetchStravaToken(udb) {
  const cached = await udb.get('strava:token');
  if (!cached) return null;
  if (Date.now() / 1000 < cached.expires_at - 300) return cached.access_token;
  if (!cached.refresh_token) return null;

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, refresh_token: cached.refresh_token, grant_type: 'refresh_token' }),
  });
  const data = await res.json();
  if (!res.ok) return null;
  await udb.set('strava:token', { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, athlete: cached?.athlete });
  return data.access_token;
}

const MET_REPORT = { Run:10, TrailRun:11, Ride:8, VirtualRide:8, Swim:9, WeightTraining:6, Walk:4, Hike:6, Yoga:3, Workout:7, Crossfit:9 };
const CORRECTION_REPORT = { WeightTraining:0.72, Crossfit:0.75, Workout:0.75, Yoga:0.80, Swim:0.85, VirtualRide:0.88, Ride:0.90, Hike:0.90, Walk:0.92, Run:0.92, TrailRun:0.90 };
function estCal(type, sec, cal, kj) {
  const c = CORRECTION_REPORT[type] || 0.85;
  if (cal > 0) return Math.round(cal * c);
  if (kj > 0) return Math.round(kj * 0.956 * c);
  return Math.round((MET_REPORT[type] || 7) * 70 * (sec / 3600) * c);
}

async function fetchStravaActivities(days = 90, udb) {
  const token = await fetchStravaToken(udb);
  if (!token) return [];

  const after = Math.floor(Date.now() / 1000) - days * 86400;
  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map(a => {
    const type = a.sport_type || a.type || 'Workout';
    return {
      date: (a.start_date_local || a.start_date || '').slice(0, 10),
      type,
      name: a.name,
      duration: a.moving_time || 0,
      distance: a.distance || 0,
      calories: estCal(type, a.moving_time || 0, a.calories || 0, a.kilojoules || 0),
      avg_hr: a.average_heartrate || null,
      max_hr: a.max_heartrate || null,
      suffer_score: a.suffer_score || null,
      elevation: a.total_elevation_gain || null,
      avg_speed: a.average_speed || null,
      avg_cadence: a.average_cadence || null,
      avg_watts: a.average_watts || null,
      pr_count: a.pr_count || 0,
    };
  });
}

// ─── Food summary ─────────────────────────────────────────────────────────────
async function fetchFoodSummaryWithHistory(goalsHistory, fallback, udb, days = 90) {
  const dates = getLastNDates(days);
  const all = await Promise.all(dates.map(dk => udb.get(`day:${dk}`).then(e => ({ dk, entries: e || [] }))));
  const active = all.filter(d => d.entries.length > 0);
  if (active.length === 0) return { activeDays: 0, periods: [], topFoods: [], byDate: {} };

  const periodMap = {};
  const foodCount = {};
  const byDate = {};

  for (const { dk, entries } of active) {
    const goals = goalsForDate(goalsHistory, dk, fallback);
    const periodKey = `${goals.date || 'initial'}|${goals.goalKcal}|${goals.goalProtein}`;
    if (!periodMap[periodKey]) {
      periodMap[periodKey] = { since: goals.date || '—', goalKcal: goals.goalKcal, goalProtein: goals.goalProtein, goalCarbs: goals.goalCarbs, goalFat: goals.goalFat, weight: goals.weight, days: 0, totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
    }
    const p = periodMap[periodKey];
    p.days++;
    let dayKcal = 0, dayProtein = 0;
    for (const e of entries) {
      p.totalKcal += e.kcal || 0; dayKcal += e.kcal || 0;
      p.totalProtein += e.protein || 0; dayProtein += e.protein || 0;
      p.totalCarbs += e.carbs || 0;
      p.totalFat += e.fat || 0;
      const n = (e.name || '').trim();
      foodCount[n] = (foodCount[n] || 0) + 1;
    }
    byDate[dk] = { kcal: dayKcal, protein: dayProtein };
  }

  const periods = Object.values(periodMap).map(p => ({
    since: p.since, goalKcal: p.goalKcal, goalProtein: p.goalProtein, goalCarbs: p.goalCarbs, goalFat: p.goalFat,
    weight: p.weight, days: p.days,
    avgKcal: Math.round(p.totalKcal / p.days), avgProtein: Math.round(p.totalProtein / p.days),
    avgCarbs: Math.round(p.totalCarbs / p.days), avgFat: Math.round(p.totalFat / p.days),
  })).sort((a, b) => (a.since || '').localeCompare(b.since || ''));

  const topFoods = Object.entries(foodCount).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([n,c])=>`${n} (${c}×)`);
  return { activeDays: active.length, periods, topFoods, byDate };
}

// ─── Rapport santé ────────────────────────────────────────────────────────────
async function healthReport(profile, udb, lang = 'fr') {
  const bloodTestsRaw = (await udb.get('bloodTests') || []).slice(0, 5).reverse();
  if (bloodTestsRaw.length === 0) return { html: '<p>Aucun bilan de santé importé.</p>' };

  const markerHistory = {};
  for (const test of bloodTestsRaw) {
    const label = `${test.reportType || 'Bilan'} du ${test.date || test.uploadedAt?.slice(0,10) || '?'}`;
    for (const m of (test.markers || [])) {
      if (!markerHistory[m.name]) markerHistory[m.name] = [];
      markerHistory[m.name].push({ label, value: m.value, unit: m.unit, refMin: m.refMin, refMax: m.refMax, status: m.status });
    }
  }

  const markerLines = Object.entries(markerHistory).map(([name, vals]) => {
    let trend = '—';
    if (vals.length >= 2) { const diff = vals[vals.length-1].value - vals[0].value; trend = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'; }
    return `${name} [${trend}] : ${vals.map(v=>`${v.label}: ${v.value}${v.unit} (${v.status})`).join(' → ')}`;
  }).join('\n');

  const age = calcAge(profile.birthdate);
  const profileCtx = age ? `Patient : ${profile.sex||''}, ${age} ans${profile.weight?', '+profile.weight+' kg':''}` : '';

  const langInstr = lang !== 'fr' ? `\nIMPORTANT: Write the entire report in ${LANG_NAMES[lang] || 'English'}.` : '';
  const system = `Tu es un médecin biologiste rédigeant un compte-rendu clinique de biologie médicale. Ton rôle est d'interpréter les résultats d'analyses médicales, pas de donner des conseils alimentaires généraux.
HTML simple uniquement : <h2>,<p>,<ul>,<li>,<strong>. Aucun html/head/body/style. Cite toujours les valeurs exactes et les normes de référence.
IMPORTANT : n'invente JAMAIS de valeurs ou de marqueurs. Cite uniquement les données explicitement fournies.
Structure OBLIGATOIRE :
<h2>Interprétation globale du bilan</h2> — statut général, nombre de marqueurs hors norme, gravité
<h2>Marqueurs normaux — points rassurants</h2> — liste les marqueurs ok avec leurs valeurs
<h2>Marqueurs à surveiller</h2> — pour chaque marqueur hors norme : valeur observée vs norme, signification clinique, causes possibles
<h2>Évolution des marqueurs</h2> — si plusieurs bilans : compare les valeurs, note les tendances ↑↓→, quels marqueurs s'améliorent ou se dégradent
<h2>Compléments nutritionnels à envisager</h2> — uniquement si des marqueurs sont déficients : suppléments ciblés avec dosages
<h2>Examens complémentaires recommandés</h2> — quels bilans refaire, à quelle échéance, quel médecin consulter
Important : NE PAS répéter les recommandations alimentaires générales — elles sont couvertes par le rapport nutritionnel séparé.${langInstr}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 6000, system, messages: [{ role: 'user', content: `${profileCtx}\n${bloodTestsRaw.length} bilan(s).\nMarqueurs :\n${markerLines}\n\nRédige le compte-rendu. Sois concis : 2-3 phrases par section maximum.` }] }),
  });
  const data = await apiRes.json();
  if (!apiRes.ok) return { error: data.error?.message || `Erreur API ${apiRes.status}` };
  return { html: data.content?.find(b => b.type === 'text')?.text || '' };
}

// ─── Rapport nutrition + sport ────────────────────────────────────────────────
async function nutritionReport(profile, udb, lang = 'fr') {
  const { sex, birthdate, height, weight, goalKcal, goalProtein, goalCarbs, goalFat, days = 90, prevReports = [] } = profile;
  const age = calcAge(birthdate);

  const periodDates = Array.from({ length: days }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dateKey(d); });

  const stravaTimeout = new Promise(resolve => setTimeout(() => resolve([]), 6000));
  // Limiter à 30 jours de lectures DB pour éviter le timeout
  const dbDays = Math.min(days, 30);
  const dbDates = Array.from({ length: dbDays }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dateKey(d); });

  const [goalsHistory, bloodTestsRaw, stravaActivities, weightLog, waterEntries, savedSettings] = await Promise.all([
    udb.get('goalsHistory').then(r => r || []),
    udb.get('bloodTests').then(r => (r || []).slice(0, 2)),
    Promise.race([fetchStravaActivities(days, udb), stravaTimeout]),
    udb.get('weightLog').then(r => (r || []).filter(e => e.date >= periodDates[periodDates.length - 1]).sort((a, b) => a.date.localeCompare(b.date))),
    Promise.all(dbDates.map(d => udb.get(`water:${d}`).then(v => ({ date: d, glasses: v || 0 })))).then(arr => arr.filter(e => e.glasses > 0)),
    udb.get('userSettings').then(r => r || {}),
  ]);

  // Priorité aux goals sauvegardés en DB — le frontend peut avoir un état en transit
  const resolvedGoals = {
    goalKcal:     savedSettings.goalKcal     ?? goalKcal,
    goalProtein:  savedSettings.goalProtein  ?? goalProtein,
    goalCarbs:    savedSettings.goalCarbs    ?? goalCarbs,
    goalFat:      savedSettings.goalFat      ?? goalFat,
    weight:       savedSettings.weight       ?? weight,
  };
  const fallbackGoals = { date: null, ...resolvedGoals };

  const foodData = await fetchFoodSummaryWithHistory(goalsHistory, fallbackGoals, udb, dbDays);

  const bmr = (weight && height && age) ? Math.round(10*Number(weight)+6.25*Number(height)-5*Number(age)+(sex==='homme'?5:-161)) : null;
  const profileCtx = [`Profil : ${sex||'?'}, ${age?age+' ans':'âge ?'}${height?', '+height+' cm':''}${weight?', '+weight+' kg':''}`, bmr?`BMR : ${bmr} kcal/jour`:null].filter(Boolean).join('\n');

  // Contexte alimentaire
  let foodCtx;
  if (foodData.activeDays === 0) {
    foodCtx = 'Aucune donnée alimentaire.';
  } else if (foodData.periods.length === 1) {
    const p = foodData.periods[0];
    foodCtx = `Alimentation (${foodData.activeDays} jours actifs) :\n- Objectifs : ${p.goalKcal} kcal · ${p.goalProtein}g prot · ${p.goalCarbs}g gluc · ${p.goalFat}g lip${p.weight?` · ${p.weight}kg`:''}\n- Réalisé moy : ${p.avgKcal} kcal/j · ${p.avgProtein}g prot · ${p.avgCarbs}g gluc · ${p.avgFat}g lip\n- Aliments fréquents : ${foodData.topFoods.join(', ')||'—'}`;
  } else {
    const periodsCtx = foodData.periods.map(p =>
      `Période depuis ${p.since}${p.weight?` (${p.weight}kg)`:''} — ${p.days} jours :\n  Objectifs : ${p.goalKcal} kcal · ${p.goalProtein}g prot · ${p.goalCarbs}g gluc · ${p.goalFat}g lip\n  Réalisé moy : ${p.avgKcal} kcal · ${p.avgProtein}g prot · ${p.avgCarbs}g gluc · ${p.avgFat}g lip`
    ).join('\n\n');
    foodCtx = `Alimentation sur ${foodData.activeDays} jours actifs — ${foodData.periods.length} périodes d'objectifs :\n\n${periodsCtx}\n\nAliments fréquents : ${foodData.topFoods.join(', ')||'—'}`;
  }

  // Contexte sportif Strava
  let sportCtx = '';
  const hasStrava = stravaActivities.length > 0;
  if (hasStrava) {
    const totalSessions = stravaActivities.length;
    const totalCalBurned = stravaActivities.reduce((a, s) => a + s.calories, 0);
    const avgCalBurned = Math.round(totalCalBurned / totalSessions);
    const avgDuration = Math.round(stravaActivities.reduce((a, s) => a + s.duration, 0) / totalSessions / 60);
    const avgHR = stravaActivities.filter(s => s.avg_hr).length > 0
      ? Math.round(stravaActivities.filter(s => s.avg_hr).reduce((a, s) => a + s.avg_hr, 0) / stravaActivities.filter(s => s.avg_hr).length)
      : null;

    const typeCount = {};
    stravaActivities.forEach(s => { typeCount[s.type] = (typeCount[s.type] || 0) + 1; });
    const topSports = Object.entries(typeCount).sort((a,b)=>b[1]-a[1]).map(([t,c])=>`${t} (${c}×)`).join(', ');

    // Croiser séances avec nutrition
    const trainingDays = new Set(stravaActivities.map(s => s.date));
    const restDays = Object.keys(foodData.byDate).filter(d => !trainingDays.has(d));
    const trainingDaysWithFood = [...trainingDays].filter(d => foodData.byDate[d]);

    let crossCtx = '';
    if (trainingDaysWithFood.length > 0) {
      const avgKcalTraining = Math.round(trainingDaysWithFood.reduce((a, d) => a + foodData.byDate[d].kcal, 0) / trainingDaysWithFood.length);
      const avgProtTraining = Math.round(trainingDaysWithFood.reduce((a, d) => a + foodData.byDate[d].protein, 0) / trainingDaysWithFood.length);
      const avgKcalRest = restDays.length > 0 ? Math.round(restDays.reduce((a, d) => a + (foodData.byDate[d]?.kcal || 0), 0) / restDays.length) : null;
      crossCtx = `\nCroisement nutrition/sport (${trainingDaysWithFood.length} jours d'entraînement avec données alim.) :\n- Kcal mangées jours entraînement : ${avgKcalTraining} kcal moy (brûlées moy : ${avgCalBurned} kcal → bilan net : ${avgKcalTraining - avgCalBurned} kcal)\n- Protéines jours entraînement : ${avgProtTraining}g moy${avgKcalRest ? `\n- Kcal mangées jours repos : ${avgKcalRest} kcal moy` : ''}`;
    }

    const avgElevation = stravaActivities.filter(s=>s.elevation).length > 0 ? Math.round(stravaActivities.filter(s=>s.elevation).reduce((a,s)=>a+s.elevation,0)/stravaActivities.filter(s=>s.elevation).length) : null;
    const avgSufferScore = stravaActivities.filter(s=>s.suffer_score).length > 0 ? Math.round(stravaActivities.filter(s=>s.suffer_score).reduce((a,s)=>a+s.suffer_score,0)/stravaActivities.filter(s=>s.suffer_score).length) : null;
    const totalPRs = stravaActivities.reduce((a,s)=>a+s.pr_count,0);

    sportCtx = `\n\nActivité sportive (${totalSessions} séances sur ${days} jours via Strava) :\n- Sports pratiqués : ${topSports}\n- Durée moyenne : ${avgDuration} min/séance\n- Calories brûlées moy : ${avgCalBurned} kcal/séance · Total : ${totalCalBurned} kcal${avgHR ? `\n- FC moyenne : ${avgHR} bpm` : ''}${avgSufferScore ? `\n- Charge d'entraînement moy (Suffer Score) : ${avgSufferScore}` : ''}${avgElevation ? `\n- Dénivelé positif moy : ${avgElevation}m` : ''}${totalPRs > 0 ? `\n- Records personnels battus : ${totalPRs}` : ''}${crossCtx}`;
  }

  let bloodCtx = '';
  if (bloodTestsRaw.length > 0) {
    const latest = bloodTestsRaw[0];
    const abnormalMarkers = (latest.markers || []).filter(m => m.status !== 'ok');
    const eatRecos = (latest.recommendations || []).filter(r => r.type === 'eat').slice(0, 6);
    const avoidRecos = (latest.recommendations || []).filter(r => r.type === 'avoid').slice(0, 6);

    // Croisement : marqueurs hors norme vs aliments consommés
    const topFoodsLower = foodData.topFoods.map(f => f.toLowerCase());
    const crossBlood = abnormalMarkers.map(m => {
      const name = m.name.toLowerCase();
      const NUTRIENT_FOODS = {
        fer: ['viande rouge','boudin','lentilles','épinards','foie','haricots','quinoa'],
        ferritine: ['viande rouge','boudin','lentilles','épinards','foie'],
        vitamine_d: ['saumon','sardine','maquereau','thon','jaune d\'œuf','champignon'],
        vitamine_b12: ['viande','poisson','œuf','produit laitier','foie'],
        magnésium: ['amande','noix','chocolat noir','légumineuse','épinard','banane'],
        zinc: ['viande','huître','graines de courge','légumineuse','noix de cajou'],
        cholestérol: ['avocat','huile d\'olive','poisson gras','noix'],
        triglycérides: ['sucre','alcool','glucide raffiné'],
        créatinine: ['protéine','viande'],
        potassium: ['banane','avocat','pomme de terre','légumineuse'],
      };
      const key = Object.keys(NUTRIENT_FOODS).find(k => name.includes(k));
      const foods = key ? NUTRIENT_FOODS[key] : [];
      const presentInDiet = foods.filter(f => topFoodsLower.some(tf => tf.includes(f)));
      const absentFromDiet = foods.filter(f => !topFoodsLower.some(tf => tf.includes(f)));
      return `${m.name} ${m.value}${m.unit||''} (${m.status})${presentInDiet.length ? ` — déjà consommé : ${presentInDiet.join(', ')}` : ''}${absentFromDiet.length ? ` — sources absentes de l'alimentation : ${absentFromDiet.slice(0,3).join(', ')}` : ''}`;
    }).join('\n');

    bloodCtx = `\n\nBilan sanguin — dernier en date (${latest.date || '?'}) :
Résumé : ${latest.summary || '—'}
${abnormalMarkers.length > 0 ? `Marqueurs hors norme :\n${crossBlood}` : 'Tous les marqueurs sont dans les normes.'}
${eatRecos.length > 0 ? `Aliments à favoriser : ${eatRecos.map(r=>r.text).join(' · ')}` : ''}
${avoidRecos.length > 0 ? `Aliments à limiter : ${avoidRecos.map(r=>r.text).join(' · ')}` : ''}
${bloodTestsRaw.length > 1 ? `Bilan précédent (${bloodTestsRaw[1].date||'?'}) : ${bloodTestsRaw[1].summary||'—'}` : ''}
IMPORTANT : croise ces données avec l'alimentation réelle — identifie si les carences sont corrigées ou aggravées par les habitudes alimentaires observées.`;
  }
  // Contexte poids
  let weightCtx = '';
  if (weightLog.length >= 2) {
    const first = weightLog[0];
    const last = weightLog[weightLog.length - 1];
    const delta = Math.round(((last.value||last.weight) - (first.value||first.weight)) * 10) / 10;
    const sign = delta > 0 ? '+' : '';
    weightCtx = `\n\nSuivi du poids (${weightLog.length} mesures sur la période) :\n- Début : ${first.value||first.weight} kg (${first.date})\n- Fin : ${last.value||last.weight} kg (${last.date})\n- Évolution : ${sign}${delta} kg\nCroise cette évolution avec les apports caloriques moyens et les dépenses sportives.`;
  } else if (weightLog.length === 1) {
    weightCtx = `\n\nPoids relevé : ${weightLog[0].value||weightLog[0].weight} kg (${weightLog[0].date}) — une seule mesure, pas d'évolution calculable.`;
  }

  // Contexte hydratation
  let waterCtx = '';
  if (waterEntries.length > 0) {
    const avgGlasses = Math.round(waterEntries.reduce((a, e) => a + e.glasses, 0) / waterEntries.length * 10) / 10;
    const daysTracked = waterEntries.length;
    waterCtx = `\n\nHydratation (suivi sur ${daysTracked} jours enregistrés) :\n- Moyenne : ${avgGlasses} verres/jour (objectif : 8 verres = 2L)\n- Note : l'absence de données les autres jours ne signifie pas un manque d'hydratation — l'utilisateur n'a pas forcément utilisé le suivi ces jours-là.`;
  }

  const multiPeriod = foodData.periods.length > 1;
  const hasBlood = bloodTestsRaw.length > 0;
  const hasWeight = weightLog.length >= 2;
  const hasWater = waterEntries.length > 0;
  const hasPrev = prevReports.length > 0;

  // Résumé structuré des rapports précédents
  let prevCtx = '';
  if (hasPrev) {
    const lines = prevReports.map(r => {
      if (r.summary) {
        const s = r.summary;
        return `Rapport du ${r.date} (${r.days}j) : moy ${s.avgKcal||'?'} kcal/j · ${s.avgProtein||'?'}g prot · poids ${s.weight||'?'} kg · ${s.activeDays||'?'} jours loggés${s.bloodAbnormal != null ? ` · ${s.bloodAbnormal} marqueur(s) hors norme` : ''}`;
      }
      return `Rapport du ${r.date} (${r.days}j) — résumé non disponible`;
    }).join('\n');
    prevCtx = `\n\nRapports nutritionnels précédents (pour comparaison d'évolution) :\n${lines}\nCompare explicitement avec le rapport actuel : amélioration ou dégradation sur chaque axe.`;
  }

  // Calculer le résumé structuré du rapport actuel
  const currentPeriod = foodData.periods.length > 0 ? foodData.periods[foodData.periods.length - 1] : null;
  const summary = {
    avgKcal: currentPeriod?.avgKcal || null,
    avgProtein: currentPeriod?.avgProtein || null,
    weight: weightLog.length > 0 ? (weightLog[weightLog.length-1].value || weightLog[weightLog.length-1].weight) : null,
    activeDays: foodData.activeDays,
    bloodAbnormal: bloodTestsRaw.length > 0 ? (bloodTestsRaw[0].markers || []).filter(m => m.status !== 'ok').length : null,
  };

  const langInstrNut = lang !== 'fr' ? `\nIMPORTANT: Write the entire report in ${LANG_NAMES[lang] || 'English'}.` : '';
  const system = `Tu es un expert en nutrition sportive, performance et médecine fonctionnelle. Rédige un rapport complet et personnalisé. HTML simple : <h2>,<p>,<ul>,<li>,<strong>. Aucun html/head/body/style. Langue accessible, cite les chiffres réels. Ne tronque JAMAIS le rapport — écris toutes les sections jusqu'à la conclusion.
IMPORTANT : n'invente JAMAIS de données. Cite uniquement les chiffres explicitement fournis. Si une donnée est absente, indique-le brièvement sans spéculer.${langInstrNut}
Structure obligatoire :
<h2>Bilan global</h2>
<h2>Alimentation</h2>
${multiPeriod ? '<h2>Évolution des objectifs</h2>' : ''}
${hasStrava ? '<h2>Activité physique</h2>' : ''}
${hasStrava ? '<h2>Nutrition & sport — croisement des données</h2>' : ''}
${hasWeight ? '<h2>Évolution du poids</h2>' : ''}
${hasBlood ? '<h2>Bilan sanguin & alimentation</h2> — analyse chaque marqueur hors norme, dis explicitement si l\'alimentation observée aggrave ou corrige la situation, cite les aliments manquants ou en excès' : ''}
${hasPrev ? '<h2>Évolution par rapport aux rapports précédents</h2> — compare chiffre par chiffre' : ''}
<h2>Points forts</h2>
<h2>Axes d\'amélioration</h2>
<h2>Recommandations concrètes</h2>
<h2>Conclusion</h2>`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system, messages: [{ role: 'user', content: `Génère le rapport complet sans rien omettre :\n\n${profileCtx}\n\n${foodCtx}${sportCtx}${weightCtx}${waterCtx}${bloodCtx}${prevCtx}` }] }),
  });
  const data = await apiRes.json();
  if (!apiRes.ok) return { error: data.error?.message || `Erreur API ${apiRes.status}` };
  return { html: data.content?.find(b => b.type === 'text')?.text || '', summary };
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const report = await udb.get('latestReport');
  if (!report || report.seen) return Response.json({ report: null });
  await udb.set('latestReport', { ...report, seen: true });
  return Response.json({ report });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req); if (auth.error) return auth.error;
    const udbCheck = userDb(auth.userId);
    const coachId = await udbCheck.get('coachId');
    if (coachId) return Response.json({ error: 'COACH_REQUIRED', message: 'Demande ton rapport à ton coach.' }, { status: 403 });

    const body = await req.json();
    const reportDays = body.type === 'health' ? 90 : (body.days || 90);
    const access = await checkReportAccess(auth.userId, reportDays);
    if (!access.allowed) return access.reason === 'limit'
      ? Response.json({ error: 'REPORT_LIMIT', limitLabel: access.limitLabel }, { status: 429 })
      : upgradeResponse('reports');
    const lang = detectLang(req);
    const udb = userDb(auth.userId);
    const result = body.type === 'health' ? await healthReport(body, udb, lang) : await nutritionReport(body, udb, lang);
    if (result.error) return Response.json({ error: result.error }, { status: 500 });

    const title = body.type === 'health' ? 'Rapport médical' : `Rapport nutritionnel ${body.days || 90}j`;
    // Stocker + push (résultat disponible même si l'app est fermée)
    await Promise.all([
      udb.set('latestReport', { html: result.html, title, type: body.type || 'nutritionnel', generatedAt: new Date().toISOString(), seen: false }),
      import('../push/send/route').then(m => m.sendPushToUser(auth.userId, `📄 ${title} prêt`, 'Appuie pour consulter ton rapport', '/')).catch(() => {}),
    ]).catch(() => {});

    await incrementReportUsage(auth.userId, access.usageKey);
    return Response.json({ html: result.html, summary: result.summary });
  } catch(e) {
    return Response.json({ error: e.message || 'Erreur interne' }, { status: 500 });
  }
}
