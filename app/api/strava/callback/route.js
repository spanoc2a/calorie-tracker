import { db, userDb } from '../../db';

const BASE = 'https://app.nutrainer.io';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const nonce = searchParams.get('state');

  if (error || !code || !nonce) return Response.redirect(`${BASE}/?strava=error`);

  // Vérifier le nonce
  const nonceData = await db.get(`strava:nonce:${nonce}`);
  if (!nonceData || Date.now() - nonceData.createdAt > 10 * 60 * 1000) {
    return Response.redirect(`${BASE}/?strava=error`);
  }
  await db.del(`strava:nonce:${nonce}`);
  const userId = nonceData.userId;

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: parseInt(process.env.STRAVA_CLIENT_ID),
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.redirect(`${BASE}/?strava=error`);

  const tokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: {
      id: data.athlete?.id,
      name: `${data.athlete?.firstname || ''} ${data.athlete?.lastname || ''}`.trim(),
      avatar: data.athlete?.profile_medium,
    },
  };

  await userDb(userId).set('strava:token', tokenData);
  return Response.redirect(`${BASE}/?strava=connected`);
}
