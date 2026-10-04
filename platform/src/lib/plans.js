// Subscription plans and their limits. `null` means unlimited (kept JSON-safe for storage).

export const PLANS = {
  basic: {
    id: 'basic', name: 'Basic', priceUsd: 15, maxUsers: 1, maxConnections: 5, approvals: false,
    blurb: 'For a sole trader keeping one clean record.',
  },
  premium: {
    id: 'premium', name: 'Premium', priceUsd: 50, maxUsers: 5, maxConnections: 5, approvals: true,
    blurb: 'For small finance teams that need sign-off rules.',
  },
  institution: {
    id: 'institution', name: 'Institution', priceUsd: 100, maxUsers: null, maxConnections: null, approvals: true,
    blurb: 'Everything in Premium, with no limits on people or connections.',
  },
};

export const PLAN_ORDER = ['basic', 'premium', 'institution'];

export const planOf = (state) => PLANS[state.billing.planId] || PLANS.premium;

/** Users holding a seat: active, invited or suspended (removed users free their seat). */
export const seatCount = (users) => users.filter((u) => u.status !== 'removed').length;

export const limitLabel = (n) => (n == null ? 'Unlimited' : String(n));

export function canAddUser(state) {
  const max = planOf(state).maxUsers;
  return max == null || seatCount(state.users) < max;
}

export function canAddConnection(state) {
  const max = planOf(state).maxConnections;
  return max == null || state.connections.length < max;
}

/** Reasons the account cannot move to `planId` right now (empty array = allowed). */
export function planBlockers(state, planId) {
  const p = PLANS[planId];
  const out = [];
  const seats = seatCount(state.users);
  if (p.maxUsers != null && seats > p.maxUsers)
    out.push(`Remove ${seats - p.maxUsers} user${seats - p.maxUsers > 1 ? 's' : ''} first (${p.name} allows ${p.maxUsers}).`);
  if (p.maxConnections != null && state.connections.length > p.maxConnections) {
    const n = state.connections.length - p.maxConnections;
    out.push(`Disconnect ${n} connection${n > 1 ? 's' : ''} first (${p.name} allows ${p.maxConnections}).`);
  }
  return out;
}
