// Subscription plans and their limits. `null` means unlimited (kept JSON-safe for storage).

export const PLANS = {
  basic: {
    id: 'basic', name: 'Basic', priceUsd: 15, maxUsers: 1, maxConnections: 5, approvals: false, openBanking: false,
    blurb: 'For a sole trader keeping one clean record of their crypto.',
  },
  premium: {
    id: 'premium', name: 'Premium', priceUsd: 50, maxUsers: 5, maxConnections: 5, approvals: true, openBanking: true,
    blurb: 'For small finance teams that need sign-off rules.',
  },
  institution: {
    id: 'institution', name: 'Institution', priceUsd: 100, maxUsers: null, maxConnections: null, approvals: true, openBanking: true,
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

/** Bank accounts and cards (open banking) connected to the account. */
export const fiatConnections = (connections) => connections.filter((c) => c.type === 'bank' || c.type === 'card');

/** Basic is crypto only: bank and card connections need Premium or Institution. */
export const canAddFiatConnection = (state) => !!planOf(state).openBanking;

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
  const fiat = fiatConnections(state.connections).length;
  if (!p.openBanking && fiat)
    out.push(`Disconnect ${fiat} bank or card connection${fiat > 1 ? 's' : ''} first (${p.name} is crypto only).`);
  if (p.maxConnections != null && state.connections.length > p.maxConnections) {
    const n = state.connections.length - p.maxConnections;
    out.push(`Disconnect ${n} connection${n > 1 ? 's' : ''} first (${p.name} allows ${p.maxConnections}).`);
  }
  return out;
}

// ── Billing terms ──────────────────────────────────────────────────────────
// Monthly, or annual paid in advance at 10× the monthly price (two months free).
// New card customers get a 14-day free trial with the card authorised up front. Cancelling inside
// the trial costs nothing; otherwise a 12-month agreement starts when the trial ends. Agreements
// renew automatically for another 12 months unless cancelled before the renewal date; a
// cancellation takes effect on that date. Upgrades apply at once for a pro-rata fee; downgrades
// and billing-interval changes take effect on the renewal date.

export const TRIAL_DAYS = 14;
export const COMMITMENT_MONTHS = 12;
export const ANNUAL_MULTIPLIER = 10;
const DAY = 86400000;
const ms = (iso) => +new Date(iso);

export const INTERVALS = {
  annual: { id: 'annual', label: 'Annual, paid in advance', per: 'year' },
  monthly: { id: 'monthly', label: 'Monthly', per: 'month' },
};
/** New subscriptions start on annual billing; monthly is available on request. */
export const DEFAULT_INTERVAL = 'annual';

/** Price in USD for one billing period of `planId` on `interval`. */
export const priceFor = (planId, interval = 'monthly') =>
  (PLANS[planId]?.priceUsd || 0) * (interval === 'annual' ? ANNUAL_MULTIPLIER : 1);

/** What 12 months costs on each interval, and the saving from paying annually. */
export function yearCost(planId) {
  const monthly = priceFor(planId, 'monthly') * COMMITMENT_MONTHS;
  const annual = priceFor(planId, 'annual');
  return { monthly, annual, saving: monthly - annual };
}

export const addDays = (iso, n) => new Date(ms(iso) + n * DAY).toISOString();
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

const trialEndOf = (b) => (b.trialStart ? addDays(b.trialStart, TRIAL_DAYS) : null);
/** Day the first 12-month term starts: the trial end, or the start date when there was no trial. */
const anchorOf = (b) => trialEndOf(b) || b.startedAt || null;
const trialCancelled = (b) => !!(b.trialStart && b.cancelledAt && ms(b.cancelledAt) < ms(trialEndOf(b)));

/** Plan and interval in force at `iso`, taking scheduled renewal changes into account. */
export const planAt = (b, iso) => (b.scheduledPlan && ms(iso) >= ms(b.scheduledPlan.at) ? b.scheduledPlan.planId : b.planId);
export const intervalAt = (b, iso) =>
  b.scheduledInterval && ms(iso) >= ms(b.scheduledInterval.at) ? b.scheduledInterval.interval : b.interval || DEFAULT_INTERVAL;

/** The 12-month term containing `iso` (term 1 starts at the anchor). */
export function termAt(b, iso) {
  const anchor = anchorOf(b);
  if (!anchor || ms(iso) < ms(anchor)) return null;
  let k = 0;
  while (ms(addMonths(anchor, COMMITMENT_MONTHS * (k + 1))) <= ms(iso)) k++;
  return { number: k + 1, start: addMonths(anchor, COMMITMENT_MONTHS * k), end: addMonths(anchor, COMMITMENT_MONTHS * (k + 1)) };
}

/** The billing period (one month, or the whole term if annual) containing `iso`. */
export function periodAt(b, iso) {
  const term = termAt(b, iso);
  if (!term) return null;
  if (intervalAt(b, term.start) === 'annual') return { start: term.start, end: term.end };
  const anchor = anchorOf(b);
  const base = COMMITMENT_MONTHS * (term.number - 1);
  let m = 0;
  while (ms(addMonths(anchor, base + m + 1)) <= ms(iso)) m++;
  return { start: addMonths(anchor, base + m), end: addMonths(anchor, base + m + 1) };
}

/**
 * Where the subscription stands at `nowIso`.
 * phase: 'trial'      — inside the 14 days; cancel now and nothing is charged
 *        'cancelled'  — cancelled inside the trial; access runs to the trial end, no charge
 *        'committed'  — inside a 12-month term (renews automatically unless `cancelAt` is set)
 *        'ended'      — a cancelled trial or agreement whose end date has passed
 */
export function subscriptionStatus(b, nowIso) {
  const trialEnds = trialEndOf(b);
  if (trialEnds && ms(nowIso) < ms(trialEnds)) {
    const daysLeft = Math.max(0, Math.ceil((ms(trialEnds) - ms(nowIso)) / DAY));
    return { phase: trialCancelled(b) ? 'cancelled' : 'trial', trialEnds, daysLeft };
  }
  if (trialCancelled(b)) return { phase: 'ended', trialEnds, endedAt: trialEnds };
  if (b.cancelAt && ms(nowIso) >= ms(b.cancelAt)) return { phase: 'ended', trialEnds, endedAt: b.cancelAt };
  const term = termAt(b, nowIso);
  if (!term) return { phase: 'ended', trialEnds, endedAt: null };
  return { phase: 'committed', trialEnds, term, renewsOn: b.cancelAt ? null : term.end, cancelAt: b.cancelAt || null };
}

/** Cancelling is free only during the trial. */
export const canCancelFree = (b, nowIso) => subscriptionStatus(b, nowIso).phase === 'trial';

/** The first charge due strictly after `iso`: { at, planId, interval, amountUsd }, or null. */
export function nextCharge(b, iso) {
  const anchor = anchorOf(b);
  if (!anchor || trialCancelled(b)) return null;
  const due = (at) => {
    if (b.cancelAt && ms(at) >= ms(b.cancelAt)) return null;
    const planId = planAt(b, at);
    const interval = intervalAt(b, at);
    return { at, planId, interval, amountUsd: priceFor(planId, interval) };
  };
  if (ms(iso) < ms(anchor)) return due(anchor);
  const term = termAt(b, iso);
  for (let k = term.number - 1; k <= term.number; k++) {
    const start = addMonths(anchor, COMMITMENT_MONTHS * k);
    const step = intervalAt(b, start) === 'annual' ? COMMITMENT_MONTHS : 1;
    for (let m = 0; m < COMMITMENT_MONTHS; m += step) {
      const at = addMonths(anchor, COMMITMENT_MONTHS * k + m);
      if (ms(at) > ms(iso)) return due(at);
    }
  }
  return null;
}

/** Every charge due after `fromIso` up to and including `toIso` (used when the demo clock jumps). */
export function chargesBetween(b, fromIso, toIso) {
  const out = [];
  let c = nextCharge(b, fromIso);
  while (c && ms(c.at) <= ms(toIso) && out.length < 100) {
    out.push(c);
    c = nextCharge(b, c.at);
  }
  return out;
}

/** Folds in scheduled changes whose date has passed, so `planId`/`interval` are current. */
export function applyDueChanges(b, nowIso) {
  let next = b;
  if (b.scheduledPlan && ms(nowIso) >= ms(b.scheduledPlan.at)) next = { ...next, planId: b.scheduledPlan.planId, scheduledPlan: null };
  if (b.scheduledInterval && ms(nowIso) >= ms(b.scheduledInterval.at)) next = { ...next, interval: b.scheduledInterval.interval, scheduledInterval: null };
  return next;
}

/** Pro-rata fee in USD for upgrading now: the price difference for the rest of the current billing period. */
export function upgradeFee(b, toPlanId, nowIso) {
  if (subscriptionStatus(b, nowIso).phase !== 'committed') return 0;
  const p = periodAt(b, nowIso);
  const interval = intervalAt(b, nowIso);
  const diff = priceFor(toPlanId, interval) - priceFor(b.planId, interval);
  if (diff <= 0) return 0;
  const left = (ms(p.end) - ms(nowIso)) / (ms(p.end) - ms(p.start));
  return Math.round(diff * left * 100) / 100;
}

export const isUpgrade = (fromId, toId) => PLANS[toId].priceUsd > PLANS[fromId].priceUsd;

/**
 * How a plan change from the current plan to `toPlanId` would happen now:
 * { when: 'now', feeUsd } or { when: 'renewal', at } (downgrades after the trial).
 */
export function planChangeTiming(b, toPlanId, nowIso) {
  const s = subscriptionStatus(b, nowIso);
  if (s.phase === 'trial') return { when: 'now', feeUsd: 0 };
  if (isUpgrade(b.planId, toPlanId)) return { when: 'now', feeUsd: upgradeFee(b, toPlanId, nowIso) };
  return { when: 'renewal', at: s.term?.end || null };
}

/** Why the billing interval cannot change to `to` right now (null = allowed; after the trial it applies at renewal). */
export function intervalBlocker(b, to, nowIso) {
  if (to === (b.interval || DEFAULT_INTERVAL) && !b.scheduledInterval) return 'Already on this billing interval.';
  const s = subscriptionStatus(b, nowIso);
  if (s.phase === 'cancelled' || s.phase === 'ended') return 'The subscription has been cancelled.';
  if (s.phase === 'committed' && b.cancelAt) return 'The agreement is set to end at renewal.';
  return null;
}

/** Why the payment method cannot change to `type` right now (null = allowed). */
export function paymentMethodBlocker(b, type, nowIso) {
  if (type !== 'card' && subscriptionStatus(b, nowIso).phase === 'trial')
    return 'The free trial needs an authorised card. You can switch to USDT or USDC once the trial has ended.';
  return null;
}

/** "Now" for billing. The demo can move this clock forward to show the trial ending and renewals. */
export const billingNow = (b) => new Date(Date.now() + (b.clockOffsetMs || 0)).toISOString();
