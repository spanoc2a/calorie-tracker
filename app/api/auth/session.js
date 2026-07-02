import { db } from '../db';

export async function getUserId(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='))?.slice(8);
  if (!token) return null;
  const session = await db.get(`session:${token}`);
  if (!session || Date.now() > session.expiresAt) return null;
  return session.userId;
}

export async function requireAuth(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='))?.slice(8);
  if (!token) return { error: Response.json({ error: 'Non authentifié' }, { status: 401 }) };
  const session = await db.get(`session:${token}`);
  if (!session || Date.now() > session.expiresAt) return { error: Response.json({ error: 'Non authentifié' }, { status: 401 }) };

  const viewAs = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('viewAs='))?.slice(7);
  if (viewAs) {
    const athleteIds = await db.get(`coach:${session.userId}:athletes`) || [];
    if (athleteIds.includes(viewAs)) {
      // Mode view-as (coach qui impersone un élève) = LECTURE SEULE : toute écriture est bloquée.
      // Exception : /api/blood-transfer, dont PUT/PATCH/DELETE sont le workflow légitime
      // du nutritionniste en view-as (analyse du bilan sanguin en attente).
      let pathname = '';
      try { pathname = new URL(req.url).pathname; } catch {}
      if (req.method && req.method !== 'GET' && pathname !== '/api/blood-transfer') {
        return { error: Response.json({ error: 'VIEW_AS_READONLY' }, { status: 403 }) };
      }
      return { userId: viewAs, isViewAs: true, coachId: session.userId, email: session.email };
    }
  }

  return { userId: session.userId, email: session.email, name: session.name };
}

export function sessionCookie(token, maxAge = 90 * 24 * 3600) {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  const domain = isProd ? '; Domain=.nutrainer.io' : '';
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}${domain}`;
}

// --- Index des sessions par utilisateur (sessions:<userId> = tableau de tokens) ---
// Permet de révoquer toutes les sessions (reset mot de passe, suppression de compte).
// Rétro-compat : les vieilles sessions créées avant l'index restent valides.

const SESSION_INDEX_CAP = 20;

export async function registerSession(userId, token) {
  const key = `sessions:${userId}`;
  const tokens = (await db.get(key) || []).filter(t => t !== token);
  tokens.push(token);
  // Cap : on supprime les sessions les plus anciennes au-delà de la limite.
  const evicted = tokens.length > SESSION_INDEX_CAP ? tokens.splice(0, tokens.length - SESSION_INDEX_CAP) : [];
  await Promise.all(evicted.map(t => db.del(`session:${t}`)));
  await db.set(key, tokens);
}

export async function unregisterSession(userId, token) {
  const key = `sessions:${userId}`;
  const tokens = await db.get(key) || [];
  await db.set(key, tokens.filter(t => t !== token));
}

export async function revokeAllSessions(userId) {
  const key = `sessions:${userId}`;
  const tokens = await db.get(key) || [];
  await Promise.all(tokens.map(t => db.del(`session:${t}`)));
  await db.del(key);
}
