import { getUser, updateUser } from '../../users';

// Webhook RevenueCat — débloque la monétisation mobile (abonnements IAP).
// Auth : header Authorization === REVENUECAT_WEBHOOK_SECRET (fail-closed).
// Réplique la logique de mise à jour user du webhook Stripe.

// Events qui ACTIVENT / PROLONGENT l'abonnement.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
]);

// Events de fin d'abonnement.
const REVOKE_EVENTS = new Set([
  'EXPIRATION',
  'CANCELLATION',
]);

export async function POST(req) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const authHeader = req.headers.get('authorization');
  // Fail-closed : pas de secret configuré ou mismatch → 401.
  if (!secret || authHeader !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const event = payload?.event;
  if (!event || !event.type) return Response.json({ ok: true });

  const appUserId = event.app_user_id;
  if (!appUserId) return Response.json({ ok: true });

  const user = await getUser(appUserId);
  if (!user) {
    console.warn('[REVENUECAT] Aucun user pour app_user_id', appUserId);
    return Response.json({ ok: true });
  }

  const now = Date.now();

  if (GRANT_EVENTS.has(event.type)) {
    // 31 jours par défaut si RevenueCat ne fournit pas d'expiration (ex. non-renewing).
    const expiresAt = event.expiration_at_ms || (now + 31 * 24 * 3600 * 1000);
    await updateUser(user.id, {
      plan: 'pro',
      planStart: now,
      planExpiresAt: expiresAt,
      revenueCatUserId: appUserId,
    });
    return Response.json({ ok: true });
  }

  if (REVOKE_EVENTS.has(event.type)) {
    // Laisse expirer naturellement : on repasse 'free' uniquement si déjà expiré.
    const expiresAt = user.planExpiresAt;
    if (!expiresAt || now >= expiresAt) {
      await updateUser(user.id, { plan: 'free', planExpiresAt: null });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}
