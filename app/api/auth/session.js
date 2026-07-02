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
    if (athleteIds.includes(viewAs)) return { userId: viewAs, isViewAs: true, coachId: session.userId, email: session.email };
  }

  return { userId: session.userId, email: session.email, name: session.name };
}

export function sessionCookie(token, maxAge = 90 * 24 * 3600) {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  const domain = isProd ? '; Domain=.nutrainer.io' : '';
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}${domain}`;
}
