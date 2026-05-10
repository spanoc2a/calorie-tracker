export const COLORS = {
  bg: '#0d0d0d', gold: '#a89050', cream: '#f0e6c8',
  dark: '#1a1a14', muted: '#666', card: '#1a1a14',
};

// ─── TÉMOIGNAGES ──────────────────────────────────────────────────────────────
// Formule : problème identifiable → révélation → résultat chiffré

export const TESTIMONIALS = [
  {
    id: 'T01', name: 'Marie L.', age: 34, job: 'Infirmière',
    quote: 'J\'ai fait 4 régimes en 2 ans. Nutrainer m\'a montré en 3 jours que je sous-estimais mes calories de 400 par jour. En 90 jours j\'ai perdu 8kg sans me priver.',
    result: '-8 kg en 90 jours', stars: 5, feature: 'Rapport 90 jours',
  },
  {
    id: 'T02', name: 'Thomas B.', age: 28, job: 'Développeur',
    quote: 'Je mangeais "beaucoup" depuis 6 mois et je ne prenais pas de muscle. L\'IA m\'a montré que j\'avais un déficit de 45g de protéines par jour. Résultat : +6kg en 4 mois.',
    result: '+6 kg de muscle en 4 mois', stars: 5, feature: 'Suggestions IA',
  },
  {
    id: 'T03', name: 'Sophie M.', age: 41, job: 'Manager',
    quote: 'Mon médecin me disait que tout était normal. J\'ai scanné mon bilan sur Nutrainer — ferritine à 12, largement en dessous. Ça expliquait ma fatigue depuis 2 ans.',
    result: 'Carence détectée en 2 minutes', stars: 5, feature: 'Bilan sanguin IA',
  },
  {
    id: 'T04', name: 'Lucas D.', age: 25, job: 'Cycliste amateur',
    quote: 'Je faisais 5 sorties vélo par semaine et je ne perdais pas un gramme. Nutrainer m\'a montré que je remangeais exactement ce que je brûlais. Problème réglé.',
    result: '-5 kg en 6 semaines', stars: 5, feature: 'Strava connecté',
  },
  {
    id: 'T05', name: 'Camille R.', age: 32, job: 'Enseignante',
    quote: 'Végétarienne depuis 3 ans, je n\'atteignais jamais mes protéines. L\'IA me suggère chaque soir exactement quoi manger pour compléter. Simple. Efficace.',
    result: 'Objectif protéines atteint chaque jour', stars: 5, feature: 'Suggestions IA',
  },
  {
    id: 'T06', name: 'Nicolas P.', age: 45, job: 'Chef de projet',
    quote: 'Cholestérol élevé depuis 2 ans. Mon médecin m\'a dit "mangez mieux". Nutrainer m\'a dit exactement quoi changer. En 2 mois mon bilan a surpris mon cardiologue.',
    result: 'Cholestérol -18% en 2 mois', stars: 5, feature: 'Suivi bilan sanguin',
  },
  {
    id: 'T07', name: 'Emma V.', age: 29, job: 'Coach nutrition',
    quote: 'Avant je suivais mes athlètes sur WhatsApp. Maintenant je vois leurs macros, leurs alertes, leur poids — tout en temps réel. Je coach 14 personnes depuis mon téléphone.',
    result: '14 athlètes suivis, zéro tableur', stars: 5, feature: 'Dashboard Coach',
  },
  {
    id: 'T08', name: 'Julien F.', age: 38, job: 'Commercial',
    quote: 'Le rapport 90 jours m\'a choqué. Je pensais bien manger — en réalité j\'étais à 1400 kcal/j pour un objectif de 2000. Je stagnais depuis 3 mois pour ça.',
    result: 'Plateau brisé en 2 semaines', stars: 5, feature: 'Rapport 90 jours',
  },
  {
    id: 'T09', name: 'Léa C.', age: 26, job: 'Triathlète',
    quote: 'Je mangeais pareil les jours de course et les jours de repos. Nutrainer m\'a appris à cycler mes glucides selon l\'effort. Ma récup a changé du tout au tout.',
    result: 'PR sur triathlon', stars: 5, feature: 'Strava + Nutrition',
  },
  {
    id: 'T10', name: 'Marc T.', age: 52, job: 'Médecin généraliste',
    quote: 'J\'étais sceptique sur l\'IA médicale. L\'analyse du bilan sanguin est cliniquement rigoureuse. Je l\'utilise moi-même et je le recommande à certains patients.',
    result: 'Validé par un médecin', stars: 5, feature: 'Analyse médicale IA',
  },
  {
    id: 'T11', name: 'Claire H.', age: 31, job: 'Graphiste',
    quote: 'Plateau depuis 4 mois. Le rapport m\'a tout expliqué : je sous-mangeais les jours de sport, donc mon corps stockait. Une semaine après avoir corrigé, j\'avais perdu 1,2kg.',
    result: '-1,2 kg la première semaine', stars: 5, feature: 'Rapport 30 jours',
  },
  {
    id: 'T12', name: 'Antoine G.', age: 27, job: 'Préparateur physique',
    quote: 'Mes clients me demandent souvent un suivi entre les séances. Nutrainer fait ça mieux que moi — il les alerte en temps réel, pas une fois par semaine.',
    result: 'Meilleure adhérence des clients', stars: 5, feature: 'Coaching continu',
  },
];

// ─── DÉMOS FEATURES ───────────────────────────────────────────────────────────
// Formule : douleur → solution concrète → résultat immédiat

export const FEATURES = [
  {
    id: 'F01', title: 'Fini de compter à la main', emoji: '📱',
    steps: [
      'Tu scannes le code-barres de ce que tu manges',
      'Calories, protéines, glucides, lipides — tout s\'ajoute seul',
      'Tu vois en temps réel ce qu\'il reste avant ton objectif',
      'Le soir tu sais exactement où tu en es. Sans calcul.',
    ],
    hook: '80% des gens se trompent sur leurs apports. Toi non.',
    cta: 'Essayer gratuitement 7 jours',
  },
  {
    id: 'F02', title: 'Ton coach IA à 23h', emoji: '🤖',
    steps: [
      'Il est 23h, tu regardes ton journal de la journée',
      'Il te manque 40g de protéines',
      'L\'IA t\'envoie une suggestion adaptée à ce que tu as déjà mangé',
      'Tu valides. C\'est loggé. Tu vas dormir tranquille.',
    ],
    hook: 'Un nutritionniste à 200€ te voit 1h par mois. L\'IA te suit chaque jour.',
    cta: 'Activer les suggestions IA',
  },
  {
    id: 'F03', title: 'Ton bilan sanguin enfin expliqué', emoji: '🩸',
    steps: [
      'Tu prends ton bilan en photo',
      'L\'IA lit chaque marqueur et les compare aux normes',
      'Elle te dit ce qui est anormal — et pourquoi ça impacte ton énergie',
      'Elle croise avec ton alimentation et te dit quoi corriger',
    ],
    hook: '"Tout est normal" — mais tu te sens épuisé quand même.',
    cta: 'Scanner mon bilan sanguin',
  },
  {
    id: 'F04', title: 'Mange en fonction de ton effort', emoji: '🚴',
    steps: [
      'Tu connectes Strava en 30 secondes',
      'Après chaque séance, tes calories brûlées sont intégrées',
      'Nutrainer ajuste ton objectif du jour automatiquement',
      'Jours de sport et jours de repos ne sont plus traités pareil',
    ],
    hook: 'Tu fais du sport 5x/semaine et tu ne perds rien. Voilà pourquoi.',
    cta: 'Connecter Strava maintenant',
  },
  {
    id: 'F05', title: 'Le rapport qui change tout', emoji: '📊',
    steps: [
      'Nutrainer analyse tes 30 derniers jours',
      'Moyenne réelle vs objectif, jours de dérive, tendance poids',
      'Il identifie exactement où ça coince',
      'Tu reçois des recommandations concrètes pour le mois suivant',
    ],
    hook: 'Tu crois bien manger. Le rapport te dit la vérité.',
    cta: 'Générer mon rapport',
  },
  {
    id: 'F06', title: 'Coache sans WhatsApp', emoji: '👨‍💼',
    steps: [
      'Tous tes athlètes sur un seul écran',
      'Alerte automatique si quelqu\'un sous-mange depuis 3 jours',
      'Tu vois leur journal, leur poids, leurs séances Strava',
      'Tu interviens quand c\'est nécessaire — pas à l\'aveugle',
    ],
    hook: 'Tes athlètes méritent un suivi quotidien, pas hebdomadaire.',
    cta: 'Voir les formules Coach',
  },
];

// ─── CONTENUS ÉDUCATIFS ───────────────────────────────────────────────────────
// Formule : croyance fausse → vérité → solution → CTA

export const EDUC = [
  {
    id: 'E01', title: 'Pourquoi tu stagnes malgré le sport',
    hook: 'Tu fais du sport 4x par semaine depuis 3 mois. La balance ne bouge plus.',
    points: [
      'Le sport brûle 400-600 kcal/séance — tu les remanges sans t\'en rendre compte',
      'Sans croiser tes dépenses sportives et tes apports, tu tournes en rond',
      'Nutrainer connecte Strava à ton journal — tu vois le bilan net en temps réel',
    ],
    cta: 'Arrêter de stagner',
  },
  {
    id: 'E02', title: 'La vérité sur ton bilan sanguin',
    hook: '"Tout est dans les normes" — mais les normes sont larges. Très larges.',
    points: [
      'Une ferritine à 15 est "normale" mais provoque une fatigue chronique',
      'Une vitamine D à 22 est "correcte" mais ralentit ta récupération',
      'L\'IA Nutrainer analyse chaque valeur et te dit ce qui impacte vraiment ta forme',
    ],
    cta: 'Comprendre mon bilan',
  },
  {
    id: 'E03', title: 'Compter les calories ne suffit pas',
    hook: 'Tu es à 1800 kcal par jour et tu ne perds toujours pas de poids.',
    points: [
      'Les calories ne disent pas tout — 1800 kcal de sucre ≠ 1800 kcal de protéines',
      'Sans assez de protéines, tu perds du muscle et non de la graisse',
      'Nutrainer suit tes 4 macros et t\'alerte dès qu\'un ratio déraille',
    ],
    cta: 'Suivre mes macros',
  },
  {
    id: 'E04', title: 'Ce qu\'un nutritionniste ne peut pas faire',
    hook: 'Tu paies 200€ pour 45 minutes par mois. Entre les séances, tu es seul.',
    points: [
      'Un nutritionniste te voit 12h par an — l\'IA analyse tes 365 jours',
      'Elle te corrige le soir même si tu dérives, pas un mois après',
      'À 9,99€/mois avec 7 jours gratuits — sans engagement',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    id: 'E05', title: 'Prise de masse : l\'erreur des 90%',
    hook: 'Tu manges "beaucoup" depuis 3 mois. Tu ne prends pas de muscle.',
    points: [
      'La prise de masse demande un surplus précis de 200-300 kcal — pas "manger plus"',
      'Sans suivi, tu prends de la graisse, pas du muscle',
      'Nutrainer calcule ton surplus idéal et suit tes protéines au gramme près',
    ],
    cta: 'Optimiser ma prise de masse',
  },
  {
    id: 'E06', title: 'Pourquoi ton régime a échoué',
    hook: 'Le régime marchait. Puis ça s\'est arrêté. Et tu as tout repris.',
    points: [
      'Un régime trop restrictif ralentit ton métabolisme — ton corps s\'adapte',
      'Sans données réelles, tu coupes trop ou pas assez',
      'Nutrainer te maintient dans la zone optimale — ni trop, ni trop peu',
    ],
    cta: 'Trouver mon vrai déficit',
  },
];
