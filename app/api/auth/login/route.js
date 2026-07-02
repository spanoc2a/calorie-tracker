import crypto from 'crypto';
import { db } from '../../db';
import { sessionCookie } from '../session';
import { rateLimit } from '../../../lib/ratelimit';

const ITERATIONS = 100_000;

function hashPassword(password, salt, iterations = ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await rateLimit(`login:${ip}`, 10, 60_000);
  if (!allowed) return Response.json({ error: 'Trop de tentatives, réessaie dans une minute' }, { status: 429 });

  const { email, password } = await req.json();
  if (!email || !password) return Response.json({ error: 'Champs manquants' }, { status: 400 });

  const users = await db.get('auth:users') || [];
  const user = users.find(u => u.email === email.toLowerCase());
  const iterations = user?.iterations || 10_000;
  if (!user || hashPassword(password, user.salt, iterations) !== user.passwordHash) {
    return Response.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
  }

  // Migration transparente vers 100k itérations
  if (iterations < ITERATIONS) {
    const newHash = hashPassword(password, user.salt, ITERATIONS);
    const updated = users.map(u => u.id === user.id ? { ...u, passwordHash: newHash, iterations: ITERATIONS } : u);
    await db.set('auth:users', updated);
  }

  const token = crypto.randomUUID();
  await db.set(`session:${token}`, { userId: user.id, email: user.email, name: user.name, role: user.role, expiresAt: Date.now() + 90 * 24 * 3600 * 1000 });

  return Response.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token }, {
    headers: { 'Set-Cookie': sessionCookie(token) },
  });
}
