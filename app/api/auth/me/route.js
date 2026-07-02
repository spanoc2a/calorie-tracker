import { db, userDb } from '../../db';

export async function GET(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='))?.slice(8);
  if (!token) return Response.json({ user: null }, { status: 401 });
  const session = await db.get(`session:${token}`);
  if (!session || Date.now() > session.expiresAt) return Response.json({ user: null }, { status: 401 });

  const viewAs = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('viewAs='))?.slice(7);
  if (viewAs) {
    const athleteIds = await db.get(`coach:${session.userId}:athletes`) || [];
    if (athleteIds.includes(viewAs)) {
      const users = await db.get('auth:users') || [];
      const athlete = users.find(u => u.id === viewAs);
      return Response.json({ user: { id: viewAs, email: athlete?.email, name: athlete?.name, role: 'athlete', isViewAs: true, coachId: session.userId } });
    }
  }

  const users = await db.get('auth:users') || [];
  const u = users.find(u => u.id === session.userId);

  const ownerPlan = { 'pizzachezcyrilajaccio@gmail.com': 'pro', 'spanocyril22@gmail.com': 'coach_pro' }[u?.email ?? session.email];
  const hasPaidPlan = u?.plan && u.plan !== 'free' && u?.planExpiresAt && Date.now() < u.planExpiresAt;
  const inTrial = !hasPaidPlan && u?.trialEndsAt && Date.now() < u.trialEndsAt;
  const coachId = await userDb(session.userId).get('coachId');
  const hasCoach = !!coachId;
  const activePlan = ownerPlan ?? (hasPaidPlan ? u.plan : hasCoach ? 'pro' : inTrial ? 'pro' : 'free');
  const trialDaysLeft = inTrial ? Math.ceil((u.trialEndsAt - Date.now()) / (24 * 3600 * 1000)) : 0;
  const trialExpired = !ownerPlan && !hasPaidPlan && !hasCoach && !inTrial;

  return Response.json({ user: {
    id: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    plan: u?.plan || 'free',
    activePlan,
    inTrial: !!inTrial,
    trialDaysLeft,
    trialExpired,
    hasSubscription: !!u?.stripeCustomerId,
  }});
}
