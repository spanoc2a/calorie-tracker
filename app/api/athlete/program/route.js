import { userDb } from '../../db';
import { requireAuth } from '../../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const [programs, muscuPrograms] = await Promise.all([
    udb.get('coachPrograms').then(p => (p||[]).filter(x => x.status === 'sent')),
    udb.get('coachMuscuPrograms').then(p => (p||[]).filter(x => x.status === 'sent')),
  ]);
  return Response.json({ programs, muscuPrograms });
}
