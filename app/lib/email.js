const FROM_NOREPLY = 'Nutrainer <no-reply@nutrainer.io>';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nutrainer.io';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.nutrainer.io';

async function send({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] ${to} — ${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_NOREPLY, to, subject, html }),
  });
  if (!res.ok) console.error('[EMAIL] Resend error:', await res.text());
}

function layout(content) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nutrainer</title></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
      <!-- HEADER -->
      <tr><td style="background:#0d0d0d;padding:28px 40px;text-align:center">
        <span style="font-family:Georgia,serif;font-size:22px;color:#f0e6c8;letter-spacing:2px;font-weight:700">Nutrainer</span>
      </td></tr>
      <!-- BODY -->
      <tr><td style="padding:40px 40px 32px">${content}</td></tr>
      <!-- FOOTER -->
      <tr><td style="background:#f9f8f5;border-top:1px solid #ebe9e0;padding:20px 40px;text-align:center">
        <p style="margin:0 0 6px;font-size:11px;color:#999;line-height:1.6">Nutrainer · <a href="${BASE_URL}" style="color:#a89050;text-decoration:none">nutrainer.io</a> · <a href="mailto:support@nutrainer.io" style="color:#a89050;text-decoration:none">support@nutrainer.io</a></p>
        <p style="margin:0;font-size:11px;color:#bbb">Si tu n'es pas à l'origine de cette action, ignore cet email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export async function sendWelcomeEmail(to, name) {
  const safeName = esc(name);
  const html = layout(`
    <p style="margin:0 0 8px;font-size:13px;color:#a89050;letter-spacing:1px;text-transform:uppercase">Bienvenue</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;color:#1a1a14;font-weight:700;line-height:1.2">Bonjour ${safeName} 👋</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7">Ton compte Nutrainer est prêt. Tu peux dès maintenant :</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      ${['🩸 Scanner ton bilan sanguin pour un suivi biologique','🍽️ Suivre ta nutrition quotidienne avec des suggestions IA','📊 Générer des rapports personnalisés','🚴 Connecter Strava pour adapter tes macros à tes séances'].map(item =>
        `<tr><td style="padding:7px 0;font-size:14px;color:#333;line-height:1.5">
          <span style="color:#a89050;margin-right:6px">✓</span>${item}
        </td></tr>`
      ).join('')}
    </table>
    <a href="${APP_URL}" style="display:inline-block;background:#0d0d0d;color:#f0e6c8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px">Accéder à mon espace →</a>
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.6">Une question ? Écris-nous à <a href="mailto:support@nutrainer.io" style="color:#a89050">support@nutrainer.io</a></p>
  `);
  await send({ to, subject: `Bienvenue sur Nutrainer, ${safeName} !`, html });
}

export async function sendSubscriptionEmail(to, name, plan, billing) {
  const LABELS = { pro:'Pro', coach_starter:'Coach Starter', coach_growth:'Coach Growth', coach_pro:'Coach Pro' };
  const PRICES = {
    pro:           { monthly:'9,99€/mois',  annual:'95,90€/an (7,99€/mois)'   },
    coach_starter: { monthly:'29,99€/mois', annual:'287,90€/an (23,99€/mois)' },
    coach_growth:  { monthly:'59,99€/mois', annual:'575,90€/an (47,99€/mois)' },
    coach_pro:     { monthly:'99,99€/mois', annual:'959,90€/an (79,99€/mois)' },
  };
  const safeName = esc(name);
  const label = LABELS[plan] || esc(plan);
  const price = PRICES[plan]?.[billing] || '';
  const html = layout(`
    <p style="margin:0 0 8px;font-size:13px;color:#a89050;letter-spacing:1px;text-transform:uppercase">Abonnement activé</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;color:#1a1a14;font-weight:700;line-height:1.2">Bienvenue dans Nutrainer ${label} 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7">Bonjour ${safeName},<br>Ton abonnement <strong>${label}</strong> est actif — <strong>${price}</strong>. Tu as désormais accès à toutes les fonctionnalités :</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
      ${['🩸 Analyses sanguines illimitées','🤖 Suggestions IA illimitées','📊 Rapports personnalisés','🚴 Synchronisation Strava'].map(item =>
        `<tr><td style="padding:7px 0;font-size:14px;color:#333;line-height:1.5"><span style="color:#a89050;margin-right:6px">✓</span>${item}</td></tr>`
      ).join('')}
    </table>
    <a href="${APP_URL}" style="display:inline-block;background:#0d0d0d;color:#f0e6c8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px">Accéder à mon espace →</a>
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.6">Pour gérer ton abonnement : <a href="${BASE_URL}" style="color:#a89050">Profil → Gérer mon abonnement</a><br>Une question ? <a href="mailto:support@nutrainer.io" style="color:#a89050">support@nutrainer.io</a></p>
  `);
  await send({ to, subject: `Ton abonnement Nutrainer ${label} est actif`, html });
}

export async function sendCancellationEmail(to, name) {
  const safeName = esc(name);
  const html = layout(`
    <p style="margin:0 0 8px;font-size:13px;color:#a89050;letter-spacing:1px;text-transform:uppercase">Abonnement résilié</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;color:#1a1a14;font-weight:700;line-height:1.2">Ton abonnement a été résilié</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7">Bonjour ${safeName},<br>Nous avons bien pris en compte la résiliation de ton abonnement Nutrainer. Ton accès restera actif jusqu'à la fin de la période en cours.</p>
    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7">Après cette date, ton compte passera automatiquement en formule gratuite. Tes données sont conservées et tu peux te réabonner à tout moment.</p>
    <a href="${BASE_URL}/landing#tarifs" style="display:inline-block;background:#0d0d0d;color:#f0e6c8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px">Voir les formules →</a>
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.6">Tu penses que c'est une erreur ? Écris-nous à <a href="mailto:support@nutrainer.io" style="color:#a89050">support@nutrainer.io</a></p>
  `);
  await send({ to, subject: 'Confirmation de résiliation — Nutrainer', html });
}

export async function sendTrialEndingEmail(to, name, daysLeft) {
  const safeName = esc(name);
  const html = layout(`
    <p style="margin:0 0 8px;font-size:13px;color:#a89050;letter-spacing:1px;text-transform:uppercase">Essai gratuit</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;color:#1a1a14;font-weight:700;line-height:1.2">Ton essai se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7">Bonjour ${safeName},<br>Ton accès Pro gratuit expire bientôt. Pour continuer à profiter de toutes les fonctionnalités :</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
      ${['🩸 Analyses sanguines illimitées','🤖 Suggestions IA illimitées','📊 Rapports personnalisés','🚴 Synchronisation Strava'].map(item =>
        `<tr><td style="padding:7px 0;font-size:14px;color:#333;line-height:1.5"><span style="color:#a89050;margin-right:6px">✓</span>${item}</td></tr>`
      ).join('')}
    </table>
    <a href="${BASE_URL}/landing#tarifs" style="display:inline-block;background:#0d0d0d;color:#f0e6c8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px">Choisir mon abonnement →</a>
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.6">À partir de 9,99€/mois · Sans engagement · Annulable à tout moment</p>
  `);
  await send({ to, subject: `Plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai gratuit sur Nutrainer`, html });
}

export async function sendCoachRemovalEmail(to, name, coachName) {
  const safeName = esc(name);
  const safeCoach = esc(coachName);
  const html = layout(`
    <p style="margin:0 0 8px;font-size:13px;color:#a89050;letter-spacing:1px;text-transform:uppercase">Suivi coach</p>
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:26px;color:#1a1a14;font-weight:700;line-height:1.2">Tu as été retiré du suivi de ${safeCoach}</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7">Bonjour ${safeName},<br>Ton coach <strong>${safeCoach}</strong> a mis fin à ton suivi. Ton compte et toutes tes données sont conservés — tu peux continuer à utiliser Nutrainer de façon autonome.</p>
    <p style="margin:0 0 10px;font-size:15px;color:#1a1a14;font-weight:600">Continue à progresser avec Nutrainer Pro</p>
    <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.7">Pour continuer à accéder à toutes les fonctionnalités :</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">
      ${['🩸 Analyses sanguines illimitées','🤖 Suggestions IA illimitées','📊 Rapports personnalisés','🚴 Synchronisation Strava'].map(item =>
        `<tr><td style="padding:7px 0;font-size:14px;color:#333;line-height:1.5"><span style="color:#a89050;margin-right:6px">✓</span>${item}</td></tr>`
      ).join('')}
    </table>
    <a href="https://buy.stripe.com/eVqeV6f9M8251t73FY2Nq00" style="display:inline-block;background:#0d0d0d;color:#f0e6c8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px">Passer à Pro — 9,99€/mois →</a>
    <p style="margin:20px 0 0;font-size:13px;color:#888;line-height:1.6">Sans engagement · Annulable à tout moment · Ou continue gratuitement avec les fonctionnalités de base.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#888">Une question ? <a href="mailto:support@nutrainer.io" style="color:#a89050">support@nutrainer.io</a></p>
  `);
  await send({ to, subject: `Fin de ton suivi avec ${safeCoach} — Nutrainer`, html });
}

export async function sendResetEmail(to, name, token) {
  const safeName = esc(name);
  const resetUrl = `${APP_URL}/login?reset=${encodeURIComponent(token)}`;
  const html = layout(`
    <p style="margin:0 0 8px;font-size:13px;color:#a89050;letter-spacing:1px;text-transform:uppercase">Mot de passe</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#1a1a14;font-weight:700;line-height:1.2">Réinitialise ton mot de passe</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7">Bonjour ${safeName},<br>Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous — ce lien est valable <strong>1 heure</strong>.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#0d0d0d;color:#f0e6c8;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.5px">Réinitialiser mon mot de passe →</a>
    <p style="margin:24px 0 0;font-size:12px;color:#aaa;line-height:1.6">Lien direct si le bouton ne fonctionne pas :<br><a href="${resetUrl}" style="color:#a89050;word-break:break-all">${resetUrl}</a></p>
    <p style="margin:20px 0 0;font-size:13px;color:#888">Tu n'as pas demandé de réinitialisation ? Ignore cet email, ton mot de passe reste inchangé.</p>
  `);
  await send({ to, subject: 'Réinitialisation de ton mot de passe Nutrainer', html });
}
