import { db } from '../../db';

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

  const users = await db.get('auth:users') || [];
  const idx = users.findIndex(u => u.id === appUserId);
  if (idx === -1) {
    console.warn('[REVENUECAT] Aucun user pour app_user_id', appUserId);
    return Response.json({ ok: true });
  }

  const now = Date.now();

  if (GRANT_EVENTS.has(event.type)) {
    // 31 jours par défaut si RevenueCat ne fournit pas d'expiration (ex. non-renewing).
    const expiresAt = event.expiration_at_ms || (now + 31 * 24 * 3600 * 1000);
    users[idx] = {
      ...users[idx],
      plan: 'pro',
      planStart: now,
      planExpiresAt: expiresAt,
      revenueCatUserId: appUserId,
    };
    await db.set('auth:users', users);
    return Response.json({ ok: true });
  }

  if (REVOKE_EVENTS.has(event.type)) {
    // Laisse expirer naturellement : on repasse 'free' uniquement si déjà expiré.
    const expiresAt = users[idx].planExpiresAt;
    if (!expiresAt || now >= expiresAt) {
      users[idx] = { ...users[idx], plan: 'free', planExpiresAt: null };
      await db.set('auth:users', users);
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}
