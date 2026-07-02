import { db } from '../../db';
import { getUser } from '../../users';
import { requireAuth } from '../../auth/session';

// Tableau de bord télémétrie — réservé aux comptes owner (mêmes emails que planServer).
const OWNERS = ['pizzachezcyrilajaccio@gmail.com', 'spanocyril22@gmail.com'];

function parisDateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const me = await getUser(auth.userId);
  if (!me || !OWNERS.includes((me.email || '').toLowerCase())) {
    return Response.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const dates = Array.from({ length: 14 }, (_, i) => parisDateDaysAgo(i));
  const keys = dates.flatMap((d) => [`telemetry:stats:${d}`, `telemetry:dau:${d}`]);
  const kv = await db.getMany(keys);

  const days = dates.map((d) => {
    const stats = kv.get(`telemetry:stats:${d}`) || { events: {}, crashes: 0 };
    const dau = kv.get(`telemetry:dau:${d}`) || [];
    return { date: d, dau: dau.length, crashes: stats.crashes || 0, events: stats.events || {} };
  });

  const crashes = ((await db.get('telemetry:crashes')) || []).slice(0, 20);

  return Response.json({ days, crashes });
}
