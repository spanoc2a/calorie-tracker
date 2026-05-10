import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);

  // Fetch 60 jours en parallèle
  const dates = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (i + 1));
    return d.toISOString().slice(0, 10);
  });

  const results = await Promise.all(dates.map(date => udb.get(`day:${date}`).then(e => ({ date, hasEntries: (e || []).length > 0 }))));

  let streak = 0;
  for (const r of results) {
    if (r.hasEntries) streak++;
    else break;
  }

  return Response.json({ streak });
}
