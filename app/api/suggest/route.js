import { requireAuth } from '../auth/session';
import { checkSuggestionsLimit, incrementSuggestions, upgradeResponse } from '../../lib/planServer';

const LANG_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch', pt: 'português', it: 'italiano' };

function detectLang(req) {
  const h = req.headers.get('accept-language') || '';
  const l = h.split(',')[0].split('-')[0].toLowerCase();
  return ['fr','en','es','de','pt','it'].includes(l) ? l : 'fr';
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const limit = await checkSuggestionsLimit(auth.userId);
  if (!limit.allowed) return upgradeResponse('suggestions');
  const lang = detectLang(req);
  const { remainingKcal, remainingProtein, remainingCarbs, remainingFat, hour, ingredientLibrary, savedRecipes, type = 'maintenant', withWhey = true, bloodTest = null, healthHistory = '' } = await req.json();

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
