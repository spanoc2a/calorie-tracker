import { db, userDb } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

function getLastNDates(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  return Math.floor((new Date() - new Date(birthdate)) / (365.25 * 24 * 3600 * 1000));
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const lang = detectLang(req);

  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const { athleteId, days = 30 } = await req.json();
  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const athlete = users.find(u => u.id === athleteId);
  if (!athlete) return Response.json({ error: 'Athlète introuvable' }, { status: 404 });

  const udb = userDb(athleteId);
  const dates = getLastNDates(days);

  const [settings, bloodTests, weightLog, stravaToken, stravaCache, coachPrograms] = await Promise.all([
    udb.get('userSettings').then(s => s || {}),
    udb.get('bloodTests').then(b => (b || []).slice(0, 1)),
    udb.get('weightLog').then(w => (w || []).filter(e => e.date >= dates[dates.length-1])),
    udb.get('strava:token'), // vérifie que l'athlète a réellement Strava connecté
    udb.get('stravaCache').then(s => s || null),
    udb.get('coachPrograms').then(p => (p || []).filter(x => x.status === 'sent').slice(0, 1)),
  ]);
  // N'utiliser le cache Strava que si l'athlète a un vrai token actif
  const effectiveStravaCache = (stravaToken && stravaToken.access_token) ? stravaCache : null;

  const allEntries = await Promise.all(dates.map(d => udb.get(`day:${d}`).then(e => ({ d, entries: e || [] }))));
  const active = allEntries.filter(x => x.entries.length > 0);

  const age = calcAge(settings.birthdate);
  const { sex, height, weight, goalKcal = 2000, goalProtein = 150, goalCarbs = 250, goalFat = 70 } = settings;
  const bmr = weight && height && age ? Math.round(10*Number(weight)+6.25*Number(height)-5*age+(sex==='homme'?5:-161)) : null;

  const profileCtx = `Athlète : ${athlete.name}, ${sex||'?'}, ${age?age+' ans':'âge ?'}${height?', '+height+' cm':''}${weight?', '+weight+' kg':''}${bmr?`\nBMR : ${bmr} kcal/j`:''}`;

  let foodCtx = 'Aucune donnée alimentaire.';
  if (active.length > 0) {
    const totals = active.reduce((a, x) => {
      x.entries.forEach(e => { a.kcal += e.kcal||0; a.protein += e.protein||0; a.carbs += e.carbs||0; a.fat += e.fat||0; });
      return a;
    }, { kcal:0, protein:0, carbs:0, fat:0 });
    const foodCount = {};
    active.forEach(x => x.entries.forEach(e => { const n=(e.name||'').trim(); foodCount[n]=(foodCount[n]||0)+1; }));
    const top = Object.entries(foodCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n,c])=>`${n} (${c}×)`);
    foodCtx = `Alimentation (${active.length}j actifs sur ${days}j) :\n- Objectifs : ${goalKcal} kcal · ${goalProtein}g prot · ${goalCarbs}g gluc · ${goalFat}g lip\n- Moy réalisée : ${Math.round(totals.kcal/active.length)} kcal · ${Math.round(totals.protein/active.length)}g prot · ${Math.round(totals.carbs/active.length)}g gluc · ${Math.round(totals.fat/active.length)}g lip\n- Aliments fréquents : ${top.join(', ')||'—'}`;
  }

  // Tendance semaine par semaine
  let weeklyCtx = '';
  if (active.length > 0 && days >= 14) {
    const weekSize = 7;
    const numWeeks = Math.floor(dates.length / weekSize);
    const weeks = [];
    for (let w = 0; w < numWeeks; w++) {
      const weekDates = dates.slice(w * weekSize, (w + 1) * weekSize);
      const weekEntries = allEntries.filter(x => weekDates.includes(x.d) && x.entries.length > 0);
      if (weekEntries.length === 0) continue;
      const tot = weekEntries.reduce((a, x) => { x.entries.forEach(e => { a.kcal+=e.kcal||0; a.protein+=e.protein||0; }); return a; }, { kcal:0, protein:0 });
      weeks.push({ label: `S${numWeeks - w}`, activeDays: weekEntries.length, avgKcal: Math.round(tot.kcal/weekEntries.length), avgProtein: Math.round(tot.protein/weekEntries.length) });
    }
    if (weeks.length >= 2) {
      weeklyCtx = `\nTendance hebdomadaire (de la plus ancienne à la plus récente) :\n` + weeks.reverse().map(w => `- ${w.label} : ${w.activeDays}j actifs · ${w.avgKcal} kcal/j moy · ${w.avgProtein}g prot/j moy`).join('\n');
    }
  }

  let weightCtx = '';
  if (weightLog.length >= 2) {
    const delta = Math.round((weightLog[weightLog.length-1].weight - weightLog[0].weight)*10)/10;
    weightCtx = `\nPoids : ${weightLog[0].weight}kg → ${weightLog[weightLog.length-1].weight}kg (${delta>0?'+':''}${delta}kg sur la période)`;
  }

  const bloodCtx = bloodTests.length > 0
    ? `\nBilan sanguin : ${bloodTests[0].summary||'—'}\nMarqueurs hors norme : ${(bloodTests[0].markers||[]).filter(m=>m.status!=='normal').map(m=>`${m.name} ${m.value}${m.unit||''} (${m.status})`).join(', ')||'aucun'}`
    : '';

  // Strava
  let stravaCtx = '';
  if (effectiveStravaCache?.activities?.length > 0) {
    const recentActs = effectiveStravaCache.activities.filter(a => a.date >= dates[dates.length-1]);
    if (recentActs.length > 0) {
      const totalKcalSport = recentActs.reduce((s, a) => s + (a.caloriesAdjusted || a.calories || 0), 0);
      const types = [...new Set(recentActs.map(a => a.typeLabel))];
      const avgDuration = Math.round(recentActs.reduce((s, a) => s + (a.duration || 0), 0) / recentActs.length / 60);
      stravaCtx = `\nActivité sportive (${days}j) : ${recentActs.length} séances — ${types.join(', ')}\nDurée moyenne : ${avgDuration} min · Total calories sport : ${totalKcalSport} kcal`;
    }
  }

  // Programme coach envoyé
  let programCtx = '';
  if (coachPrograms.length > 0) {
    const prog = coachPrograms[0];
    programCtx = `\nProgramme nutritionnel envoyé par le coach : ${prog.mealsPerDay} repas/j, envoyé le ${new Date(prog.sentAt||prog.generatedAt).toLocaleDateString('fr-FR')}`;
  }

  const hasStrava = stravaCtx !== '';
  const langInstr = lang !== 'fr' ? ` Write the entire report in ${LANG_NAMES[lang] || 'English'}.` : '';
  const system = `Tu es un coach nutritionniste expert. Rédige un bilan personnalisé pour cet athlète à destination de son coach. HTML : <h2>,<p>,<ul>,<li>,<strong>. Précis, bienveillant mais direct sur les points à améliorer. Ne tronque JAMAIS le rapport — il doit être complet jusqu'à la dernière section.${langInstr}
IMPORTANT : n'invente JAMAIS de données sportives. Si aucune donnée Strava n'est fournie, ne mentionne pas de fréquence, durée ou type de sport.
Structure :
<h2>Bilan global</h2>
<h2>Analyse nutritionnelle</h2>
${days >= 14 ? '<h2>Tendance & progression</h2>' : ''}
${hasStrava ? '<h2>Activité physique</h2>' : ''}
<h2>Points forts</h2>
<h2>Points à travailler</h2>
${bloodTests.length>0?'<h2>Bilan sanguin</h2>':''}
<h2>Recommandations pour le coach</h2>`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system, messages: [{ role: 'user', content: `${profileCtx}\n\n${foodCtx}${weeklyCtx}${weightCtx}${stravaCtx}${programCtx}${bloodCtx}` }] }),
  });
  const data = await apiRes.json();
  if (!apiRes.ok) return Response.json({ error: data.error?.message }, { status: 500 });

  const html = data.content?.find(b=>b.type==='text')?.text || '';

  // Stocker + push coach
  await Promise.all([
    db.set(`coach:latestReport:${auth.userId}`, { html, athleteName: athlete.name, athleteId, generatedAt: new Date().toISOString(), seen: false }),
    import('../../push/send/route').then(m => m.sendPushToUser(auth.userId, `📄 Rapport de ${athlete.name} prêt`, 'Appuie pour consulter le rapport', '/coach')).catch(() => {}),
  ]).catch(() => {});

  return Response.json({ html });
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ report: null });
  const key = `coach:latestReport:${auth.userId}`;
  const report = await db.get(key);
  if (!report || report.seen) return Response.json({ report: null });
  await db.set(key, { ...report, seen: true });
  return Response.json({ report });
}

export async function PATCH(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const users = await db.get('auth:users') || [];
  const me = users.find(u => u.id === auth.userId);
  if (!me || me.role !== 'coach') return Response.json({ error: 'Accès refusé' }, { status: 403 });

  const { athleteId, html } = await req.json();
  const athleteIds = await db.get(`coach:${auth.userId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Athlète non lié' }, { status: 403 });

  const athlete = users.find(u => u.id === athleteId);
  const udb = userDb(athleteId);
  const history = await udb.get('reportHistory') || [];
  const entry = {
    id: Date.now(),
    title: `Bilan nutritionnel — ${me.name || 'Coach'}`,
    type: 'coach',
    date: new Date().toISOString(),
    html,
    days: null,
  };
  await udb.set('reportHistory', [entry, ...history].slice(0, 20));

  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{ id: Date.now(), date: new Date().toISOString(), coachName: me.name || 'Ton coach', type: 'report', read: false }, ...notifs].slice(0, 20));

  try {
    const { sendPushToUser } = await import('../../push/send/route');
    await sendPushToUser(athleteId, `📄 ${me.name || 'Ton coach'}`, 'Ton bilan nutritionnel est disponible !', '/?tab=rapports');
  } catch {}

  return Response.json({ ok: true });
}
