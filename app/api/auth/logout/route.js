import { db } from '../../db';
import { sessionCookie, unregisterSession } from '../session';

export async function POST(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='))?.slice(8);
  if (token) {
    const session = await db.get(`session:${token}`);
    await db.del(`session:${token}`);
    if (session?.userId) await unregisterSession(session.userId, token);
  }
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', -1) } });
}
