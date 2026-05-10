import crypto from 'crypto';
import { db } from '../../db';
import { getUserId } from '../../auth/session';

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return Response.redirect(new URL('/login', req.url));

  const nonce = crypto.randomUUID();
  await db.set(`googlefit:nonce:${nonce}`, { userId, createdAt: Date.now() });

  const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
  const redirectUri = 'https://app.nutrainer.io/api/googlefit/callback';
  const scope = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
  ].join(' ');

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${nonce}`;
  return Response.redirect(url);
}
