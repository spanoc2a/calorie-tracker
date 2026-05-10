import { requireAuth } from '../../auth/session';
import { db } from '../../db';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const users = await db.get('auth:users') || [];
  const user = users.find(u => u.id === auth.userId);
  if (!user?.stripeCustomerId) return Response.json({ error: 'Aucun abonnement actif' }, { status: 404 });

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: user.stripeCustomerId,
      return_url: 'https://nutrainer.io',
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json({ error: data.error?.message || 'Erreur Stripe' }, { status: res.status });

  return Response.redirect(data.url);
}
