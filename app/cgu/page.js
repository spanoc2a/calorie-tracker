'use client';

export default function CguPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', color:'#e8e0d0', fontFamily:"'DM Mono',monospace", padding:'40px 20px', maxWidth:680, margin:'0 auto' }}>
      <div style={{ marginBottom:32 }}>
        <a href="/" style={{ fontSize:'0.65rem', color:'#5a5a4a', textDecoration:'none', letterSpacing:2, textTransform:'uppercase' }}>← Retour</a>
      </div>

      <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.6rem', color:'#f0e6c8', marginBottom:8, fontWeight:400 }}>Conditions Générales d'Utilisation</h1>
      <p style={{ fontSize:'0.62rem', color:'#4a4a3a', marginBottom:40, letterSpacing:1 }}>En vigueur au 1er mai 2025</p>

      <S title="1. Objet et acceptation">
        <p>Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de l'application Nutrainer (ci-après « le Service »), éditée par son propriétaire (ci-après « l'Éditeur »).</p>
        <p>En créant un compte, l'utilisateur reconnaît avoir lu, compris et accepté sans réserve les présentes CGU ainsi que la <a href="/privacy" style={{ color:'#c8b890' }}>Politique de confidentialité</a>. Cette acceptation est matérialisée par la case à cocher lors de l'inscription et vaut signature électronique au sens de l'article 1366 du Code civil.</p>
        <p>Si l'utilisateur n'accepte pas ces conditions, il lui est demandé de ne pas utiliser le Service.</p>
      </S>

      <S title="2. Description du Service">
        <p>Nutrainer est une application de suivi nutritionnel et d'entraînement physique proposant notamment :</p>
        <ul>
          <li>La saisie et l'analyse de journaux alimentaires par intelligence artificielle</li>
          <li>Le suivi du poids, des macronutriments et des objectifs physiques</li>
          <li>Des programmes d'entraînement générés par intelligence artificielle</li>
          <li>L'analyse de bilans biologiques (prises de sang) par intelligence artificielle</li>
          <li>Une plateforme de suivi coach / athlète</li>
          <li>La synchronisation avec des services tiers (Strava, etc.)</li>
        </ul>
        <p>Le Service est fourni « en l'état », sans garantie de résultat, de performance ou d'adéquation à un objectif particulier.</p>
      </S>

      <S title="3. Conditions d'accès">
        <p>L'accès au Service est réservé aux personnes physiques âgées d'au moins 16 ans. Toute personne mineure de moins de 16 ans doit obtenir l'accord préalable de son représentant légal.</p>
        <p>L'inscription est gratuite. L'Éditeur se réserve le droit d'introduire des fonctionnalités payantes à tout moment, sans que cela affecte les fonctionnalités gratuites existantes.</p>
        <p>L'utilisateur s'engage à fournir des informations exactes lors de l'inscription et à les maintenir à jour.</p>
      </S>

      <S title="4. Obligations de l'utilisateur">
        <p>L'utilisateur s'engage à :</p>
        <ul>
          <li>Utiliser le Service conformément aux lois et règlements en vigueur</li>
          <li>Ne pas tenter de contourner les mesures de sécurité du Service</li>
          <li>Ne pas partager ses identifiants de connexion</li>
          <li>Ne pas utiliser le Service à des fins illicites, frauduleuses ou malveillantes</li>
          <li>Ne pas soumettre de contenus portant atteinte aux droits de tiers ou à l'ordre public</li>
          <li>Ne pas tenter d'extraire, reproduire ou revendre les données du Service</li>
        </ul>
        <p>Tout manquement à ces obligations peut entraîner la suspension ou la suppression immédiate du compte, sans préavis ni indemnité.</p>
      </S>

      <S title="5. Avertissement médical et limitation du contenu IA">
        <p><strong>Le Service ne fournit pas de conseil médical.</strong> Les analyses, recommandations nutritionnelles, interprétations de bilans biologiques et programmes d'entraînement générés par intelligence artificielle ont une valeur <strong>purement informative et indicative</strong>. Ils ne constituent en aucun cas un diagnostic médical, une prescription ou un avis de professionnel de santé.</p>
        <p>L'utilisateur reconnaît expressément :</p>
        <ul>
          <li>Que toute décision relative à sa santé, son alimentation ou son entraînement doit être prise en consultation avec un professionnel de santé qualifié (médecin, diététicien, coach diplômé)</li>
          <li>Que l'intelligence artificielle peut produire des erreurs, des approximations ou des recommandations inadaptées à sa situation particulière</li>
          <li>Que l'analyse de bilans biologiques par IA ne remplace pas l'interprétation d'un médecin</li>
          <li>Qu'il utilise ces fonctionnalités sous sa seule et entière responsabilité</li>
        </ul>
        <p>L'Éditeur décline expressément toute responsabilité pour les conséquences, directes ou indirectes, résultant de l'utilisation des recommandations produites par le Service.</p>
      </S>

      <S title="6. Utilisation des données anonymisées">
        <p>En acceptant les présentes CGU, l'utilisateur autorise expressément l'Éditeur à utiliser ses données de manière <strong>strictement anonymisée et agrégée</strong> aux fins suivantes :</p>
        <ul>
          <li>Amélioration des algorithmes et modèles d'intelligence artificielle utilisés par le Service</li>
          <li>Production de statistiques d'usage anonymes (tendances alimentaires, profils d'entraînement, etc.)</li>
          <li>Recherche et développement interne</li>
          <li>Amélioration de la pertinence des suggestions nutritionnelles et sportives</li>
        </ul>
        <p>L'anonymisation garantit qu'aucune donnée ne peut être rattachée à un utilisateur identifié ou identifiable. Aucune donnée nominative, aucun email, aucune donnée permettant d'identifier directement ou indirectement l'utilisateur n'est utilisé dans ce cadre.</p>
        <p>Cette utilisation est distincte du traitement décrit dans la <a href="/privacy" style={{ color:'#c8b890' }}>Politique de confidentialité</a> et ne requiert aucune rémunération.</p>
      </S>

      <S title="7. Propriété intellectuelle">
        <p>L'ensemble des éléments du Service (interface, code, textes, logos, algorithmes) est la propriété exclusive de l'Éditeur et est protégé par les lois relatives à la propriété intellectuelle.</p>
        <p>L'utilisateur se voit accorder un droit d'usage personnel, non exclusif, non transférable et révocable du Service, strictement limité à son usage personnel.</p>
        <p>Les données saisies par l'utilisateur (journal alimentaire, poids, bilans) restent sa propriété. Il en concède à l'Éditeur une licence d'utilisation pour la fourniture du Service et, sous forme anonymisée, conformément à l'article 6.</p>
      </S>

      <S title="8. Limitation de responsabilité">
        <p>Dans toute la mesure permise par le droit applicable, l'Éditeur ne saurait être tenu responsable :</p>
        <ul>
          <li>Des interruptions, pannes ou indisponibilités du Service, quelle qu'en soit la cause</li>
          <li>De la perte de données consécutive à un dysfonctionnement technique</li>
          <li>Des dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utilisation du Service</li>
          <li>Des erreurs, imprécisions ou omissions dans les contenus générés par intelligence artificielle</li>
          <li>Des décisions prises par l'utilisateur sur la base des informations fournies par le Service</li>
          <li>De tout préjudice lié à l'accès de tiers au compte de l'utilisateur du fait d'une négligence de ce dernier</li>
        </ul>
        <p>La responsabilité de l'Éditeur, si elle venait à être engagée, serait en tout état de cause limitée aux sommes effectivement versées par l'utilisateur au titre du Service au cours des douze derniers mois.</p>
      </S>

      <S title="9. Disponibilité du Service">
        <p>Le Service est accessible 24h/24 et 7j/7, sous réserve des opérations de maintenance et des cas de force majeure. L'Éditeur ne garantit aucun taux de disponibilité et se réserve le droit de suspendre l'accès au Service à tout moment pour des raisons techniques, de sécurité ou commerciales, sans préavis ni indemnité.</p>
      </S>

      <S title="10. Suspension et résiliation">
        <p>L'Éditeur se réserve le droit de suspendre ou supprimer tout compte, sans préavis, en cas de :</p>
        <ul>
          <li>Violation des présentes CGU</li>
          <li>Utilisation abusive ou frauduleuse du Service</li>
          <li>Inactivité prolongée (plus de 24 mois sans connexion)</li>
          <li>Décision commerciale de l'Éditeur</li>
        </ul>
        <p>L'utilisateur peut supprimer son compte à tout moment depuis les paramètres de l'application. Cette suppression entraîne l'effacement définitif et irréversible de toutes ses données personnelles dans un délai raisonnable, à l'exception des données anonymisées.</p>
      </S>

      <S title="11. Modification des CGU">
        <p>L'Éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet dès leur publication dans l'application. L'utilisateur sera informé de toute modification substantielle. La poursuite de l'utilisation du Service après modification vaut acceptation des nouvelles CGU.</p>
      </S>

      <S title="12. Droit applicable et juridiction">
        <p>Les présentes CGU sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux français seront seuls compétents.</p>
        <p>Conformément à l'article L.612-1 du Code de la consommation, l'utilisateur peut recourir gratuitement à un médiateur de la consommation en cas de litige non résolu avec l'Éditeur.</p>
      </S>

      <S title="13. Contact">
        <p>Pour toute question relative aux présentes CGU : <span style={{ color:'#c8b890' }}>contact@nutritracker.app</span></p>
      </S>
    </div>
  );
}

function S({ title, children }) {
  return (
    <div style={{ marginBottom:32 }}>
      <h2 style={{ fontSize:'0.78rem', color:'#c8b890', letterSpacing:2, textTransform:'uppercase', marginBottom:12, fontWeight:400 }}>{title}</h2>
      <div style={{ fontSize:'0.72rem', color:'#8a8070', lineHeight:1.9 }}>
        {children}
      </div>
      <style>{`ul{padding-left:20px;margin:8px 0}li{margin-bottom:6px}p{margin:0 0 10px 0}strong{color:#a89878}`}</style>
    </div>
  );
}
