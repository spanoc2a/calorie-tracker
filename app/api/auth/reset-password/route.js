import crypto from 'crypto';
import { db } from '../../db';
import { getUserByEmail, getUser, updateUser } from '../../users';
import { revokeAllSessions } from '../session';
import { rateLimit } from '../../../lib/ratelimit';
import { sendResetEmail } from '../../../lib/email';
import { detectLang } from '../../../lib/lang';
import { errorText } from '../../../lib/pushTexts';

const ITERATIONS = 100_000;

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha256').toString('hex');
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await rateLimit(`reset-password:${ip}`, 3, 3_600_000);
  if (!allowed) return Response.json({ error: errorText(detectLang(req), 'err_too_many_resets') }, { status: 429 });

  const { email } = await req.json();
  if (!email) return Response.json({ error: 'Email requis' }, { status: 400 });

  const user = await getUserByEmail(email);

  if (!user) return Response.json({ ok: true });

  const token = crypto.randomUUID();
  await db.set(`reset:${token}`, { userId: user.id, email: user.email, expiresAt: Date.now() + 3600 * 1000 });

  try {
    await sendResetEmail(user.email, user.name, token);
  } catch (e) {
    console.error('[RESET]', e);
    return Response.json({ error: errorText(detectLang(req), 'err_email_send') }, { status: 500 });
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

  const account = await getUser(reset.userId);
  if (!account) return Response.json({ error: 'Compte introuvable' }, { status: 404 });

  const salt = crypto.randomBytes(16).toString('hex');
  await updateUser(reset.userId, { salt, passwordHash: hashPassword(password, salt), iterations: ITERATIONS });
  await db.del(`reset:${token}`);

  // Révoque toutes les sessions connues de l'utilisateur (mot de passe compromis ?).
  await revokeAllSessions(reset.userId);

  return Response.json({ ok: true });
}
