import crypto from 'crypto';
import { db } from '../../db';
import { getUserId } from '../../auth/session';

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return Response.redirect(new URL('/login', req.url));

  const nonce = crypto.randomUUID();
  await db.set(`strava:nonce:${nonce}`, { userId, createdAt: Date.now() });

  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = 'https://app.nutrainer.io/api/strava/callback';
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=force&scope=activity:read&state=${nonce}`;
  return Response.redirect(url);
}
