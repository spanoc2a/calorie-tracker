export const PLANS = {
  free:          { label: 'Free',          aiSuggestionsPerMonth: 5,  bloodTests: 0,  strava: false, reports: false, coachDashboard: false, maxAthletes: 0 },
  pro:           { label: 'Pro',           aiSuggestionsPerMonth: Infinity, bloodTests: Infinity, strava: true, reports: true, coachDashboard: false, maxAthletes: 0 },
  coach_starter: { label: 'Coach Starter', aiSuggestionsPerMonth: Infinity, bloodTests: Infinity, strava: true, reports: true, coachDashboard: true, maxAthletes: 5  },
  coach_growth:  { label: 'Coach Growth',  aiSuggestionsPerMonth: Infinity, bloodTests: Infinity, strava: true, reports: true, coachDashboard: true, maxAthletes: 15 },
  coach_pro:     { label: 'Coach Pro',     aiSuggestionsPerMonth: Infinity, bloodTests: Infinity, strava: true, reports: true, coachDashboard: true, maxAthletes: 30 },
};

export function getUserPlan(user) {
  if (!user) return 'free';
  const plan = user.plan || 'free';
  if (plan !== 'free' && user.planExpiresAt && Date.now() > user.planExpiresAt) return 'free';
  return plan;
}

export function canUseFeature(user, feature) {
  const plan = getUserPlan(user);
  return !!PLANS[plan]?.[feature];
}

export function getPlanLimits(user) {
  const plan = getUserPlan(user);
  return PLANS[plan] || PLANS.free;
}

export const STRIPE_LINKS = {
  pro:           { monthly: 'https://buy.stripe.com/eVqeV6f9M8251t73FY2Nq00', annual: 'https://buy.stripe.com/eVqbIU2n0eqt1t74K22Nq01' },
  coach_starter: { monthly: 'https://buy.stripe.com/14A28k4v8fux3Bf5O62Nq02', annual: 'https://buy.stripe.com/dRmbIU7Hkbeh3Bf6Sa2Nq03' },
  coach_growth:  { monthly: 'https://buy.stripe.com/7sYbIU8Lo4PTefT7We2Nq04', annual: 'https://buy.stripe.com/cNi4gsbXA0zD7Rv7We2Nq07' },
  coach_pro:     { monthly: 'https://buy.stripe.com/bJe14g7Hk6Y19ZD90i2Nq06', annual: 'https://buy.stripe.com/3cI4gs3r45TXefT0tM2Nq08' },
};
