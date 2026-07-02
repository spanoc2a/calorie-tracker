import { userDb } from '../api/db';

/**
 * Analyse une liste d'activités Strava ENRICHIES et en extrait des agrégats
 * exploitables (charge, cardio, allure, dénivelé…). N'utilise QUE les champs
 * réellement présents — les capteurs absents (cardio/puissance/cadence) restent null.
 * @param {Array} activities  liste brute stravaCache.activities (déjà filtrée sur la période voulue)
 * @returns {Object|null} agrégats, ou null si aucune activité.
 */
export function summarizeStravaActivities(activities) {
  if (!Array.isArray(activities) || activities.length === 0) return null;

  const n = activities.length;
  const sum = (f) => activities.reduce((s, a) => s + (Number(f(a)) || 0), 0);

  const totalKcal = activities.reduce((s, a) => s + (a.caloriesAdjusted || a.calories || 0), 0);
  const totalDurationSec = sum((a) => a.duration);
  const totalDistanceM = sum((a) => a.distance);
  const totalElevation = sum((a) => a.elevation_gain);

  const types = [...new Set(activities.map((a) => a.typeLabel || a.type).filter(Boolean))];

  // Cardio observé (uniquement sur les séances équipées d'un capteur).
  const hrVals = activities.map((a) => a.avg_hr).filter((v) => v != null);
  const maxHrVals = activities.map((a) => a.max_hr).filter((v) => v != null);
  const avgHr = hrVals.length ? Math.round(hrVals.reduce((s, v) => s + v, 0) / hrVals.length) : null;
  const maxHr = maxHrVals.length ? Math.max(...maxHrVals) : null;

  // Charge d'entraînement via suffer_score (effort relatif Strava).
  const sufferVals = activities.map((a) => a.suffer_score).filter((v) => v != null);
  const sufferTotal = sufferVals.length ? Math.round(sufferVals.reduce((s, v) => s + v, 0)) : null;
  const sufferAvg = sufferVals.length ? Math.round(sufferTotal / sufferVals.length) : null;

  // Puissance (vélo équipé d'un capteur).
  const wattsVals = activities.map((a) => a.weighted_watts ?? a.avg_watts).filter((v) => v != null);
  const avgWatts = wattsVals.length ? Math.round(wattsVals.reduce((s, v) => s + v, 0) / wattsVals.length) : null;

  return {
    count: n,
    types,
    totalKcal: Math.round(totalKcal),
    totalDurationMin: Math.round(totalDurationSec / 60),
    avgDurationMin: Math.round(totalDurationSec / 60 / n),
    totalDistanceKm: totalDistanceM > 0 ? Math.round(totalDistanceM / 1000 * 10) / 10 : 0,
    totalElevation: Math.round(totalElevation),
    avgHr,
    maxHr,
    sufferTotal,
    sufferAvg,
    avgWatts,
    activities,
  };
}

/**
 * Convertit une allure : pour la course → min/km, pour le vélo → km/h.
 * Renvoie '' si pas de vitesse exploitable.
 */
export function formatPace(activity) {
  const speed = activity?.avg_speed; // m/s
  if (!speed || speed <= 0) return '';
  const type = (activity?.type || '').toLowerCase();
  const isRide = type.includes('ride') || type.includes('cycl') || type.includes('vélo') || type.includes('velo') || type.includes('bike');
  if (isRide) {
    return `${(speed * 3.6).toFixed(1)} km/h`;
  }
  // Allure course : min/km
  const secPerKm = 1000 / speed;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')} min/km`;
}

/**
 * Interprète une charge d'entraînement (somme de suffer_score sur la période)
 * en signal actionnable pour moduler volume/intensité/récupération.
 */
export function trainingLoadLabel(sufferTotal) {
  if (sufferTotal == null) return null;
  if (sufferTotal >= 400) return 'élevée';
  if (sufferTotal >= 150) return 'modérée';
  return 'faible';
}

/**
 * Construit un bloc texte enrichi à partir du stravaCache, prêt à injecter dans un prompt.
 * @param {Object|null} stravaCache  objet { activities: [...] } (ou null)
 * @param {Object} opts
 *   - sinceDate : 'YYYY-MM-DD' borne basse incluse (par défaut : 7 jours glissants)
 *   - periodLabel : libellé de période affiché (ex '7j', '30j')
 * @returns {string} bloc prêt à concaténer (commence par \n) ou '' si rien.
 */
export function buildStravaContext(stravaCache, opts = {}) {
  const acts = stravaCache?.activities;
  if (!Array.isArray(acts) || acts.length === 0) return '';

  const sinceDate = opts.sinceDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const periodLabel = opts.periodLabel || '7j';
  const recent = acts.filter((a) => (a.date || '') >= sinceDate);
  const s = summarizeStravaActivities(recent);
  if (!s) return '';

  const lines = [`Activité sportive (${periodLabel}, données Strava réelles) : ${s.count} séance(s) — ${s.types.join(', ') || '—'}`];

  const durParts = [`durée totale ${s.totalDurationMin} min (moy ${s.avgDurationMin} min/séance)`];
  if (s.totalDistanceKm > 0) durParts.push(`distance ${s.totalDistanceKm} km`);
  if (s.totalElevation > 0) durParts.push(`dénivelé +${s.totalElevation} m`);
  lines.push('- ' + durParts.join(' · '));

  lines.push(`- Dépense énergétique sport : ${s.totalKcal} kcal (caloriesAdjusted)`);

  if (s.avgHr != null || s.maxHr != null) {
    const hr = [];
    if (s.avgHr != null) hr.push(`FC moy ${s.avgHr} bpm`);
    if (s.maxHr != null) hr.push(`FC max ${s.maxHr} bpm`);
    lines.push('- Cardio observé : ' + hr.join(' · '));
  }

  if (s.sufferTotal != null) {
    const label = trainingLoadLabel(s.sufferTotal);
    lines.push(`- Charge d'entraînement (suffer_score, effort relatif) : total ${s.sufferTotal}, moy ${s.sufferAvg}/séance → charge ${label}`);
  }

  if (s.avgWatts != null) lines.push(`- Puissance moy : ${s.avgWatts} W`);

  // Allures par type d'activité (sur la séance la plus représentative de chaque type).
  const paceByType = {};
  for (const a of recent) {
    const t = a.typeLabel || a.type;
    if (!t || paceByType[t]) continue;
    const p = formatPace(a);
    if (p) paceByType[t] = p;
  }
  const paceEntries = Object.entries(paceByType);
  if (paceEntries.length) {
    lines.push('- Allure : ' + paceEntries.map(([t, p]) => `${t} ${p}`).join(' · '));
  }

  return '\n' + lines.join('\n');
}

/**
 * Construit un bloc de contexte santé (objet connecté : Health Connect / Apple Santé)
 * à injecter dans les prompts IA (coach, programmes, suggestions) pour optimiser
 * santé & performance — en n'utilisant QUE les données réellement disponibles.
 * Renvoie '' si aucune donnée.
 */
export async function getHealthContext(userId) {
  const hc = await userDb(userId).get('healthConnectData').catch(() => null);
  if (!hc) return '';

  const parts = [];
  if (hc.avgSteps)   parts.push(`Pas/jour moy : ${hc.avgSteps} (≈${hc.avgPassiveKcal ?? Math.round(hc.avgSteps * 0.04)} kcal passives/j)`);
  if (hc.restingHR)  parts.push(`FC repos : ${hc.restingHR} bpm`);
  if (hc.avgHR)      parts.push(`FC moyenne : ${hc.avgHR} bpm`);
  if (hc.maxHR)      parts.push(`FC max récente : ${hc.maxHR} bpm`);
  if (hc.hrv)        parts.push(`HRV moy : ${hc.hrv} ms`);
  if (hc.avgSleep)   parts.push(`Sommeil moy : ${hc.avgSleep} h/nuit`);

  // Qualité du sommeil via les phases de la dernière nuit (le profond = récupération physique).
  let deepPct = null;
  if (hc.sleepStages) {
    const st = hc.sleepStages;
    const total = (st.deep || 0) + (st.light || 0) + (st.rem || 0);
    if (total > 0) {
      deepPct = Math.round((st.deep / total) * 100);
      parts.push(`Dernière nuit : profond ${st.deep} min (${deepPct}%), léger ${st.light} min, REM ${st.rem} min`);
    }
  }
  if (hc.spo2)       parts.push(`SpO2 moy : ${hc.spo2} %`);

  // Charge d'entraînement récente (7 j) à partir des séances enregistrées.
  if (Array.isArray(hc.workouts) && hc.workouts.length) {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = hc.workouts.filter((w) => (w.date || '') >= cutoff).length;
    parts.push(`Séances enregistrées (7 j) : ${recent}`);
  }

  if (!parts.length) return '';

  // Score de récupération calculé à partir des données DISPONIBLES (sans exiger la HRV).
  const flags = [];
  if (hc.avgSleep != null && hc.avgSleep < 6) flags.push('sommeil court');
  if (deepPct != null && deepPct < 13) flags.push('sommeil peu réparateur (profond bas)');
  if (hc.hrv != null && hc.hrv < 30) flags.push('HRV basse');
  let recovery = 'correcte';
  if (flags.length >= 2) recovery = 'faible';
  else if (flags.length === 1) recovery = 'moyenne';
  else if (hc.avgSleep != null && hc.avgSleep >= 7 && (deepPct == null || deepPct >= 15)) recovery = 'bonne';

  return (
    `\n\nDonnées santé RÉELLES de l'utilisateur (objet connecté, ${hc.daysWithSteps || '?'} j) :\n` +
    parts.map((p) => `- ${p}`).join('\n') +
    `\n\nÉtat de récupération estimé : ${recovery.toUpperCase()}${flags.length ? ` (${flags.join(', ')})` : ''}.\n` +
    `Consignes — utilise UNIQUEMENT ces données, n'invente JAMAIS une valeur absente (ex. ne mentionne pas la HRV/SpO2 si elles ne sont pas listées) :\n` +
    `- Récup FAIBLE → allège le volume/intensité du jour, technique + récup active, glucides de qualité, +protéines, insiste sur le sommeil.\n` +
    `- Récup MOYENNE → maintiens la charge, pas de record aujourd'hui, reste à l'écoute des sensations.\n` +
    `- Récup BONNE → feu vert pour intensifier/progresser (surcharge, séance plus exigeante).\n` +
    `- Pas/activité élevés → dépense passive notable : ajoute des calories les jours actifs.\n` +
    `- FC repos plus haute que d'habitude → signe de fatigue/sous-récup : lève le pied.`
  );
}
