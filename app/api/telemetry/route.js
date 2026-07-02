import { db } from '../db';
import { rateLimit } from '../../lib/ratelimit';

// Télémétrie maison (2026-07-02) : crash reporting + compteurs d'événements,
// stockés en KV — pas de service externe. Auth OPTIONNELLE (un crash sur l'écran
// de login n'a pas de session) → route dans publicApi de proxy.js, rate-limitée.
// Clés : telemetry:crashes (liste, cap 200) ; telemetry:stats:<date> ({events:{nom:n}, crashes:n}) ;
// telemetry:dau:<date> (userIds, cap 5000). RMW non atomique accepté (télémétrie).

const EVENT_NAME = /^[a-z0-9_:-]{2,40}$/;

function parisDate() {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
}

async function optionalUserId(req) {
  try {
    const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)session=([^;]+)/);
    if (!m) return null;
    const session = await db.get(`session:${m[1]}`);
    if (!session || (session.expiresAt && Date.now() > session.expiresAt)) return null;
    return session.userId || null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await rateLimit(`telemetry:${ip}`, 120, 3_600_000))) {
    return Response.json({ ok: true }); // fail-silent : la télémétrie ne doit jamais gêner l'app
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: true }); }
  const userId = await optionalUserId(req);
  const date = parisDate();

  try {
    if (body.type === 'crash' && body.crash) {
      const c = body.crash;
      const entry = {
        at: new Date().toISOString(),
        userId,
        message: String(c.message || '').slice(0, 500),
        stack: String(c.stack || '').slice(0, 4000),
        screen: String(c.screen || '').slice(0, 60),
        fatal: !!c.fatal,
        version: String(c.version || '').slice(0, 20),
        platform: String(c.platform || '').slice(0, 20),
      };
      const crashes = (await db.get('telemetry:crashes')) || [];
      await db.set('telemetry:crashes', [entry, ...crashes].slice(0, 200));
      const stats = (await db.get(`telemetry:stats:${date}`)) || { events: {}, crashes: 0 };
      stats.crashes = (stats.crashes || 0) + 1;
      await db.set(`telemetry:stats:${date}`, stats);
    }

    if (body.type === 'events' && Array.isArray(body.events)) {
      const stats = (await db.get(`telemetry:stats:${date}`)) || { events: {}, crashes: 0 };
      for (const e of body.events.slice(0, 50)) {
        const name = String(e?.name || '');
        if (!EVENT_NAME.test(name)) continue;
        stats.events[name] = (stats.events[name] || 0) + 1;
      }
      await db.set(`telemetry:stats:${date}`, stats);
      if (userId) {
        const dau = (await db.get(`telemetry:dau:${date}`)) || [];
        if (!dau.includes(userId) && dau.length < 5000) {
          await db.set(`telemetry:dau:${date}`, [...dau, userId]);
        }
      }
    }
  } catch (e) {
    console.error('[TELEMETRY]', e.message);
  }

  return Response.json({ ok: true });
}
