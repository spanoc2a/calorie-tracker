'use client';

export default function DeleteAccountPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#e8e0d0', fontFamily: "'DM Mono', monospace", padding: '40px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ fontSize: '0.65rem', color: '#5a5a4a', textDecoration: 'none', letterSpacing: 2, textTransform: 'uppercase' }}>← Retour</a>
      </div>

      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: '#f0e6c8', marginBottom: 8, fontWeight: 400 }}>Supprimer mon compte</h1>
      <p style={{ fontSize: '0.62rem', color: '#4a4a3a', marginBottom: 40, letterSpacing: 1 }}>Delete my account</p>

      <div style={{ background: '#1a1a14', border: '1px solid #2a2a1a', borderRadius: 12, padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: '0.75rem', color: '#c8b890', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Depuis l'application</h2>
        <p style={{ fontSize: '0.82rem', color: '#a09880', lineHeight: 1.7 }}>
          Vous pouvez supprimer votre compte directement depuis l'application Nutrainer :
        </p>
        <ol style={{ fontSize: '0.82rem', color: '#a09880', lineHeight: 2, paddingLeft: 20 }}>
          <li>Ouvrez l'application Nutrainer</li>
          <li>Allez dans l'onglet <strong style={{ color: '#e8e0d0' }}>Profil</strong></li>
          <li>Faites défiler jusqu'en bas</li>
          <li>Appuyez sur <strong style={{ color: '#e8e0d0' }}>Supprimer mon compte</strong></li>
          <li>Confirmez la suppression</li>
        </ol>
        <p style={{ fontSize: '0.75rem', color: '#6a6a5a', marginTop: 16 }}>
          Toutes vos données (journal alimentaire, programmes, bilans) seront définitivement supprimées.
        </p>
      </div>

      <div style={{ background: '#1a1a14', border: '1px solid #2a2a1a', borderRadius: 12, padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: '0.75rem', color: '#c8b890', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Par e-mail</h2>
        <p style={{ fontSize: '0.82rem', color: '#a09880', lineHeight: 1.7 }}>
          Si vous ne pouvez pas accéder à l'application, envoyez un e-mail à{' '}
          <a href="mailto:contact@nutrainer.app" style={{ color: '#c8b890' }}>contact@nutrainer.app</a>{' '}
          depuis l'adresse associée à votre compte en indiquant votre demande de suppression.
          Votre compte sera supprimé dans un délai de 30 jours.
        </p>
      </div>

      <div style={{ background: '#1a1a14', border: '1px solid #2a2a1a', borderRadius: 12, padding: 28 }}>
        <h2 style={{ fontSize: '0.75rem', color: '#c8b890', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>From the app (English)</h2>
        <ol style={{ fontSize: '0.82rem', color: '#a09880', lineHeight: 2, paddingLeft: 20 }}>
          <li>Open the Nutrainer app</li>
          <li>Go to the <strong style={{ color: '#e8e0d0' }}>Profile</strong> tab</li>
          <li>Scroll to the bottom</li>
          <li>Tap <strong style={{ color: '#e8e0d0' }}>Delete my account</strong></li>
          <li>Confirm the deletion</li>
        </ol>
        <p style={{ fontSize: '0.82rem', color: '#a09880', lineHeight: 1.7, marginTop: 16 }}>
          Or email us at <a href="mailto:contact@nutrainer.app" style={{ color: '#c8b890' }}>contact@nutrainer.app</a> from your registered address. Your account will be deleted within 30 days.
        </p>
      </div>
    </div>
  );
}
