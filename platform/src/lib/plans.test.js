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

import { addMonths, canCancelFree, intervalBlocker, nextCharge, paymentMethodBlocker, priceFor, subscriptionStatus, yearCost } from './plans.js';

const T0 = '2026-01-31T10:00:00.000Z';
const at = (days) => new Date(+new Date(T0) + days * 86400000).toISOString();
const trial = (extra = {}) => ({ planId: 'premium', interval: 'monthly', trialStart: T0, ...extra });

test('annual is ten times monthly, paid in advance', () => {
  assert.equal(priceFor('basic', 'annual'), 150);
  assert.equal(priceFor('premium', 'annual'), 500);
  assert.equal(priceFor('institution', 'annual'), 1000);
  assert.equal(priceFor('premium', 'monthly'), 50);
  assert.deepEqual(yearCost('premium'), { monthly: 600, annual: 500, saving: 100 });
});

test('addMonths clamps to the end of shorter months', () => {
  assert.equal(addMonths('2026-01-31T00:00:00.000Z', 1), '2026-02-28T00:00:00.000Z');
  assert.equal(addMonths('2026-02-14T00:00:00.000Z', 12), '2027-02-14T00:00:00.000Z');
});

test('the trial lasts 14 days and can be cancelled free inside it', () => {
  const s = subscriptionStatus(trial(), at(3));
  assert.equal(s.phase, 'trial');
  assert.equal(s.daysLeft, 11);
  assert.equal(s.trialEnds, at(14));
  assert.equal(canCancelFree(trial(), at(13.9)), true);
  assert.equal(canCancelFree(trial(), at(14)), false);
});

test('cancelling inside the trial means no commitment and no charge', () => {
  const b = trial({ cancelledAt: at(5) });
  assert.equal(subscriptionStatus(b, at(6)).phase, 'cancelled');
  assert.equal(subscriptionStatus(b, at(20)).phase, 'ended');
  assert.equal(nextCharge(b, at(6)), null);
});

test('not cancelling starts a 12-month agreement from the trial end', () => {
  const s = subscriptionStatus(trial(), at(15));
  assert.equal(s.phase, 'committed');
  assert.equal(s.commitmentStart, at(14));
  assert.equal(s.commitmentEnds, addMonths(at(14), 12));
  assert.equal(subscriptionStatus(trial(), addMonths(at(14), 12)).phase, 'term-complete');
});

test('next charge: trial end, then monthly or yearly from there', () => {
  assert.equal(nextCharge(trial(), at(2)), at(14));
  assert.equal(nextCharge(trial(), at(20)), addMonths(at(14), 1));
  assert.equal(nextCharge(trial({ interval: 'annual' }), at(20)), addMonths(at(14), 12));
});

test('the interval can change during the trial, not during the agreement; the trial needs a card', () => {
  assert.equal(intervalBlocker(trial({ interval: 'annual' }), 'monthly', at(3)), null);
  assert.equal(intervalBlocker(trial(), 'annual', at(3)), null);
  assert.match(intervalBlocker(trial({ interval: 'annual' }), 'monthly', at(30)), /fixed for the 12-month agreement/);
  assert.match(intervalBlocker(trial(), 'annual', at(30)), /fixed/);
  assert.match(paymentMethodBlocker(trial(), 'stablecoin', at(3)), /authorised card/);
  assert.equal(paymentMethodBlocker(trial(), 'stablecoin', at(30)), null);
});
