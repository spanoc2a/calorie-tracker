import { db } from '../api/db';

// Fenêtre fixe avec clé STABLE par (action, id) : la valeur { count, resetAt } se réinitialise
// quand la fenêtre expire — plus de clés horodatées qui s'accumulent en base.
// Non atomique (lecture puis écriture) : un léger dépassement sous forte concurrence est accepté.
export async function rateLimit(key, maxRequests = 5, windowMs = 60_000) {
  const now = Date.now();
  const rlKey = `ratelimit:${key}`;
  const current = await db.get(rlKey);

  if (!current || typeof current.resetAt !== 'number' || now > current.resetAt) {
    await db.set(rlKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) return false;

  await db.set(rlKey, { count: current.count + 1, resetAt: current.resetAt });
  return true;
}
