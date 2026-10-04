import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveStatus, cannotSignReason, validatePolicy, governingPolicies, FALLBACK_POLICY_ID } from './policy.js';

const users = [
  { id: 'o', role: 'owner', status: 'active' },
  { id: 'a', role: 'admin', status: 'active' },
  { id: 'b', role: 'approver', status: 'active' },
  { id: 'c', role: 'approver', status: 'active' },
  { id: 'v', role: 'viewer', status: 'active' },
];
const twoOfThree = {
  id: 'p1', name: '2 of 3', enabled: true, actionTypes: ['withdrawal'], connectionIds: [],
  minUsd: 10000, approverIds: ['a', 'b', 'c'], required: 2, allowSelfApproval: false,
};
const req = (over = {}) => ({
  id: 'r', type: 'withdrawal', connectionId: 'x', usdValue: 50000, requestedBy: 'a',
  approvals: [], rejections: [], status: 'pending', ...over,
});

test('2-of-3 needs two distinct eligible approvals', () => {
  assert.equal(deriveStatus(req({ approvals: [{ userId: 'b' }] }), [twoOfThree], users), 'pending');
  assert.equal(deriveStatus(req({ approvals: [{ userId: 'b' }, { userId: 'c' }] }), [twoOfThree], users), 'approved');
});

test('requester approval does not count toward the quorum', () => {
  assert.equal(deriveStatus(req({ approvals: [{ userId: 'a' }, { userId: 'b' }] }), [twoOfThree], users), 'pending');
  assert.match(cannotSignReason(req(), 'a', [twoOfThree], users), /own request/);
});

test('non-approvers and double-signers are blocked', () => {
  assert.match(cannotSignReason(req(), 'v', [twoOfThree], users), /not an approver/);
  assert.match(cannotSignReason(req({ approvals: [{ userId: 'b' }] }), 'b', [twoOfThree], users), /already signed/);
  assert.equal(cannotSignReason(req(), 'b', [twoOfThree], users), null);
});

test('one rejection rejects', () => {
  assert.equal(deriveStatus(req({ rejections: [{ userId: 'b' }] }), [twoOfThree], users), 'rejected');
});

test('below threshold falls back to one Owner/Admin approval', () => {
  const small = req({ usdValue: 500 });
  const gov = governingPolicies(small, [twoOfThree], users);
  assert.equal(gov[0].id, FALLBACK_POLICY_ID);
  assert.equal(deriveStatus({ ...small, approvals: [{ userId: 'b' }] }, [twoOfThree], users), 'pending');
  assert.equal(deriveStatus({ ...small, approvals: [{ userId: 'o' }] }, [twoOfThree], users), 'approved');
});

test('all matching policies must be satisfied', () => {
  const ownerToo = { ...twoOfThree, id: 'p2', minUsd: 40000, approverIds: ['o'], required: 1 };
  const r = req({ approvals: [{ userId: 'b' }, { userId: 'c' }] });
  assert.equal(deriveStatus(r, [twoOfThree, ownerToo], users), 'pending');
  assert.equal(deriveStatus({ ...r, approvals: [...r.approvals, { userId: 'o' }] }, [twoOfThree, ownerToo], users), 'approved');
});

test('policy validation catches impossible quorums', () => {
  assert.ok(validatePolicy({ ...twoOfThree, required: 4 }).some((e) => /cannot exceed/.test(e)));
  assert.deepEqual(validatePolicy(twoOfThree), []);
});
