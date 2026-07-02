import crypto from 'crypto';
import { db } from '../../db';
import { requireAuth } from '../../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const token = crypto.randomBytes(16).toString('hex');
  await db.set(`strava:native-token:${token}`, { userId: auth.userId, createdAt: Date.now() });

  return Response.json({ token });
}
