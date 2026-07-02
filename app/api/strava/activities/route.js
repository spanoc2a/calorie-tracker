import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';
import { checkStravaAccess, upgradeResponse } from '../../../lib/planServer';

const SPORT_LABELS = {
  Run: '🏃 Course', Ride: '🚴 Vélo', Swim: '🏊 Natation',
  WeightTraining: '🏋️ Muscu', Walk: '🚶 Marche', Hike: '🥾 Randonnée',
  Yoga: '🧘 Yoga', Workout: '💪 Entraînement', VirtualRide: '🚴 Vélo virtuel',
  TrailRun: '🏔️ Trail', Crossfit: '🔥 CrossFit',
};

// MET values × 70kg default — kcal/min estimate when Strava returns 0
const MET = {
  Run: 10, TrailRun: 11, Ride: 8, VirtualRide: 8, Swim: 9,
  WeightTraining: 6, Walk: 4, Hike: 6, Yoga: 3, Workout: 7, Crossfit: 9,
};

// Correction coefficients — montres surestiment selon l'activité
// Sources : études Stanford, Valero et al. 2017, Shcherbina et al. 2017
const CORRECTION = {
  WeightTraining: 0.72, // muscu très surestimée (FC élevée ≠ dépense élevée)
  Crossfit:       0.75,
  Workout:        0.75,
  Yoga:           0.80,
  Swim:           0.85, // capteur poignet moins fiable en eau
  VirtualRide:    0.88,
  Ride:           0.90, // correct avec capteur puissance
  Hike:           0.90,
  Walk:           0.92,
  Run:            0.92, // relativement fiable
  TrailRun:       0.90,
};

function rawCalories(type, movingTimeSec, stravaCalories, kilojoules) {
  if (stravaCalories > 0) return Math.round(stravaCalories);
  if (kilojoules > 0) return Math.round(kilojoules * 0.239 * 4);
  const met = MET[type] || 7;
  return Math.round(met * 70 * (movingTimeSec / 3600));
}

function adjustedCalories(type, movingTimeSec, stravaCalories, kilojoules) {
  const coeff = CORRECTION[type] || 0.85;
  return Math.round(rawCalories(type, movingTimeSec, stravaCalories, kilojoules) * coeff);
}

async function refreshAccessToken(refreshToken, udb) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: parseInt(process.env.STRAVA_CLIENT_ID),
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 400 || res.status === 401) {
      await udb.set('strava:token', null); // token révoqué, on nettoie
    }
    return { error: data.message || `HTTP ${res.status}` };
  }
  const updated = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
  await udb.set('strava:token', { ...updated, athlete: (await udb.get('strava:token'))?.athlete });
  return { token: data.access_token };
}

async function getToken(udb) {
  const cached = await udb.get('strava:token');
  if (!cached) return { error: 'no_token' };
  if (Date.now() / 1000 < cached.expires_at - 300) return { token: cached.access_token, athlete: cached.athlete };
  if (cached.refresh_token) {
    const result = await refreshAccessToken(cached.refresh_token, udb);
    if (result.token) return result;
  }
  return { error: 'no_token' };
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return Response.json({ connected: false, debug: 'not_authenticated' });
  const access = await checkStravaAccess(auth.userId, auth.email);
  if (!access.allowed) return upgradeResponse('strava');
  const udb = userDb(auth.userId);
  const result = await getToken(udb);
  if (result.error) return Response.json({ connected: false, debug: result.error });
  const token = result.token;
  const athlete = result.athlete;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const burnedWeek = searchParams.get('burned') === 'week';

  // Fetch recent activities and filter by start_date_local to avoid UTC timezone issues
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  if (res.status === 401) {
    // Token révoqué ou invalide — on nettoie le KV
    await udb.set('strava:token', null);
    return Response.json({ connected: false, debug: 'token_revoked' });
  }
  if (!res.ok) return Response.json({ connected: true, activities: [], error: data.message });

  // Mode semaine : retourne les calories brûlées groupées par date avec détails précis
  if (burnedWeek) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recentActivities = data.filter(a => (a.start_date_local?.slice(0, 10) || '') >= cutoffStr);
    const detailed = await Promise.all(recentActivities.map(async a => {
      const r = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? await r.json() : a;
    }));
    const burnedByDate = {};
    for (const a of detailed) {
      const d = a.start_date_local?.slice(0, 10);
      if (!d) continue;
      const type = a.sport_type || a.type;
      burnedByDate[d] = (burnedByDate[d] || 0) + adjustedCalories(type, a.moving_time, a.calories, a.kilojoules);
    }
    return Response.json({ connected: true, burnedByDate });
  }

  const filtered = data.filter(a => a.start_date_local?.slice(0, 10) === date);
  const allDates = data.map(a => a.start_date_local?.slice(0, 10));

  // Fetch full detail for each activity to get exact calories from device
  const detailed = await Promise.all(filtered.map(async a => {
    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${a.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return detailRes.ok ? await detailRes.json() : a;
  }));

  const summary = detailed.map(a => {
    const type = a.sport_type || a.type;
    return {
      id: a.id,
      name: a.name,
      type,
      typeLabel: SPORT_LABELS[type] || `🏅 ${type}`,
      duration: a.moving_time,
      distance: a.distance,
      calories: rawCalories(type, a.moving_time, a.calories, a.kilojoules),
      caloriesAdjusted: adjustedCalories(type, a.moving_time, a.calories, a.kilojoules),
      estimated: !a.calories || a.calories === 0,
      // Cardio
      avg_hr: a.average_heartrate || null,
      max_hr: a.max_heartrate || null,
      // Effort & charge
      suffer_score: a.suffer_score || null,
      perceived_exertion: a.perceived_exertion || null,
      // Perf
      avg_speed: a.average_speed || null,       // m/s
      max_speed: a.max_speed || null,
      avg_cadence: a.average_cadence || null,
      avg_watts: a.average_watts || null,
      weighted_watts: a.weighted_average_watts || null,
      // Terrain
      elevation_gain: a.total_elevation_gain || null,
      // Records
      pr_count: a.pr_count || 0,
      achievements: a.achievement_count || 0,
      // Splits (pace par km)
      splits: a.splits_metric?.map(s => ({
        km: s.split,
        elapsed: s.elapsed_time,
        moving: s.moving_time,
        distance: s.distance,
        hr: s.average_heartrate || null,
      })) || [],
    };
  });

  // Cache résumé 7j pour le dashboard coach
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = data.filter(a => new Date(a.start_date_local) >= sevenDaysAgo);
  const activityCache = recent.map(a => {
    const type = a.sport_type || a.type;
    return {
      id: a.id,
      date: a.start_date_local?.slice(0, 10),
      name: a.name || null,
      type, typeLabel: SPORT_LABELS[type] || type,
      duration: a.moving_time,
      distance: a.distance || 0,
      calories: rawCalories(type, a.moving_time, a.calories || 0, a.kilojoules || 0),
      caloriesAdjusted: adjustedCalories(type, a.moving_time, a.calories || 0, a.kilojoules || 0),
      // Données riches (présentes dans le résumé Strava — aucun appel supplémentaire) :
      avg_hr: a.average_heartrate || null,        // FC moyenne (si capteur cardio)
      max_hr: a.max_heartrate || null,            // FC max
      suffer_score: a.suffer_score || null,       // effort relatif Strava (charge)
      avg_speed: a.average_speed || null,         // m/s
      max_speed: a.max_speed || null,             // m/s
      elevation_gain: a.total_elevation_gain || null, // dénivelé +
      avg_cadence: a.average_cadence || null,
      avg_watts: a.average_watts || null,         // puissance (si capteur)
      weighted_watts: a.weighted_average_watts || null,
    };
  });
  await udb.set('stravaCache', { updatedAt: new Date().toISOString(), activities: activityCache });

  return Response.json({ connected: true, athlete, activities: summary, activeDates: [...new Set(allDates.filter(Boolean))] });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const tokenData = await udb.get('strava:token');
  if (tokenData?.access_token) {
    await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).catch(() => {});
  }
  await udb.set('strava:token', null);
  return Response.json({ ok: true });
}
