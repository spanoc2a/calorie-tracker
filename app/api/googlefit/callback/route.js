import { db, userDb } from '../../db';

const BASE = 'https://app.nutrainer.io';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const nonce = searchParams.get('state');

  if (error || !code || !nonce) return Response.redirect(`${BASE}/?googlefit=error`);

  const nonceData = await db.get(`googlefit:nonce:${nonce}`);
  if (!nonceData || Date.now() - nonceData.createdAt > 10 * 60 * 1000) {
    return Response.redirect(`${BASE}/?googlefit=error`);
  }
  await db.del(`googlefit:nonce:${nonce}`);
  const userId = nonceData.userId;

  const redirectUri = 'https://app.nutrainer.io/api/googlefit/callback';
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_FIT_CLIENT_ID,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();
  if (!res.ok) return Response.redirect(`${BASE}/?googlefit=error`);

  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  await userDb(userId).set('googlefit:token', {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
  });

  return Response.redirect(`${BASE}/?googlefit=connected`);
}
