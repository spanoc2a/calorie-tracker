import { db } from '../../db';
import { getUserId } from '../session';

export async function POST(req) {
  const coachId = await getUserId(req);
  if (!coachId) return Response.json({ error: 'Non authentifié' }, { status: 401 });

  const { athleteId } = await req.json();
  const athleteIds = await db.get(`coach:${coachId}:athletes`) || [];
  if (!athleteIds.includes(athleteId)) return Response.json({ error: 'Patient non trouvé' }, { status: 403 });

  const users = await db.get('auth:users') || [];
  const athlete = users.find(u => u.id === athleteId);

  return Response.json({ ok: true, name: athlete?.name || 'Patient' }, {
    headers: { 'Set-Cookie': `viewAs=${athleteId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600` },
  });
}

export async function DELETE(req) {
  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': 'viewAs=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' },
  });
}
