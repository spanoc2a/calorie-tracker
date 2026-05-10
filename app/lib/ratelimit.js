import { db } from '../api/db';

export async function rateLimit(key, maxRequests = 5, windowMs = 60_000) {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
  const current = await db.get(windowKey) || 0;
  if (current >= maxRequests) return false;
  await db.set(windowKey, current + 1);
  // TTL simulé : on ne peut pas faire expirer facilement avec le db abstrait
  // mais les clés changent chaque fenêtre donc s'accumulent peu
  return true;
}
