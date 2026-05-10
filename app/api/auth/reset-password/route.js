import crypto from 'crypto';
import { db } from '../../db';
import { sendResetEmail } from '../../../lib/email';

const ITERATIONS = 100_000;

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha256').toString('hex');
}

export async function POST(req) {
  const { email } = await req.json();
  if (!email) return Response.json({ error: 'Email requis' }, { status: 400 });

  const users = await db.get('auth:users') || [];
  const user = users.find(u => u.email === email.toLowerCase().trim());

  if (!user) return Response.json({ ok: true });

  const token = crypto.randomUUID();
  await db.set(`reset:${token}`, { userId: user.id, email: user.email, expiresAt: Date.now() + 3600 * 1000 });

  try {
    await sendResetEmail(user.email, user.name, token);
  } catch (e) {
    console.error('[RESET]', e);
    return Response.json({ error: 'Erreur lors de l\'envoi de l\'email. Réessaie dans quelques instants.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function PUT(req) {
  const { token, password } = await req.json();
  if (!token || !password || password.length < 6) {
    return Response.json({ error: 'Token ou mot de passe invalide' }, { status: 400 });
  }

  const reset = await db.get(`reset:${token}`);
  if (!reset || Date.now() > reset.expiresAt) {
    return Response.json({ error: 'Lien expiré ou invalide' }, { status: 400 });
  }

  const users = await db.get('auth:users') || [];
  const idx = users.findIndex(u => u.id === reset.userId);
  if (idx === -1) return Response.json({ error: 'Compte introuvable' }, { status: 404 });

  const salt = crypto.randomBytes(16).toString('hex');
  users[idx] = { ...users[idx], salt, passwordHash: hashPassword(password, salt), iterations: ITERATIONS };
  await db.set('auth:users', users);
  await db.del(`reset:${token}`);

  return Response.json({ ok: true });
}
