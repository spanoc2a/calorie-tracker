import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const all = await userDb(auth.userId).get('muscuSets') || {};

  if (searchParams.get('history') === '1') {
    const exercise = searchParams.get('exercise');
    if (!exercise) return Response.json({ error: 'exercise requis' }, { status: 400 });
    const byDate = all[exercise] || {};
    const history = Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([d,sets])=>({ date:d, sets }));
    return Response.json({ history });
  }

  if (searchParams.get('sessions')) {
    const n = parseInt(searchParams.get('sessions')) || 15;
    const dateMap = {};
    for (const [exercise, byDate] of Object.entries(all)) {
      for (const [d, sets] of Object.entries(byDate)) {
        if (sets && sets.length > 0) {
          if (!dateMap[d]) dateMap[d] = [];
          dateMap[d].push({ name: exercise, sets });
        }
      }
    }
    const calcVol = (sets) => sets.filter(s=>!s.bodyweight&&s.duration===undefined).reduce((s,x)=>s+(x.weight||0)*(x.reps||0),0);
    const sessions = Object.entries(dateMap)
      .sort((a,b) => b[0].localeCompare(a[0])).slice(0, n)
      .map(([d, exercises]) => ({
        date: d,
        exercises: exercises.map(e => ({ name: e.name, sets: e.sets, volume: calcVol(e.sets) })),
        totalVolume: exercises.reduce((t,e) => t + calcVol(e.sets), 0),
      }));
    return Response.json({ sessions });
  }

  const today = {};
  const previous = {};
  for (const [exercise, byDate] of Object.entries(all)) {
    today[exercise] = byDate[date] || [];
    const prevDate = Object.keys(byDate).filter(d => d < date).sort().reverse()[0];
    if (prevDate) previous[exercise] = { date: prevDate, sets: byDate[prevDate] };
  }

  // Dates d'entraînement de la semaine courante
  const now = new Date(date);
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dow);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const ws = weekStart.toISOString().slice(0,10);
  const we = weekEnd.toISOString().slice(0,10);
  const weekDates = new Set();
  for (const byDate of Object.values(all)) {
    for (const [d, sets] of Object.entries(byDate)) {
      if (d >= ws && d <= we && sets.length > 0) weekDates.add(d);
    }
  }

  return Response.json({ today, previous, weekDates: [...weekDates] });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { exercise, date, sets } = await req.json();
  if (!exercise || !date) return Response.json({ error: 'Données manquantes' }, { status: 400 });

  const udb = userDb(auth.userId);
  const all = await udb.get('muscuSets') || {};
  if (!all[exercise]) all[exercise] = {};
  all[exercise][date] = sets;

  // Garder les 20 dernières dates par exercice
  const dates = Object.keys(all[exercise]).sort().reverse();
  if (dates.length > 20) dates.slice(20).forEach(d => delete all[exercise][d]);

  await udb.set('muscuSets', all);
  return Response.json({ ok: true });
}
