'use client';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e8e0d0', fontFamily: "'DM Mono', monospace", padding: '40px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ fontSize: '0.65rem', color: '#5a5a4a', textDecoration: 'none', letterSpacing: 2, textTransform: 'uppercase' }}>← Retour</a>
      </div>

      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: '#f0e6c8', marginBottom: 8, fontWeight: 400 }}>Politique de confidentialité</h1>
      <p style={{ fontSize: '0.62rem', color: '#4a4a3a', marginBottom: 40, letterSpacing: 1 }}>Dernière mise à jour : mai 2025</p>

      <Section title="1. Qui sommes-nous ?">
        <p>Nutrainer est une application de suivi nutritionnel et d'entraînement. Le responsable du traitement des données est l'éditeur de l'application, joignable à l'adresse : <span style={{ color: '#c8b890' }}>contact@nutrainer.app</span></p>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons uniquement les données nécessaires au fonctionnement de l'application :</p>
        <ul>
          <li><strong>Données de compte :</strong> adresse e-mail, mot de passe (chiffré, non lisible), prénom</li>
          <li><strong>Données de santé :</strong> poids, taille, âge, sexe, objectifs caloriques</li>
          <li><strong>Journal alimentaire :</strong> repas saisis quotidiennement</li>
          <li><strong>Séances d'entraînement :</strong> exercices, séries, poids</li>
          <li><strong>Bilans sanguins :</strong> résultats uploadés volontairement pour analyse</li>
          <li><strong>Données Strava :</strong> activités sportives, si vous connectez votre compte</li>
        </ul>
      </Section>

      <Section title="3. Finalités du traitement">
        <p>Vos données sont utilisées pour :</p>
        <ul>
          <li>Calculer et afficher votre suivi nutritionnel quotidien</li>
          <li>Générer des programmes alimentaires et d'entraînement personnalisés via IA</li>
          <li>Permettre à votre coach (si applicable) de suivre vos progrès</li>
          <li>Vous envoyer des rappels si vous avez accepté les notifications</li>
          <li>Générer des rapports hebdomadaires de synthèse</li>
        </ul>
        <p>Base légale : exécution du contrat (article 6.1.b RGPD) et votre consentement pour les données de santé (article 9 RGPD).</p>
      </Section>

      <Section title="4. Intelligence artificielle">
        <p>Certaines fonctionnalités utilisent l'API Anthropic (Claude). Vos données alimentaires, bilans sanguins et profil de santé peuvent être transmis à Anthropic pour générer des analyses. Anthropic s'engage à ne pas utiliser ces données pour entraîner ses modèles (voir leur politique Zero Data Retention pour les API).</p>
      </Section>

      <Section title="5. Partage des données">
        <p>Vos données ne sont jamais vendues. Elles peuvent être partagées avec :</p>
        <ul>
          <li><strong>Votre coach</strong> (si vous avez utilisé un lien d'invitation) : journal, poids, programmes</li>
          <li><strong>Anthropic</strong> : pour l'analyse IA (voir section 4)</li>
          <li><strong>Strava</strong> : uniquement si vous connectez votre compte</li>
          <li><strong>Vercel</strong> : hébergeur de l'application (infrastructure)</li>
        </ul>
      </Section>

      <Section title="6. Durée de conservation">
        <ul>
          <li>Données de compte : jusqu'à suppression du compte</li>
          <li>Journal alimentaire : 12 mois glissants</li>
          <li>Historique de poids : 12 mois</li>
          <li>Messages coach : 500 derniers messages par conversation</li>
          <li>Rapports hebdomadaires : 20 derniers rapports</li>
        </ul>
      </Section>

      <Section title="7. Vos droits (RGPD)">
        <p>Conformément au Règlement Général sur la Protection des Données, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'accès :</strong> obtenir une copie de vos données via l'export dans les paramètres</li>
          <li><strong>Droit de rectification :</strong> modifier vos données dans les paramètres</li>
          <li><strong>Droit à l'effacement :</strong> supprimer votre compte dans les paramètres (suppression immédiate et définitive)</li>
          <li><strong>Droit à la portabilité :</strong> exporter vos données au format JSON</li>
          <li><strong>Droit d'opposition :</strong> nous contacter pour tout traitement non nécessaire au service</li>
        </ul>
        <p>Pour exercer ces droits : <span style={{ color: '#c8b890' }}>contact@nutrainer.app</span></p>
        <p>Vous pouvez également contacter la CNIL : <span style={{ color: '#c8b890' }}>www.cnil.fr</span></p>
      </Section>

      <Section title="8. Sécurité">
        <p>Les mots de passe sont chiffrés (PBKDF2-SHA256, 100 000 itérations). Les sessions expirent après 30 jours. Les accès aux données sont limités par authentification. L'infrastructure est hébergée sur Vercel (datacenters EU disponibles).</p>
      </Section>

      <Section title="9. Cookies">
        <p>Nous utilisons un unique cookie de session sécurisé (HttpOnly, SameSite=Strict) nécessaire au fonctionnement du compte. Aucun cookie publicitaire ni traceur tiers.</p>
      </Section>

      <Section title="10. Modifications">
        <p>Cette politique peut être mise à jour. En cas de modification substantielle, vous en serez informé via l'application.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: '0.8rem', color: '#c8b890', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 400 }}>{title}</h2>
      <div style={{ fontSize: '0.72rem', color: '#8a8070', lineHeight: 1.9 }}>
        {children}
      </div>
      <style>{`
        ul { padding-left: 20px; margin: 8px 0; }
        li { margin-bottom: 6px; }
        p { margin: 0 0 10px 0; }
        strong { color: #a89878; }
      `}</style>
    </div>
  );
}
