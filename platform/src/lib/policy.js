// Approval policy engine (pure functions, no React) — unit tested in policy.test.js.
//
// A policy says: for these action types, on these connections, at or above this USD
// value, `required` of the listed `approverIds` must approve ("M of N").
// A request must satisfy EVERY matching policy. If none match, the fallback rule
// applies: one approval from any Owner/Admin other than the requester.

export const ACTION_TYPES = {
  withdrawal: 'Withdrawal / outgoing payment',
  internal_transfer: 'Transfer between own accounts',
  address_whitelist: 'Add whitelisted address',
};

export const FALLBACK_POLICY_ID = 'fallback';

export function validatePolicy(p) {
  const errors = [];
  if (!p.name || !p.name.trim()) errors.push('Name is required.');
  if (!p.actionTypes || p.actionTypes.length === 0) errors.push('Choose at least one action type.');
  if (!p.approverIds || p.approverIds.length === 0) errors.push('Choose at least one approver.');
  if (!Number.isInteger(p.required) || p.required < 1) errors.push('Required approvals must be at least 1.');
  else if (p.approverIds && p.required > p.approverIds.length)
    errors.push(`Required approvals (${p.required}) cannot exceed the number of approvers (${p.approverIds.length}).`);
  if (p.minUsd != null && (Number.isNaN(Number(p.minUsd)) || Number(p.minUsd) < 0))
    errors.push('Threshold must be zero or a positive amount.');
  return errors;
}

export function matchingPolicies(request, policies) {
  return policies.filter(
    (p) =>
      p.enabled !== false &&
      p.actionTypes.includes(request.type) &&
      (!p.connectionIds || p.connectionIds.length === 0 || p.connectionIds.includes(request.connectionId)) &&
      (request.usdValue ?? 0) >= (Number(p.minUsd) || 0),
  );
}

function fallbackPolicy(request, users) {
  const ids = users
    .filter((u) => (u.role === 'owner' || u.role === 'admin') && u.status === 'active' && u.id !== request.requestedBy)
    .map((u) => u.id);
  return {
    id: FALLBACK_POLICY_ID,
    name: 'Default rule: 1 Owner/Admin approval',
    approverIds: ids,
    required: 1,
    allowSelfApproval: false,
  };
}

/** The policies that govern this request (fallback if nothing matches). */
export function governingPolicies(request, policies, users) {
  const m = matchingPolicies(request, policies);
  return m.length ? m : [fallbackPolicy(request, users)];
}

function countsFor(policy, request) {
  return request.approvals.filter(
    (a) => policy.approverIds.includes(a.userId) && (policy.allowSelfApproval || a.userId !== request.requestedBy),
  ).length;
}

/** Per-policy progress, e.g. [{policy, have: 1, need: 2, satisfied: false}] */
export function progress(request, policies, users) {
  return governingPolicies(request, policies, users).map((policy) => {
    const have = countsFor(policy, request);
    return { policy, have, need: policy.required, satisfied: have >= policy.required };
  });
}

export function deriveStatus(request, policies, users) {
  if (['cancelled', 'executed', 'broadcast'].includes(request.status)) return request.status;
  if (request.rejections.length > 0) return 'rejected';
  // Single-user (Basic) payments have nobody else to approve; the sender authorises with 2FA when sending.
  if (request.policyExempt) return 'approved';
  return progress(request, policies, users).every((p) => p.satisfied) ? 'approved' : 'pending';
}

/** Returns null if `userId` may approve/reject now, otherwise the reason they can't. */
export function cannotSignReason(request, userId, policies, users) {
  const user = users.find((u) => u.id === userId);
  if (!user || user.status !== 'active') return 'User is not active.';
  if (deriveStatus(request, policies, users) !== 'pending') return 'Request is no longer pending.';
  if (request.approvals.some((a) => a.userId === userId) || request.rejections.some((r) => r.userId === userId))
    return 'You have already signed this request.';
  const open = progress(request, policies, users).filter((p) => !p.satisfied);
  const eligible = open.some(
    ({ policy }) => policy.approverIds.includes(userId) && (policy.allowSelfApproval || userId !== request.requestedBy),
  );
  if (!eligible)
    return userId === request.requestedBy
      ? 'Requesters cannot approve their own request.'
      : 'You are not an approver on any outstanding policy for this request.';
  return null;
}
