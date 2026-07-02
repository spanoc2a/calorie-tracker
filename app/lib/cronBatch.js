import { after } from 'next/server';
import { db } from '../api/db';
import { listUsers } from '../api/users';

// Fan-out borné pour les crons (2026-07-02) : avant, chaque cron traitait TOUS les
// users dans une seule invocation serverless → timeout garanti à quelques centaines
// d'utilisateurs (surtout les crons qui font 1 appel IA par user).
// Ici : tri stable par id → tranche [cursor, cursor+batch) → auto-réinvocation
// APRÈS la réponse (after() de next/server) avec ?cursor=N&hop=H, en relayant le
// header Authorization (CRON_SECRET). Garde-fou : 200 hops max.
// `chunk` = parallélisme intra-lot (Promise.allSettled par sous-groupes).
export async function runBatchedCron(req, name, { batch = 50, chunk = 10, filter = null, handler }) {
  const url = new URL(req.url);
  const cursor = Math.max(0, parseInt(url.searchParams.get('cursor') || '0', 10) || 0);
  const hop = Math.max(0, parseInt(url.searchParams.get('hop') || '0', 10) || 0);

  let users = (await listUsers()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (filter) users = users.filter(filter);

  const slice = users.slice(cursor, cursor + batch);
  let processed = 0;
  for (let i = 0; i < slice.length; i += chunk) {
    const part = slice.slice(i, i + chunk);
    const results = await Promise.allSettled(part.map((u) => handler(u)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) processed++;
      if (r.status === 'rejected') console.error(`[CRON ${name}]`, r.reason);
    }
  }

  const nextCursor = cursor + batch < users.length ? cursor + batch : null;
  // Observabilité : où en est le run du jour.
  await db.set(`cronRun:${name}`, {
    at: new Date().toISOString(), cursor: nextCursor ?? 'done', hop, total: users.length, processed,
  }).catch(() => {});

  if (nextCursor != null && hop < 200) {
    const self = `${url.origin}${url.pathname}?cursor=${nextCursor}&hop=${hop + 1}`;
    const authz = req.headers.get('authorization');
    after(async () => {
      try {
        await fetch(self, { headers: { authorization: authz } });
      } catch (e) {
        console.error(`[CRON ${name}] enchaînement interrompu`, e);
      }
    });
  }

  return Response.json({ ok: true, name, cursor, processed, total: users.length, next: nextCursor, hop });
}
