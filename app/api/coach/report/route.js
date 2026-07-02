import { db, userDb } from '../../../api/db';
import { requireAuth } from '../../../api/auth/session';
import { getHealthContext, buildStravaContext } from '../../../lib/healthContext';
import { rateLimit } from '../../../lib/ratelimit';

// Échappe le HTML (anti-XSS stocké) pour les valeurs contrôlées par l'utilisateur.
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

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
  // Anti-abus : la génération de rapport est un appel Anthropic coûteux (Sonnet 8k), sans plafond mensuel coach.
  if (!(await rateLimit(`coach-report:${auth.userId}`, 60, 3_600_000))) {
    return Response.json({ error: 'Trop de rapports générés, réessaie dans un moment.' }, { status: 429 });
  }
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

  const [settings, bloodTests, weightLog, stravaToken, stravaCache, coachPrograms, muscuSets, measurements, checkins, intake] = await Promise.all([
    udb.get('userSettings').then(s => s || {}),
    udb.get('bloodTests').then(b => (b || []).slice(0, 1)),
    udb.get('weightLog').then(w => (w || []).filter(e => e.date >= dates[dates.length-1])),
    udb.get('strava:token'), // vérifie que l'athlète a réellement Strava connecté
    udb.get('stravaCache').then(s => s || null),
    udb.get('coachPrograms').then(p => (p || []).filter(x => x.status === 'sent').slice(0, 1)),
    udb.get('muscuSets').then(m => m || []),
    udb.get('measurements').then(m => m || []),
    udb.get('checkins').then(c => c || []),
    udb.get('intake').then(i => i || null),
  ]);
  // N'utiliser le cache Strava que si l'athlète a un vrai token actif
  const effectiveStravaCache = (stravaToken && stravaToken.access_token) ? stravaCache : null;

  const allEntries = await Promise.all(dates.map(d => udb.get(`day:${d}`).then(e => ({ d, entries: e || [] }))));
  const active = allEntries.filter(x => x.entries.length > 0);

  const age = calcAge(settings.birthdate);
  const { sex, height, weight, goalKcal = 2000, goalProtein = 150, goalCarbs = 250, goalFat = 70, mode, healthHistory } = settings;
  const bmr = weight && height && age ? Math.round(10*Number(weight)+6.25*Number(height)-5*age+(sex==='homme'?5:-161)) : null;

  const profileCtx = `Athlète : ${athlete.name}, ${sex||'?'}, ${age?age+' ans':'âge ?'}${height?', '+height+' cm':''}${weight?', '+weight+' kg':''}${bmr?`\nBMR : ${bmr} kcal/j`:''}${mode?`\nObjectif : ${mode}`:''}`;
  const healthCtx = healthHistory ? `\nAntécédents de santé : ${healthHistory}` : '';

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
    ? `\nBilan sanguin : ${bloodTests[0].summary||'—'}\nMarqueurs hors norme : ${(bloodTests[0].markers||[]).filter(m=>m.status!=='normal').map(m=>`${m.name} ${m.value}${m.unit||''} (${m.status})`).join(', ')||'aucun'}${bloodTests[0].markerRecos?`\nRecommandations nutritionnelles issues des marqueurs : ${bloodTests[0].markerRecos}`:''}${bloodTests[0].weeklyFocus?`\nFocus hebdomadaire : ${bloodTests[0].weeklyFocus}`:''}`
    : '';

  // Strava (enrichi : charge, cardio, allure, dénivelé — uniquement si token actif)
  const stravaCtx = buildStravaContext(effectiveStravaCache, { sinceDate: dates[dates.length - 1], periodLabel: `${days}j` });

  // Programme coach envoyé
  let programCtx = '';
  if (coachPrograms.length > 0) {
    const prog = coachPrograms[0];
    const mealsDesc = prog.mainMeals != null ? `${prog.mainMeals} repas principaux + ${prog.snacks||0} collations` : prog.mealsPerDay != null ? `${prog.mealsPerDay} repas/j` : '—';
    programCtx = `\nProgramme nutritionnel envoyé par le coach : ${mealsDesc}, envoyé le ${new Date(prog.sentAt||prog.generatedAt).toLocaleDateString('fr-FR')}${prog.weeklyNotes?`\n  Notes du programme : ${prog.weeklyNotes}`:''}`;
  }

  // Récupération (objet connecté santé) — données réelles sommeil/FC/récup
  const recoveryCtx = await getHealthContext(athleteId).catch(() => '');

  // Charge d'entraînement muscu réellement loggée sur la période.
  // muscuSets = { exerciseName: { 'YYYY-MM-DD': [{weight,reps}] } } (PAS un tableau).
  let trainingCtx = '';
  if (muscuSets && typeof muscuSets === 'object') {
    const since = dates[dates.length - 1];
    const trainDays = new Set();
    let totalSets = 0;
    for (const byDate of Object.values(muscuSets)) {
      for (const [date, sets] of Object.entries(byDate || {})) {
        if (date < since || !Array.isArray(sets) || sets.length === 0) continue;
        trainDays.add(date);
        totalSets += sets.length;
      }
    }
    if (totalSets > 0) {
      trainingCtx = `\nEntraînement muscu loggé (${days}j) : ${trainDays.size} jour(s) d'entraînement, ${totalSets} séries enregistrées.`;
    }
  }

  // Composition corporelle (mensurations) — signal de recomposition, complémentaire du poids.
  // measurements = array récent→ancien : [{date, weight, waist, chest, hips, arm, thigh, bodyFat, muscleMass, note}]
  const since = dates[dates.length - 1];
  let bodyCompCtx = '';
  {
    const inPeriod = (measurements || []).filter(m => m && m.date && m.date >= since);
    if (inPeriod.length >= 1) {
      const sorted = [...inPeriod].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const fmtDelta = (a, b, unit) => {
        const va = Number(a), vb = Number(b);
        if (!isFinite(va) || !isFinite(vb)) return null;
        const d = Math.round((vb - va) * 10) / 10;
        return `${va}${unit} → ${vb}${unit} (${d > 0 ? '+' : ''}${d}${unit})`;
      };
      const fmtLast = (v, unit) => (v != null && v !== '' && isFinite(Number(v))) ? `${Number(v)}${unit}` : null;
      const lines = [];
      const metrics = [
        ['Tour de taille', 'waist', 'cm'], ['Tour de poitrine', 'chest', 'cm'],
        ['Tour de hanches', 'hips', 'cm'], ['Tour de bras', 'arm', 'cm'], ['Tour de cuisse', 'thigh', 'cm'],
        ['% de graisse', 'bodyFat', '%'], ['Masse musculaire', 'muscleMass', 'kg'],
      ];
      for (const [label, key, unit] of metrics) {
        if (sorted.length >= 2 && first[key] != null && first[key] !== '' && last[key] != null && last[key] !== '') {
          const line = fmtDelta(first[key], last[key], unit);
          if (line) lines.push(`- ${label} : ${line}`);
        } else {
          const v = fmtLast(last[key], unit);
          if (v) lines.push(`- ${label} : ${v} (1 seul relevé)`);
        }
      }
      if (lines.length > 0) {
        const periodLabel = sorted.length >= 2 ? `${first.date} → ${last.date}` : `relevé du ${last.date}`;
        bodyCompCtx = `\n\nComposition corporelle (${sorted.length} relevé(s) sur la période, ${periodLabel}) :\n${lines.join('\n')}`;
      }
    }
  }

  // Ressenti hebdomadaire (check-ins) — humeur/énergie/sommeil + notes de l'élève.
  // checkins = array récent→ancien : [{weekDate, mood(1-5), energy(1-5), sleep(h), weight, notes, submittedAt}]
  let checkinCtx = '';
  {
    const inPeriod = (checkins || []).filter(c => c && c.weekDate && c.weekDate >= since);
    if (inPeriod.length >= 1) {
      const avg = (key) => {
        const vals = inPeriod.map(c => Number(c[key])).filter(v => isFinite(v));
        return vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10 : null;
      };
      const avgMood = avg('mood'), avgEnergy = avg('energy'), avgSleep = avg('sleep');
      const parts = [];
      if (avgMood != null) parts.push(`humeur moy ${avgMood}/5`);
      if (avgEnergy != null) parts.push(`énergie moy ${avgEnergy}/5`);
      if (avgSleep != null) parts.push(`sommeil moy ${avgSleep}h/nuit`);
      const sortedRecent = [...inPeriod].sort((a, b) => (b.weekDate || '').localeCompare(a.weekDate || ''));
      const notes = sortedRecent.filter(c => (c.notes || '').trim()).slice(0, 3)
        .map(c => `  - ${c.weekDate} : "${c.notes.trim()}"`);
      if (parts.length > 0 || notes.length > 0) {
        checkinCtx = `\n\nRessenti hebdomadaire de l'élève (${inPeriod.length} check-in(s) sur la période) :${parts.length ? `\n- Moyennes : ${parts.join(' · ')}` : ''}${notes.length ? `\n- Dernières notes de l'élève :\n${notes.join('\n')}` : ''}`;
      }
    }
  }

  // Anamnèse (intake) — objectifs, blessures (à respecter), allergies, mode de vie, motivation.
  let intakeCtx = '';
  let hasInjuries = false;
  if (intake) {
    const parts = [];
    if ((intake.goals || '').trim()) parts.push(`- Objectifs déclarés : ${intake.goals.trim()}`);
    if ((intake.injuries || '').trim()) { parts.push(`- Blessures / limitations : ${intake.injuries.trim()}`); hasInjuries = true; }
    if ((intake.medicalHistory || '').trim()) parts.push(`- Antécédents médicaux : ${intake.medicalHistory.trim()}`);
    if ((intake.allergies || '').trim()) parts.push(`- Allergies / intolérances : ${intake.allergies.trim()}`);
    if ((intake.lifestyle || '').trim()) parts.push(`- Mode de vie : ${intake.lifestyle.trim()}`);
    if ((intake.motivation || '').trim()) parts.push(`- Motivation : ${intake.motivation.trim()}`);
    if (parts.length > 0) {
      intakeCtx = `\n\nAnamnèse (questionnaire rempli par l'élève) :\n${parts.join('\n')}`;
    }
  }

  const hasStrava = stravaCtx !== '';
  const hasRecovery = recoveryCtx !== '' || trainingCtx !== '';
  const hasBodyComp = bodyCompCtx !== '';
  const hasCheckins = checkinCtx !== '';
  const hasIntake = intakeCtx !== '';
  const hasBlood = bloodTests.length > 0;
  const hasProgram = coachPrograms.length > 0 && active.length > 0;
  const hasProgramNoData = coachPrograms.length > 0 && active.length === 0;
  const hasHealth = !!healthHistory;
  const langInstr = lang !== 'fr' ? ` Write the entire report in ${LANG_NAMES[lang] || 'English'}.` : '';

  const conditionalInstructions = [
    "Rédige en t'adressant au coach — utilise la troisième personne pour l'athlète (ex : 'Paul consomme en moyenne...', pas 'Tu consommes...').",
    hasStrava ? "Des données Strava enrichies sont fournies (charge via suffer_score, FC moy/max, durée/dénivelé, allure, dépense réelle caloriesAdjusted). Dans 'Activité physique', analyse le volume, la charge d'entraînement et le cardio observé ; relie la charge récente à la récupération et aux recommandations (charge élevée → prudence/récup ; faible → marge pour progresser). Tiens compte de la dépense énergétique réelle pour les ajustements caloriques. N'invente AUCUNE donnée absente." : null,
    hasProgramNoData ? "Un programme nutritionnel a été envoyé mais aucune donnée alimentaire n'est disponible pour évaluer l'adhérence. Mentionne-le dans le bilan global." : null,
    hasProgram ? "Un programme nutritionnel est fourni. Dans la section Adhérence, compare les moyennes réalisées aux objectifs listés dans 'Alimentation', exprime les écarts en valeur absolue et en pourcentage par macro, utilise une liste <ul>." : null,
    hasBlood ? "Un bilan sanguin est fourni. Pour chaque marqueur hors norme, intègre des aliments correcteurs concrets avec des quantités indicatives (ex : '200g de lentilles 3×/semaine pour le fer')." : null,
    hasHealth ? "Des antécédents de santé sont fournis. Tiens-en compte dans toutes les recommandations et mentionne les contre-indications éventuelles." : null,
    hasRecovery ? "Des données d'objet connecté (sommeil, fréquence cardiaque, état de récupération) et/ou la charge d'entraînement réellement loggée sont fournies. Analyse la récupération de l'athlète, relie-la à sa charge et ses résultats, et propose des ajustements concrets (volume, intensité, sommeil). N'invente AUCUNE donnée absente." : null,
    hasBodyComp ? "Des mensurations (circonférences, % de graisse, masse musculaire) sont fournies. Analyse la RECOMPOSITION corporelle en croisant le poids ET la composition : un poids stable avec masse musculaire ↑ et % graisse ↓ est une bonne recomposition ; un poids qui baisse mais avec masse musculaire ↓ signale une perte de muscle à corriger. Ne te fie pas au seul poids. N'invente AUCUNE donnée absente." : null,
    hasCheckins ? "Le ressenti hebdomadaire de l'élève (humeur, énergie, sommeil) et ses notes sont fournis. Relie ce ressenti à la charge d'entraînement et aux résultats (ex : énergie/sommeil en baisse sous forte charge → risque de surmenage), et tiens compte des notes de l'élève dans tes recommandations." : null,
    hasInjuries ? "L'élève a déclaré des blessures ou limitations dans son anamnèse. Adapte IMPÉRATIVEMENT les recommandations en conséquence : mentionne explicitement les contre-indications et propose des alternatives respectant ces limitations." : null,
    hasIntake ? "Une anamnèse (objectifs, allergies, mode de vie, motivation) est fournie. Aligne tes recommandations sur les objectifs déclarés, respecte les allergies dans les suggestions alimentaires, et tiens compte du mode de vie et de la motivation." : null,
    "Chaque section : 3-5 paragraphes maximum. Sois dense et précis, pas exhaustif.",
  ].filter(Boolean).join('\n');

  const structureSections = [
    '<h2>Bilan global</h2>',
    '<h2>Analyse nutritionnelle</h2>',
    weeklyCtx !== '' ? '<h2>Tendance & progression</h2>' : null,
    hasBodyComp ? '<h2>Composition corporelle</h2>' : null,
    hasStrava ? '<h2>Activité physique</h2>' : null,
    hasRecovery ? '<h2>Récupération & charge d\'entraînement</h2>' : null,
    hasCheckins ? '<h2>Ressenti & adhérence</h2>' : null,
    hasProgram ? '<h2>Adhérence au programme</h2>' : null,
    '<h2>Points forts</h2>',
    '<h2>Points à travailler</h2>',
    hasBlood ? '<h2>Bilan sanguin & corrections nutritionnelles</h2>' : null,
    (hasHealth || hasIntake) ? '<h2>Antécédents & contre-indications</h2>' : null,
    '<h2>Recommandations pour le coach</h2>',
  ].filter(Boolean).join('\n');

  const system = `Tu es un coach nutritionniste expert. Rédige un bilan personnalisé pour cet athlète à destination de son coach. HTML : <h2>,<p>,<ul>,<li>,<strong>. Précis, bienveillant mais direct sur les points à améliorer. Ne tronque JAMAIS le rapport — il doit être complet jusqu'à la dernière section.${langInstr}
IMPORTANT : n'invente JAMAIS de données sportives. Si aucune donnée Strava n'est fournie, ne mentionne pas de fréquence, durée ou type de sport.
Base-toi UNIQUEMENT sur les données fournies. Si une information n'est pas disponible (ex. pas de Strava, pas de bilan sanguin, pas de mensurations, pas de check-in…), NE le signale PAS et ne mentionne JAMAIS qu'une donnée manque ou est absente : ignore simplement la section concernée et concentre-toi sur ce qui est disponible. Ne rédige aucune phrase du type « aucune donnée X », « X non fourni », « il manque », « données indisponibles ».
${conditionalInstructions}
Structure :
${structureSections}`;

  const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system, messages: [{ role: 'user', content: `${profileCtx}${healthCtx}${intakeCtx}${bloodCtx}\n\n${foodCtx}${weeklyCtx}${weightCtx}${bodyCompCtx}${stravaCtx}${programCtx}${recoveryCtx}${trainingCtx}${checkinCtx}` }] }),
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

  // Marque blanche : en-tête au logo/nom du coach (« sous ta marque »)
  const coachProfile = await userDb(auth.userId).get('coachProfile') || {};
  const coachName = coachProfile.displayName || me.name || 'Ton coach';
  const brandHeader = (coachProfile.logo || coachProfile.displayName || me.name)
    ? `<div style="display:flex;align-items:center;gap:12px;padding-bottom:16px;margin-bottom:20px;border-bottom:1px solid #e5e5e5">`
      + (coachProfile.logo ? `<img src="${coachProfile.logo}" alt="" style="height:44px;width:auto;max-width:160px;object-fit:contain"/>` : '')
      + `<div style="font-weight:600;font-size:15px;color:#333">${escHtml(coachName)}</div>`
      + `</div>`
    : '';
  const brandedHtml = brandHeader + html;

  const entry = {
    id: Date.now(),
    title: `Bilan nutritionnel — ${coachName}`,
    type: 'coach',
    date: new Date().toISOString(),
    html: brandedHtml,
    days: null,
  };
  await udb.set('reportHistory', [entry, ...history].slice(0, 20));

  const notifs = await udb.get('coachNotifications') || [];
  await udb.set('coachNotifications', [{ id: Date.now(), date: new Date().toISOString(), coachName: me.name || 'Ton coach', type: 'report', read: false }, ...notifs].slice(0, 20));

  try {
    const { sendPushToUser } = await import('../../push/send/route');
    const { sendExpoPushToUser } = await import('../../../lib/expoPush');
    const title = `📄 ${me.name || 'Ton coach'}`;
    const body = 'Ton bilan nutritionnel est disponible !';
    await Promise.all([
      sendPushToUser(athleteId, title, body, '/?tab=rapports'),
      sendExpoPushToUser(athleteId, title, body, { type: 'report' }),
    ]);
  } catch {}

  return Response.json({ ok: true });
}
