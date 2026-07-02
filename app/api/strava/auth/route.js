import crypto from 'crypto';
import { db } from '../../db';
import { getUserId } from '../../auth/session';

const BASE = 'https://app.nutrainer.io';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const nativeToken = searchParams.get('native_token');

  let userId;
  if (nativeToken) {
    const data = await db.get(`strava:native-token:${nativeToken}`);
    if (!data || Date.now() - data.createdAt > 10 * 60 * 1000) {
      return Response.redirect(`${BASE}/?strava=error`);
    }
    await db.del(`strava:native-token:${nativeToken}`);
    userId = data.userId;
  } else {
    userId = await getUserId(req);
    if (!userId) return Response.redirect(new URL('/login', req.url));
  }

  const source = nativeToken ? 'native' : 'web';
  const nonce = crypto.randomUUID();
  await db.set(`strava:nonce:${nonce}`, { userId, createdAt: Date.now(), source });

  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = 'https://app.nutrainer.io/api/strava/callback';
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=force&scope=activity:read_all&state=${nonce}`;
  return Response.redirect(url);
}
