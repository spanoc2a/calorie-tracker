import { db, userDb } from '../../db';

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

async function generateWeeklyReport(userId) {
  const udb = userDb(userId);
  const dates = getLastNDates(7);

  const [settings, weightLog] = await Promise.all([
    udb.get('userSettings'),
    udb.get('weightLog').then(r => (r || []).filter(e => e.date >= dates[dates.length - 1])),
  ]);

  const dayEntries = await Promise.all(dates.map(dk => udb.get(`day:${dk}`).then(e => ({ dk, entries: e || [] }))));
  const activeDays = dayEntries.filter(d => d.entries.length > 0);

  if (activeDays.length < 2) return null; // pas assez de données

  // Calcul des stats
  let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
  const foodCount = {};
  for (const { entries } of activeDays) {
    for (const e of entries) {
      totalKcal += e.kcal || 0;
      totalProtein += e.protein || 0;
      totalCarbs += e.carbs || 0;
      totalFat += e.fat || 0;
      const n = (e.name || '').trim();
      if (n) foodCount[n] = (foodCount[n] || 0) + 1;
    }
  }
  const n = activeDays.length;
  const avgKcal = Math.round(totalKcal / n);
  const avgProtein = Math.round(totalProtein / n);
  const avgCarbs = Math.round(totalCarbs / n);
  const avgFat = Math.round(totalFat / n);
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, c]) => `${f} (${c}×)`);

  const s = settings || {};
  const { goalKcal, goalProtein, goalCarbs, goalFat, sex, birthdate, height, weight } = s;
  const age = calcAge(birthdate);

  const profileCtx = [
    sex || age ? `Profil : ${sex || '?'}, ${age ? age + ' ans' : '?'}${height ? ', ' + height + ' cm' : ''}${weight ? ', ' + weight + ' kg' : ''}` : null,
    goalKcal ? `Objectifs : ${goalKcal} kcal · ${goalProtein || '?'}g prot · ${goalCarbs || '?'}g gluc · ${goalFat || '?'}g lip` : null,
  ].filter(Boolean).join('\n');

  let weightCtx = '';
  if (weightLog.length >= 2) {
    const first = weightLog[0];
    const last = weightLog[weightLog.length - 1];
    const delta = Math.round(((last.value || last.weight) - (first.value || first.weight)) * 10) / 10;
    weightCtx = `\nPoids : ${first.value || first.weight}kg → ${last.value || last.weight}kg (${delta > 0 ? '+' : ''}${delta} kg cette semaine)`;
  }

  // Rapport précédent pour comparaison
  const prevReports = await udb.get('reportHistory').then(r => (r || []).filter(rr => rr.type === 'hebdomadaire').slice(0, 1));
  let prevCtx = '';
  if (prevReports.length > 0 && prevReports[0].summary) {
    const ps = prevReports[0].summary;
    prevCtx = `\nSemaine précédente : ${ps.avgKcal || '?'} kcal/j · ${ps.avgProtein || '?'}g prot · ${ps.activeDays || '?'} jours loggés`;
  }

  const userContent = `${profileCtx}

Semaine du ${dates[dates.length - 1]} au ${dates[0]} (${n} jours loggés sur 7) :
- Calories moy : ${avgKcal} kcal/j${goalKcal ? ` (objectif : ${goalKcal}, écart : ${avgKcal - goalKcal > 0 ? '+' : ''}${avgKcal - goalKcal})` : ''}
- Protéines moy : ${avgProtein}g/j${goalProtein ? ` (objectif : ${goalProtein}g)` : ''}
- Glucides moy : ${avgCarbs}g/j · Lipides moy : ${avgFat}g/j
- Aliments fréquents : ${topFoods.join(', ') || '—'}${weightCtx}${prevCtx}

Génère un bilan hebdomadaire concis. Sois direct et actionnable.`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `Tu es un coach nutritionnel. Rédige un bilan hebdomadaire court (max 300 mots). HTML simple : <h2>,<p>,<ul>,<li>,<strong>. Sections : <h2>Cette semaine</h2> <h2>Points positifs</h2> <h2>À améliorer</h2> <h2>Objectif de la semaine prochaine</h2>. Cite les chiffres réels. Sois encourageant mais honnête.`,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  const data = await apiRes.json();
  if (!apiRes.ok) throw new Error(data.error?.message || 'Erreur API');

  const html = data.content?.find(b => b.type === 'text')?.text || '';
  const summary = { avgKcal, avgProtein, activeDays: n, weight: weightLog.length > 0 ? (weightLog[weightLog.length - 1].value || weightLog[weightLog.length - 1].weight) : null };

  const existing = await udb.get('reportHistory') || [];
  const entry = {
    id: Date.now(),
    title: `Bilan semaine du ${dates[dates.length - 1]}`,
    days: 7,
    date: dates[0],
    html,
    type: 'hebdomadaire',
    summary,
  };
  await udb.set('reportHistory', [entry, ...existing].slice(0, 20));
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
