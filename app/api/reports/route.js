import { userDb } from '../db';
import { requireAuth } from '../auth/session';
import { checkReportAccess, isPro, isCoach } from '../../lib/planServer';

export async function GET(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const [reports, access] = await Promise.all([
    userDb(auth.userId).get('reportHistory'),
    checkReportAccess(auth.userId, 90),
  ]);
  let reportAccess = null;
  if (access.plan) {
    if (isCoach(access.plan))    reportAccess = { allowed: true, unlimited: true };
    else if (isPro(access.plan)) reportAccess = { allowed: access.allowed, count: access.count ?? 0, limit: 1 };
    else                         reportAccess = { allowed: false };
  }
  return Response.json({ reports: reports || [], ...(reportAccess ? { reportAccess } : {}) });
}

export async function POST(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { title, days, html, type, summary } = await req.json();
  const udb = userDb(auth.userId);
  const existing = await udb.get('reportHistory') || [];
  const entry = { id: Date.now(), title, days: days || null, date: new Date().toISOString().slice(0, 10), html, type: type || 'nutritionnel', summary: summary || null };
  await udb.set('reportHistory', [entry, ...existing].slice(0, 20));
  return Response.json({ ok: true, id: entry.id });
}

export async function DELETE(req) {
  const auth = await requireAuth(req); if (auth.error) return auth.error;
  const { id } = await req.json();
  const udb = userDb(auth.userId);
  const existing = await udb.get('reportHistory') || [];
  await udb.set('reportHistory', existing.filter(r => r.id !== id));
  return Response.json({ ok: true });
}
