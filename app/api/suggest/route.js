import { requireAuth } from '../auth/session';
import { userDb } from '../db';
import { checkSuggestionsLimit, incrementSuggestions, upgradeResponse } from '../../lib/planServer';
import { summarizeStravaActivities, trainingLoadLabel } from '../../lib/healthContext';
import { rateLimit } from '../../lib/ratelimit';

// Le biohack génère beaucoup de tokens (~15s) → laisser le temps à la fonction.
export const maxDuration = 60;

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const allowed = await rateLimit(`suggest:${auth.userId}`, 20, 3_600_000);
  if (!allowed) return Response.json({ error: 'Trop de requêtes, réessaie dans un moment' }, { status: 429 });
  // Élève rattaché à un coach : pas de génération de recettes IA.
  if (await userDb(auth.userId).get('coachId')) return Response.json({ error: 'COACH_MANAGED', message: 'Ton coach gère tes recettes.' }, { status: 403 });
  const limit = await checkSuggestionsLimit(auth.userId);
  if (!limit.allowed) return upgradeResponse('suggestions');
  const lang = detectLang(req);
  const { remainingKcal, remainingProtein, remainingCarbs, remainingFat, hour, ingredientLibrary, savedRecipes, type = 'maintenant', withWhey = true, bloodTest = null, healthHistory = '', diets = [] } = await req.json();

  // Régimes / allergènes choisis côté app (chips). Contrainte STRICTE sur la génération.
  const DIET_LABELS = {
    vege: 'végétarien (aucune viande ni poisson)', vegetarien: 'végétarien (aucune viande ni poisson)', vegetarian: 'végétarien (aucune viande ni poisson)',
    vegan: 'végan (aucun produit animal : ni viande, poisson, œuf, lait, miel)', vegetalien: 'végan (aucun produit animal)',
    keto: 'cétogène (très pauvre en glucides, riche en lipides)', cetogene: 'cétogène (très pauvre en glucides, riche en lipides)',
    lowcarb: 'pauvre en glucides', 'low-carb': 'pauvre en glucides',
    lactose: 'sans lactose (aucun produit laitier)', 'sans-lactose': 'sans lactose (aucun produit laitier)', 'sanslactose': 'sans lactose (aucun produit laitier)',
    gluten: 'sans gluten (ni blé, orge, seigle, avoine non certifiée)', 'sans-gluten': 'sans gluten', 'sansgluten': 'sans gluten',
  };
  const dietList = Array.isArray(diets) ? diets.filter(Boolean) : [];
  const dietInstruction = dietList.length
    ? `\nCONTRAINTE ALIMENTAIRE STRICTE — chaque suggestion DOIT impérativement respecter : ${dietList.map(d => DIET_LABELS[String(d).toLowerCase()] || d).join(' ; ')}. N'utilise AUCUN ingrédient interdit par ces régimes. Cette contrainte est non négociable et prime sur la variété.`
    : '';

  const meal = hour < 11 ? 'petit-déjeuner' : hour < 14 ? 'déjeuner' : hour < 17 ? 'collation' : 'dîner';

  const ingCtx = ingredientLibrary?.length > 0
    ? `\nIngrédients disponibles (placard) :\n${ingredientLibrary.map(i => `- ${i.name} : ${i.kcal} kcal/${i.unit}, ${i.protein}g protéines`).join('\n')}`
    : '';

  const recipeCtx = savedRecipes?.length > 0
    ? `\nRecettes enregistrées :\n${savedRecipes.map(r => {
        const total = r.items.reduce((a,i) => ({ kcal:a.kcal+i.kcal, protein:a.protein+i.protein, carbs:a.carbs+i.carbs, fat:a.fat+i.fat }), {kcal:0,protein:0,carbs:0,fat:0});
        const ing = r.items.map(i => `${i.quantity}${i.unit} ${i.name}`).join(', ');
        return `- "${r.name}" : ${ing} → ${Math.round(total.kcal)} kcal, ${Math.round(total.protein)}g prot`;
      }).join('\n')}`
    : '';

  const macroCtx = `Besoins restants : ${Math.round(remainingKcal)} kcal, ${Math.round(remainingProtein)}g protéines, ${Math.round(remainingCarbs)}g glucides, ${Math.round(remainingFat)}g lipides`;

  const weightRule = `Règle des poids :
- Féculents (riz, pâtes, semoule, quinoa, pommes de terre) et viandes/poissons → poids CRU
- Légumineuses en conserve (haricots rouges, pois chiches, lentilles en boîte, betterave, maïs en boîte, flageolets) → poids égoutté (tel qu'on les trouve en magasin, déjà cuits)`;

  const jsonFormat = `Réponds UNIQUEMENT en JSON valide sans backticks, sans texte autour.
Format :
{"suggestions":[{"name":"Poulet sauté au riz","steps":["Cuire le riz à l'eau 12 min","Faire revenir le poulet à la poêle 6-7 min chaque côté","Assaisonner, servir ensemble"],"ingredients":[{"name":"Blanc de poulet","quantity":150,"unit":"g"},{"name":"Riz","quantity":80,"unit":"g cru"}],"kcal":420,"protein":45,"carbs":38,"fat":6}]}
- Exactement 3 suggestions
- steps : 2 à 4 étapes courtes de préparation (pas de numérotation, juste l'action)
- name : nom court et appétissant
- ingredients : quantités précises, unité avec mention "cru" ou "égoutté" si utile`;

  const safeNum = v => isNaN(v) || v == null ? 0 : Math.round(v);
  const macroSafe = `Besoins restants : ${safeNum(remainingKcal)} kcal, ${safeNum(remainingProtein)}g protéines, ${safeNum(remainingCarbs)}g glucides, ${safeNum(remainingFat)}g lipides`;

  const bloodCtx = bloodTest
    ? `\nBilan sanguin (dernier en date) :${bloodTest.summary ? `\nRésumé : ${bloodTest.summary}` : ''}${bloodTest.weeklyFocus ? `\nFocus semaine : ${bloodTest.weeklyFocus}` : ''}${bloodTest.markers?.length > 0 ? `\nMarqueurs hors norme : ${bloodTest.markers.map(m => `${m.name} ${m.value}${m.unit} (${m.status})`).join(', ')}` : ''}${bloodTest.markerRecos?.length > 0 ? `\nAliments correcteurs par carence :\n${bloodTest.markerRecos.map(r => `- ${r.marker} (${r.status}) : favoriser ${(r.foods||[]).map(f => `${f.name} ${f.quantity} ${f.frequency}`).join(', ')}${r.synergy ? ` | Synergie: ${r.synergy}` : ''}${r.avoid ? ` | Éviter: ${r.avoid}` : ''}`).join('\n')}` : ''}${bloodTest.recommendations?.length > 0 ? `\nRecommandations : ${bloodTest.recommendations.map(r => `${r.type==='eat'?'✓':r.type==='avoid'?'✗':'-'} ${r.food||r.text}`).join(', ')}` : ''}`
    : '';

  let system, userMsg;

  const healthCtx = healthHistory ? `\nHistorique de santé IMPORTANT : ${healthHistory}` : '';
  const bloodInstruction = bloodTest
    ? `\nIMPORTANT — Bilan sanguin : adapte obligatoirement les suggestions selon les marqueurs hors norme et les recommandations. Favorise les aliments correcteurs, évite ceux contre-indiqués. Cela prime sur tout autre critère.`
    : '';

  if (type === 'maintenant') {
    system = `Tu es un nutritionniste et chef cuisinier. Propose exactement 3 repas adaptés au moment de la journée et aux macros restantes.
Priorité : 1) recettes enregistrées si elles correspondent, 2) ingrédients du placard, 3) autre chose.${bloodInstruction}
${weightRule}
${jsonFormat}`;
    userMsg = `Repas du moment : ${meal}\n${macroSafe}${healthCtx}\n${ingCtx}${recipeCtx}${bloodCtx}`;

  } else if (type === 'plat') {
    system = `Tu es un chef nutritionniste. Crée exactement 3 plats équilibrés, savoureux et simples à réaliser.
Ingrédients totalement libres — choisis ce qui correspond le mieux aux besoins nutritionnels et au bilan sanguin si fourni.${bloodInstruction}
${weightRule}
${jsonFormat}`;
    userMsg = `${macroSafe}\nPropose 3 plats équilibrés, variés et réalistes à cuisiner.${bloodCtx}`;

  } else if (type === 'dessert' && withWhey) {
    system = `Tu es un expert en pâtisserie protéinée et nutrition sportive.
Crée exactement 3 desserts gourmands à base de whey ou iso whey.
Chaque dessert DOIT contenir whey ou iso whey comme ingrédient principal (précise la saveur si pertinent).
Exemples : mug cake, mousse protéinée, glace, boules énergie, pancakes, tiramisu, cheesecake, brownie, cookie.
Ingrédients totalement libres.${bloodInstruction}
${weightRule}
${jsonFormat}`;
    userMsg = `${macroSafe}\nCrée 3 desserts protéinés gourmands à base de whey/iso whey.${bloodCtx}`;

  } else if (type === 'dessert' && !withWhey) {
    system = `Tu es un chef pâtissier spécialisé en desserts sains et savoureux.
Crée exactement 3 desserts SANS protéine en poudre (pas de whey, pas d'isolat) — ingrédients naturels uniquement.
Les desserts doivent être "propres" : sans sucre raffiné, sans farine blanche, ingrédients bruts de qualité.
Exemples d'ingrédients : chocolat noir 85%+, dattes, bananes, flocons d'avoine, amandes, beurre de cacahuète naturel, noix de coco, yaourt grec, fromage blanc, fruits frais, miel, sirop d'érable, cacao cru, graines de chia, compote.
Formats possibles : chia pudding, nice cream, energy balls, tarte aux fruits, fondant chocolat-datte, mousse avocat-cacao, porridge froid, crumble avoine-fruits.
Très gourmand et satisfaisant malgré l'absence de sucre raffiné.${bloodInstruction}
${weightRule}
${jsonFormat}`;
    userMsg = `${macroSafe}\nCrée 3 desserts clean et gourmands sans protéine en poudre.${bloodCtx}`;

  } else if (type === 'biohack') {
    system = `Tu es un expert en biohacking, performance sportive, récupération et médecine fonctionnelle.
Propose exactement 3 protocoles d'optimisation — PAS des repas. Ce sont des shots, cocktails fonctionnels, stacks de suppléments ou boissons actives à très faibles calories.
${bloodInstruction}
Catégories possibles :
- SHOT (30-60ml) : citron frais + curcuma + piment de cayenne + gingembre + poivre noir, à boire cul sec
- COCKTAIL FONCTIONNEL (200-300ml) : eau de coco + spiruline + chlorelle + citron vert + gingembre + MCT
- STACK ADAPTOGENS : ashwagandha + rhodiola + lion's mane + reishi dans eau chaude ou smoothie léger
- PRÉ-SÉANCE : caféine naturelle + L-théanine + créatine + beta-alanine + citron
- POST-SÉANCE RÉCUP : cerise griotte + curcuma + poivre noir + magnésium + zinc
- SOMMEIL/RÉCUP NUIT : magnésium glycinate + ashwagandha + mélisse + lavande en tisane chaude
- ANTI-INFLAMMATION : gingembre + curcuma + poivre noir + omega-3 (huile de lin) + citron

Cible précise pour chaque protocole : performance, récupération, sommeil, immunité, anti-inflammation, focus, énergie mitochondriale.
Calories très basses (0-80 kcal max). Ingrédients simples, achetables, sans ordonnance.
Nom court et impactant (ex: "Shot Feu Immunitaire", "Stack Récup Nuit Profonde", "Pré-Séance Énergie Brûlante").

Réponds UNIQUEMENT en JSON valide sans backticks.
Format :
{"suggestions":[{"name":"Shot Feu Immunitaire","target":"Immunité & anti-inflammation","timing":"Matin à jeun","steps":["Presser 1 citron entier","Râper 2cm de gingembre frais","Ajouter 1/2 cc curcuma + pincée poivre noir + pincée piment de cayenne","Mélanger, boire cul sec"],"ingredients":[{"name":"Citron","quantity":1,"unit":"unité"},{"name":"Gingembre frais","quantity":10,"unit":"g"},{"name":"Curcuma en poudre","quantity":2,"unit":"g"},{"name":"Poivre noir","quantity":0.5,"unit":"g"},{"name":"Piment de cayenne","quantity":0.5,"unit":"g"}],"kcal":25,"protein":1,"carbs":5,"fat":0}]}`;
    userMsg = `Profil athlète — ${macroSafe}\nPropose 3 protocoles biohacking distincts (shot, cocktail fonctionnel ou stack) adaptés à la récupération, la performance ou le sommeil.${bloodCtx}`;
  }

  // Contexte récupération (Health Connect / Apple Santé) → recettes & biohacks "en conséquence"
  try {
    const hc = await userDb(auth.userId).get('healthConnectData');
    if (hc) {
      const r = [];
      if (hc.avgSleep)  r.push(`sommeil ${hc.avgSleep}h/nuit`);
      if (hc.sleepStages) {
        const st = hc.sleepStages; const tot = (st.deep || 0) + (st.light || 0) + (st.rem || 0);
        if (tot > 0) r.push(`sommeil profond ${Math.round(st.deep / tot * 100)}%`);
      }
      if (hc.hrv)       r.push(`HRV ${hc.hrv}ms`);
      if (hc.restingHR) r.push(`FC repos ${hc.restingHR}bpm`);
      if (hc.avgHR)     r.push(`FC moyenne ${hc.avgHR}bpm`);
      if (hc.avgSteps)  r.push(`${hc.avgSteps} pas/j`);
      if (r.length) {
        userMsg += `\n\nÉtat de récupération RÉEL de l'utilisateur (objet connecté) : ${r.join(', ')}.\n` +
          `Adapte les suggestions à CES données et n'invente jamais une valeur absente. ` +
          `Récup faible (sommeil court < 6h / sommeil profond bas < 13% / FC repos élevée) → ` +
          `privilégie aliments & protocoles anti-inflammatoires, magnésium, oméga-3, glucides de qualité, favorise la récupération ; ` +
          `bonne récup (sommeil ≥ 7h, profond ≥ 15%, FC repos basse) → tu peux viser performance / énergie. Pour un biohack, choisis la cible ` +
          `(récup / sommeil / anti-inflammation / énergie / focus) selon cet état.`;
      }
    }
  } catch (e) {}

  // Charge d'entraînement RÉELLE (Strava enrichi, 7j) → adapter recettes/biohacks à l'effort fourni
  try {
    const stravaCache = await userDb(auth.userId).get('stravaCache');
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recent = (stravaCache?.activities || []).filter(a => (a.date || '') >= cutoff);
    const s = summarizeStravaActivities(recent);
    if (s) {
      const parts = [`${s.count} séance(s)`, `${s.totalDurationMin} min`, `${s.totalKcal} kcal dépensées`];
      if (s.sufferTotal != null) parts.push(`charge ${trainingLoadLabel(s.sufferTotal)} (suffer ${s.sufferTotal})`);
      userMsg += `\n\nActivité sportive RÉELLE 7j (Strava) : ${s.types.join(', ') || '—'} — ${parts.join(', ')}.\n` +
        `Adapte les suggestions à cette dépense et à cette charge : charge/dépense élevée → favorise la récupération (anti-inflammatoires, glucides de qualité, protéines, hydratation/électrolytes) et un apport suffisant ; charge faible → reste sur l'objectif. N'invente AUCUNE donnée absente.`;
    }
  } catch (e) {}

  // Régimes choisis : on l'ajoute au message utilisateur pour TOUS les types.
  if (dietInstruction) userMsg += `\n${dietInstruction}`;

  if (lang !== 'fr') {
    system += `\nIMPORTANT: Write all meal names, step descriptions, ingredient names, and any text fields in ${LANG_NAMES[lang] || 'English'}.`;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: type === 'biohack' ? 2400 : 1400,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: 'Erreur API' }, { status: res.status });

  const text = data.content?.find(b => b.type === 'text')?.text || '';
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  if (!parsed) { const m = text.match(/\{[\s\S]*\}/); if (m) try { parsed = JSON.parse(m[0]); } catch {} }
  if (!parsed) return Response.json({ error: 'Erreur' }, { status: 500 });

  await incrementSuggestions(auth.userId).catch(()=>{});
  return Response.json({ ...parsed, _usage: limit.limit === Infinity ? null : { used: (limit.count||0)+1, limit: limit.limit } });
}
