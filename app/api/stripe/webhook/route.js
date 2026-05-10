import { db } from '../../db';
import { sendSubscriptionEmail, sendCancellationEmail } from '../../../lib/email';

const PLAN_MAP = {
  'https://buy.stripe.com/eVqeV6f9M8251t73FY2Nq00': { plan: 'pro',           billing: 'monthly' },
  'https://buy.stripe.com/eVqbIU2n0eqt1t74K22Nq01': { plan: 'pro',           billing: 'annual'  },
  'https://buy.stripe.com/14A28k4v8fux3Bf5O62Nq02': { plan: 'coach_starter', billing: 'monthly' },
  'https://buy.stripe.com/dRmbIU7Hkbeh3Bf6Sa2Nq03': { plan: 'coach_starter', billing: 'annual'  },
  'https://buy.stripe.com/7sYbIU8Lo4PTefT7We2Nq04': { plan: 'coach_growth',  billing: 'monthly' },
  'https://buy.stripe.com/cNi4gsbXA0zD7Rv7We2Nq07': { plan: 'coach_growth',  billing: 'annual'  },
  'https://buy.stripe.com/bJe14g7Hk6Y19ZD90i2Nq06': { plan: 'coach_pro',     billing: 'monthly' },
  'https://buy.stripe.com/3cI4gs3r45TXefT0tM2Nq08': { plan: 'coach_pro',     billing: 'annual'  },
};

function planFromPaymentLink(url) {
  if (!url) return null;
  const clean = url.split('?')[0];
  return PLAN_MAP[clean] || null;
}

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();

  let event;
  try {
    if (secret) {
      const { createHmac } = await import('crypto');
      const parts = sig.split(',').reduce((acc, p) => { const [k,v]=p.split('='); acc[k]=v; return acc; }, {});
      const payload = `${parts.t}.${body}`;
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      if (expected !== parts.v1) return new Response('Bad signature', { status: 400 });
    }
    event = JSON.parse(body);
  } catch (e) {
    return new Response('Webhook error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email?.toLowerCase().trim();
    const paymentLink = session.payment_link;
    if (!email) return Response.json({ ok: true });

    const planInfo = planFromPaymentLink(paymentLink);
    if (!planInfo) return Response.json({ ok: true });

    const users = await db.get('auth:users') || [];
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return Response.json({ ok: true });

    const expiresAt = planInfo.billing === 'annual'
      ? Date.now() + 365 * 24 * 3600 * 1000
      : Date.now() + 31 * 24 * 3600 * 1000;

    users[idx] = {
      ...users[idx],
      plan: planInfo.plan,
      planBilling: planInfo.billing,
      planStart: Date.now(),
      planExpiresAt: expiresAt,
      stripeCustomerId: session.customer,
      stripeSessionId: session.id,
    };
    if (planInfo.plan.startsWith('coach')) users[idx].role = 'coach';
    await db.set('auth:users', users);
    sendSubscriptionEmail(users[idx].email, users[idx].name, planInfo.plan, planInfo.billing).catch(() => {});
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    // Ignorer la première facture (déjà gérée par checkout.session.completed)
    if (invoice.billing_reason === 'subscription_create') return Response.json({ ok: true });
    const customerId = invoice.customer;
    const periodEnd = invoice.lines?.data?.[0]?.period?.end;
    if (!customerId || !periodEnd) return Response.json({ ok: true });
    const users = await db.get('auth:users') || [];
    const idx = users.findIndex(u => u.stripeCustomerId === customerId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], planExpiresAt: periodEnd * 1000 };
      await db.set('auth:users', users);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const customerId = sub.customer;
    const users = await db.get('auth:users') || [];
    const idx = users.findIndex(u => u.stripeCustomerId === customerId);
    if (idx !== -1) {
      const u = users[idx];
      users[idx] = { ...u, plan: 'free', planBilling: null, planExpiresAt: null };
      await db.set('auth:users', users);
      sendCancellationEmail(u.email, u.name).catch(() => {});
    }
  }

  return Response.json({ ok: true });
}
