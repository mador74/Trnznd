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

// ── Billing terms ──────────────────────────────────────────────────────────
// Monthly, or annual paid in advance at 10× the monthly price (two months free).
// New card customers get a 14-day free trial with the card authorised up front. Cancelling
// inside the trial costs nothing; otherwise a 12-month agreement starts when the trial ends.

export const TRIAL_DAYS = 14;
export const COMMITMENT_MONTHS = 12;
export const ANNUAL_MULTIPLIER = 10;
const DAY = 86400000;

export const INTERVALS = {
  monthly: { id: 'monthly', label: 'Monthly', per: 'month' },
  annual: { id: 'annual', label: 'Annual, paid in advance', per: 'year' },
};

/** Price in USD for one billing period of `planId` on `interval`. */
export const priceFor = (planId, interval = 'monthly') =>
  (PLANS[planId]?.priceUsd || 0) * (interval === 'annual' ? ANNUAL_MULTIPLIER : 1);

/** What 12 months costs on each interval, and the saving from paying annually. */
export function yearCost(planId) {
  const monthly = priceFor(planId, 'monthly') * COMMITMENT_MONTHS;
  const annual = priceFor(planId, 'annual');
  return { monthly, annual, saving: monthly - annual };
}

const addDays = (iso, n) => new Date(+new Date(iso) + n * DAY).toISOString();
/** Calendar months, clamped to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso, n) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

/**
 * Where the subscription stands at `nowIso`.
 * phase: 'trial'      — inside the 14 days; cancel now and nothing is charged
 *        'cancelled'  — cancelled inside the trial; access runs to the trial end, no charge
 *        'ended'      — a cancelled trial whose 14 days are over
 *        'committed'  — the trial ended without cancellation; inside the 12-month agreement
 *        'term-complete' — the 12 months are over (renewal terms still to be decided)
 *        'active'     — no trial on record (e.g. paid by stablecoin from day one)
 */
export function subscriptionStatus(billing, nowIso) {
  const now = +new Date(nowIso);
  if (!billing.trialStart) {
    const start = billing.startedAt || null;
    const commitmentEnds = start ? addMonths(start, COMMITMENT_MONTHS) : null;
    return { phase: 'active', commitmentStart: start, commitmentEnds };
  }
  const trialEnds = addDays(billing.trialStart, TRIAL_DAYS);
  const msLeft = +new Date(trialEnds) - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / DAY));
  if (billing.cancelledAt && +new Date(billing.cancelledAt) < +new Date(trialEnds))
    return { phase: msLeft > 0 ? 'cancelled' : 'ended', trialEnds, daysLeft };
  if (msLeft > 0) return { phase: 'trial', trialEnds, daysLeft };
  const commitmentEnds = addMonths(trialEnds, COMMITMENT_MONTHS);
  return { phase: now < +new Date(commitmentEnds) ? 'committed' : 'term-complete', trialEnds, commitmentStart: trialEnds, commitmentEnds };
}

/** Cancelling is free only during the trial. */
export const canCancelFree = (billing, nowIso) => subscriptionStatus(billing, nowIso).phase === 'trial';

/** The next date a charge is due, or null when nothing more will be charged. */
export function nextCharge(billing, nowIso) {
  const s = subscriptionStatus(billing, nowIso);
  if (s.phase === 'trial') return s.trialEnds;
  if (s.phase !== 'committed' && s.phase !== 'active') return null;
  const start = s.commitmentStart || billing.startedAt;
  if (!start) return null;
  const step = billing.interval === 'annual' ? 12 : 1;
  let k = 0;
  let at = start;
  while (+new Date(at) <= +new Date(nowIso)) at = addMonths(start, (k += step));
  return at;
}

/** Why the billing interval cannot change to `to` right now (null = allowed). */
export function intervalBlocker(billing, to, nowIso) {
  if (to === (billing.interval || 'monthly')) return 'Already on this billing interval.';
  const s = subscriptionStatus(billing, nowIso);
  if (s.phase === 'cancelled' || s.phase === 'ended') return 'The trial has been cancelled.';
  if (s.phase === 'committed' || s.phase === 'active')
    return 'The billing interval is fixed for the 12-month agreement. You can change it at renewal.';
  return null;
}

/** Why the payment method cannot change to `type` right now (null = allowed). */
export function paymentMethodBlocker(billing, type, nowIso) {
  const phase = subscriptionStatus(billing, nowIso).phase;
  if (type !== 'card' && phase === 'trial')
    return 'The free trial needs an authorised card. You can switch to USDT or USDC once the trial has ended.';
  return null;
}
