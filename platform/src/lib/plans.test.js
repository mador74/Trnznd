import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAddConnection, canAddUser, planBlockers } from './plans.js';

const users = (n) => Array.from({ length: n }, (_, i) => ({ id: 'u' + i, status: 'active' }));
const conns = (n) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i }));
const st = (planId, u, c) => ({ billing: { planId }, users: users(u), connections: conns(c) });

test('basic allows one user and five connections', () => {
  assert.equal(canAddUser(st('basic', 1, 0)), false);
  assert.equal(canAddConnection(st('basic', 1, 4)), true);
  assert.equal(canAddConnection(st('basic', 1, 5)), false);
});

test('premium caps at five users in total and five connections', () => {
  assert.equal(canAddUser(st('premium', 4, 0)), true);
  assert.equal(canAddUser(st('premium', 5, 0)), false);
  assert.equal(canAddConnection(st('premium', 5, 5)), false);
});

test('institution is unlimited', () => {
  assert.equal(canAddUser(st('institution', 500, 500)), true);
  assert.equal(canAddConnection(st('institution', 500, 500)), true);
});

test('removed users free their seat', () => {
  const s = st('premium', 5, 0);
  s.users[4].status = 'removed';
  assert.equal(canAddUser(s), true);
});

test('downgrade is blocked until usage fits', () => {
  assert.deepEqual(planBlockers(st('premium', 5, 5), 'premium'), []);
  assert.equal(planBlockers(st('institution', 5, 7), 'premium').length, 1);
  assert.equal(planBlockers(st('institution', 5, 7), 'basic').length, 2);
});
