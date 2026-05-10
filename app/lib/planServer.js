import { db, userDb } from '../api/db';

const LIMITS = {
  free:          { suggestions: 5,   bloodTests: 0,        programs: 1,  muscuPrograms: 1  },
  pro:           { suggestions: 20,  bloodTests: Infinity,  programs: 3,  muscuPrograms: 3  },
  coach_starter: { suggestions: 30,  bloodTests: Infinity,  programs: 5,  muscuPrograms: 5  },
  coach_growth:  { suggestions: 30,  bloodTests: Infinity,  programs: 5,  muscuPrograms: 5  },
  coach_pro:     { suggestions: 30,  bloodTests: Infinity,  programs: 5,  muscuPrograms: 5  },
};

export async function getUserWithPlan(userId) {
  const users = await db.get('auth:users') || [];
  const user = users.find(u => u.id === userId);
  if (!user) return null;

  const ownerPlan = { 'pizzachezcyrilajaccio@gmail.com': 'pro', 'spanocyril22@gmail.com': 'coach_pro' }[user.email];
  const hasPaidPlan = user.plan && user.plan !== 'free' && user.planExpiresAt && Date.now() < user.planExpiresAt;
  const inTrial = !hasPaidPlan && user.trialEndsAt && Date.now() < user.trialEndsAt;
  const coachId = await userDb(userId).get('coachId');
  const hasCoach = !!coachId;
  const activePlan = ownerPlan ?? (hasPaidPlan ? user.plan : hasCoach ? 'pro' : inTrial ? 'pro' : 'free');

  return { ...user, activePlan, inTrial: !!inTrial, hasCoach };
}

export function isPro(plan) {
  return plan && plan !== 'free';
}

export function isCoach(plan) {
  return plan && plan.startsWith('coach');
}

export async function checkSuggestionsLimit(userId) {
  const user = await getUserWithPlan(userId);
  if (!user) return { allowed: false };
  const plan = user.activePlan || 'free';
  const limit = LIMITS[plan]?.suggestions ?? 5;
  if (limit === Infinity) return { allowed: true, plan };

  const monthKey = `usage:suggestions:${new Date().toISOString().slice(0,7)}`;
  const udb = userDb(userId);
  const count = await udb.get(monthKey) || 0;
  if (count >= limit) return { allowed: false, plan, count, limit };
  return { allowed: true, plan, count, limit };
}

export async function incrementSuggestions(userId) {
  const monthKey = `usage:suggestions:${new Date().toISOString().slice(0,7)}`;
  const udb = userDb(userId);
  const count = await udb.get(monthKey) || 0;
  await udb.set(monthKey, count + 1);
}

export async function checkBloodTestLimit(userId) {
  const user = await getUserWithPlan(userId);
  if (!user) return { allowed: false };
  const plan = user.activePlan || 'free';
  const limit = LIMITS[plan]?.bloodTests ?? 1;
  if (limit === Infinity) return { allowed: true, plan };

  const udb = userDb(userId);
  const existing = await udb.get('bloodTests') || [];
  if (existing.length >= limit) return { allowed: false, plan, count: existing.length, limit };
  return { allowed: true, plan };
}

export async function checkReportAccess(userId, reportDays = 90) {
  const user = await getUserWithPlan(userId);
  if (!user) return { allowed: false };
  if (!isPro(user.activePlan)) return { allowed: false, plan: user.activePlan };
  if (isCoach(user.activePlan)) return { allowed: true, plan: user.activePlan };

  // Limites Pro par type de rapport
  const udb = userDb(userId);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Calcul semaine ISO
  const startOfYear = new Date(year, 0, 1);
  const week = String(Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)).padStart(2, '0');

  if (reportDays === 7) {
    const key = `reportUsage:7d:${year}-W${week}`;
    const count = await udb.get(key) || 0;
    if (count >= 1) return { allowed: false, plan: user.activePlan, reason: 'limit', limitLabel: '1 rapport 7j par semaine' };
    return { allowed: true, plan: user.activePlan, usageKey: key, count };
  }
  if (reportDays === 30) {
    const key = `reportUsage:30d:${year}-${month}`;
    const count = await udb.get(key) || 0;
    if (count >= 2) return { allowed: false, plan: user.activePlan, reason: 'limit', limitLabel: '2 rapports 30j par mois' };
    return { allowed: true, plan: user.activePlan, usageKey: key, count };
  }
  // 90 jours ou santé
  const key = `reportUsage:90d:${year}-${month}`;
  const count = await udb.get(key) || 0;
  if (count >= 1) return { allowed: false, plan: user.activePlan, reason: 'limit', limitLabel: '1 rapport 90j par mois' };
  return { allowed: true, plan: user.activePlan, usageKey: key, count };
}

export async function incrementReportUsage(userId, usageKey) {
  if (!usageKey) return;
  const udb = userDb(userId);
  const count = await udb.get(usageKey) || 0;
  await udb.set(usageKey, count + 1);
}

export async function checkProgramLimit(userId) {
  const user = await getUserWithPlan(userId);
  if (!user) return { allowed: false };
  if (!isPro(user.activePlan)) return { allowed: false };
  const limit = LIMITS[user.activePlan]?.programs ?? 3;
  if (limit === Infinity) return { allowed: true };
  const monthKey = `usage:program:${new Date().toISOString().slice(0,7)}`;
  const count = await userDb(userId).get(monthKey) || 0;
  if (count >= limit) return { allowed: false, count, limit, limitLabel: `${limit} programmes/mois` };
  return { allowed: true, usageKey: monthKey, count, limit };
}

export async function incrementProgramUsage(userId, key) {
  if (!key) return;
  const count = await userDb(userId).get(key) || 0;
  await userDb(userId).set(key, count + 1);
}

export async function checkMuscuProgramLimit(userId) {
  const user = await getUserWithPlan(userId);
  if (!user) return { allowed: false };
  if (!isPro(user.activePlan)) return { allowed: false };
  const limit = LIMITS[user.activePlan]?.muscuPrograms ?? 3;
  if (limit === Infinity) return { allowed: true };
  const monthKey = `usage:muscuprogram:${new Date().toISOString().slice(0,7)}`;
  const count = await userDb(userId).get(monthKey) || 0;
  if (count >= limit) return { allowed: false, count, limit, limitLabel: `${limit} programmes/mois` };
  return { allowed: true, usageKey: monthKey, count, limit };
}

export async function checkStravaAccess(userId) {
  const user = await getUserWithPlan(userId);
  if (!user) return { allowed: false };
  return { allowed: isPro(user.activePlan), plan: user.activePlan };
}

export function upgradeResponse(feature) {
  return Response.json({ error: 'UPGRADE_REQUIRED', feature }, { status: 402 });
}
