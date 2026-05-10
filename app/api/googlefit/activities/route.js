import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

const ACTIVITY_LABELS = {
  7: '🚴 Vélo', 46: '🏃 Course', 62: '🚶 Marche', 56: '🏊 Natation',
  75: '🏋️ Muscu', 83: '🧘 Yoga', 82: '🔄 Elliptique', 44: '🚣 Aviron',
  51: '⛷️ Ski', 52: '🏂 Snowboard', 1: '💪 Aérobie', 58: '🎾 Tennis',
  9: '🥌 Curling', 57: '🏅 Sport collectif', 61: '🏐 Volleyball',
};

async function refreshToken(udb) {
  const cached = await udb.get('googlefit:token');
  if (!cached?.refresh_token) return { error: 'no_refresh' };
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: cached.refresh_token,
      client_id: process.env.GOOGLE_FIT_CLIENT_ID,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) return { error: 'refresh_failed' };
  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  const updated = { ...cached, access_token: data.access_token, expires_at: expiresAt };
  await udb.set('googlefit:token', updated);
  return { token: data.access_token };
}

async function getToken(udb) {
  const cached = await udb.get('googlefit:token');
  if (!cached) return { error: 'no_token' };
  if (Date.now() / 1000 < cached.expires_at - 300) return { token: cached.access_token };
  return refreshToken(udb);
}

function parseBucket(bucket) {
  let steps = 0, caloriesBurned = 0, activeMinutes = 0, weight = null;
  for (const ds of bucket.dataset || []) {
    const type = ds.dataSourceId || '';
    for (const pt of ds.point || []) {
      const val = pt.value?.[0];
      if (!val) continue;
      if (type.includes('step_count')) steps += val.intVal || 0;
      else if (type.includes('calories.expended')) caloriesBurned += val.fpVal || 0;
      else if (type.includes('active_minutes')) activeMinutes += val.intVal || 0;
      else if (type.includes('weight') && val.fpVal) weight = val.fpVal;
    }
  }
  return { steps: Math.round(steps), caloriesBurned: Math.round(caloriesBurned), activeMinutes, weight };
}


export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ connected: false });
  const udb = userDb(auth.userId);

  const result = await getToken(udb);
  if (result.error) return Response.json({ connected: false });
  const token = result.token;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd   = new Date(`${date}T23:59:59`);

  const [aggRes, sessRes] = await Promise.all([
    fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.calories.expended' },
          { dataTypeName: 'com.google.active_minutes' },
          { dataTypeName: 'com.google.weight' },
        ],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: dayStart.getTime(),
        endTimeMillis: dayEnd.getTime(),
      }),
    }),
    fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${dayStart.toISOString()}&endTime=${dayEnd.toISOString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!aggRes.ok) {
    const err = await aggRes.json();
    return Response.json({ connected: true, error: err?.error?.message || `HTTP ${aggRes.status}` });
  }

  const aggData = await aggRes.json();
  const { steps, caloriesBurned, activeMinutes, weight } = parseBucket(aggData.bucket?.[0] || {});

  let activities = [];
  if (sessRes.ok) {
    const sessData = await sessRes.json();
    activities = (sessData.session || []).map(s => {
      const type = s.activityType;
      const durationMs = parseInt(s.endTimeMillis || 0) - parseInt(s.startTimeMillis || 0);
      const durationMin = Math.round(durationMs / 60000);
      return {
        id: s.id,
        name: s.name || ACTIVITY_LABELS[type] || `Activité ${type}`,
        type,
        typeLabel: ACTIVITY_LABELS[type] || '🏅 Sport',
        durationMin,
        startTime: new Date(parseInt(s.startTimeMillis)).toISOString(),
      };
    }).filter(a => a.durationMin > 1);
  }

  return Response.json({ connected: true, date, steps, caloriesBurned, activeMinutes, activities });
}

export async function DELETE(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  await userDb(auth.userId).set('googlefit:token', null);
  return Response.json({ ok: true });
}
