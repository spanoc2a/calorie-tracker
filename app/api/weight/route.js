import { userDb } from '../db';
import { requireAuth } from '../auth/session';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const log = await userDb(auth.userId).get('weightLog') || [];
  return Response.json({ log });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { date, value } = await req.json();
  if (!date || typeof value !== 'number') return Response.json({ error: 'Données invalides' }, { status: 400 });
  const log = await udb.get('weightLog') || [];
  const existing = log.findIndex(e => e.date === date);
  const entry = { id: existing >= 0 ? log[existing].id : Date.now(), date, value };
  if (existing >= 0) log[existing] = entry; else log.push(entry);
  log.sort((a, b) => a.date.localeCompare(b.date));
  await udb.set('weightLog', log.slice(-365));
  return Response.json({ entry });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const udb = userDb(auth.userId);
  const { id } = await req.json();
  const log = await udb.get('weightLog') || [];
  await udb.set('weightLog', log.filter(e => e.id !== id));
  return Response.json({ ok: true });
}
