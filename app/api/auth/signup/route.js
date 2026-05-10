import crypto from 'crypto';
import { db } from '../../db';
import { sessionCookie } from '../session';
import { rateLimit } from '../../../lib/ratelimit';
import { sendWelcomeEmail } from '../../../lib/email';

const ITERATIONS = 100_000;

function hashPassword(password, salt, iterations = ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await rateLimit(`signup:${ip}`, 5, 3_600_000);
  if (!allowed) return Response.json({ error: 'Trop de créations de comptes depuis cette IP' }, { status: 429 });

  const { email, password, name, role = 'athlete', cguAcceptedAt } = await req.json();
  if (!email || !password || !name) return Response.json({ error: 'Champs manquants' }, { status: 400 });
  if (!cguAcceptedAt) return Response.json({ error: 'Vous devez accepter les CGU pour créer un compte' }, { status: 400 });
  if (password.length < 6) return Response.json({ error: 'Mot de passe trop court (6 caractères minimum)' }, { status: 400 });
  if (name.length > 100) return Response.json({ error: 'Nom trop long' }, { status: 400 });

  const users = await db.get('auth:users') || [];
  if (users.find(u => u.email === email.toLowerCase())) {
    return Response.json({ error: 'Email déjà utilisé' }, { status: 409 });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const id = crypto.randomUUID();
  const user = { id, email: email.toLowerCase(), name, role, salt, passwordHash: hashPassword(password, salt), iterations: ITERATIONS, createdAt: Date.now(), cguAcceptedAt, trialEndsAt: Date.now() + 7 * 24 * 3600 * 1000 };
  await db.set('auth:users', [...users, user]);

  const token = crypto.randomUUID();
  await db.set(`session:${token}`, { userId: id, email: user.email, name, role, expiresAt: Date.now() + 10 * 365 * 24 * 3600 * 1000 });

  sendWelcomeEmail(user.email, name).catch(e => console.error('[WELCOME]', e));

  return Response.json({ user: { id, email: user.email, name, role } }, {
    headers: { 'Set-Cookie': sessionCookie(token) },
  });
}
