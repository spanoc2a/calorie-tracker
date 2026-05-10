import { db } from '../../db';
import { sessionCookie } from '../session';

export async function POST(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='))?.slice(8);
  if (token) await db.set(`session:${token}`, null);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', -1) } });
}
