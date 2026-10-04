import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAddConnection, canAddFiatConnection, canAddUser, planBlockers } from './plans.js';

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

test('basic is crypto only: no bank or card connections', () => {
  const s = st('premium', 1, 2);
  assert.equal(canAddFiatConnection(st('basic', 1, 0)), false);
  assert.equal(canAddFiatConnection(s), true);
  assert.deepEqual(planBlockers(s, 'basic'), []);
  s.connections[1].type = 'card';
  assert.match(planBlockers(s, 'basic')[0], /1 bank or card connection first/);
});

import {
  addMonths, applyDueChanges, canCancelFree, chargesBetween, intervalBlocker, nextCharge, paymentMethodBlocker,
  planChangeTiming, priceFor, subscriptionStatus, upgradeFee, yearCost,
} from './plans.js';

const T0 = '2026-01-31T10:00:00.000Z';
const at = (days) => new Date(+new Date(T0) + days * 86400000).toISOString();
const END = at(14); // trial end = start of term 1
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
  assert.equal(s.trialEnds, END);
  assert.equal(canCancelFree(trial(), at(13.9)), true);
  assert.equal(canCancelFree(trial(), END), false);
});

test('cancelling inside the trial means no agreement and no charge', () => {
  const b = trial({ cancelledAt: at(5) });
  assert.equal(subscriptionStatus(b, at(6)).phase, 'cancelled');
  assert.equal(subscriptionStatus(b, at(20)).phase, 'ended');
  assert.equal(nextCharge(b, at(6)), null);
});

test('not cancelling starts a 12-month term that renews automatically', () => {
  const s = subscriptionStatus(trial(), at(15));
  assert.equal(s.phase, 'committed');
  assert.deepEqual(s.term, { number: 1, start: END, end: addMonths(END, 12) });
  assert.equal(s.renewsOn, addMonths(END, 12));
  const later = subscriptionStatus(trial(), addMonths(END, 12));
  assert.equal(later.phase, 'committed');
  assert.equal(later.term.number, 2);
  assert.equal(later.renewsOn, addMonths(END, 24));
});

test('cancelling after the trial takes effect on the next renewal date', () => {
  const b = trial({ cancelAt: addMonths(END, 12) });
  const s = subscriptionStatus(b, addMonths(END, 11));
  assert.equal(s.phase, 'committed');
  assert.equal(s.renewsOn, null);
  assert.equal(nextCharge(b, addMonths(END, 11)), null, 'no charge at the cancelled renewal');
  assert.equal(nextCharge(b, addMonths(END, 10)).at, addMonths(END, 11), 'monthly payments run to the end');
  assert.equal(subscriptionStatus(b, addMonths(END, 12)).phase, 'ended');
});

test('charges: trial end, then monthly for the term, or once a year in advance', () => {
  assert.equal(nextCharge(trial(), at(2)).at, END);
  assert.equal(nextCharge(trial(), at(20)).at, addMonths(END, 1));
  assert.equal(nextCharge(trial({ interval: 'annual' }), at(20)).at, addMonths(END, 12));
  assert.equal(chargesBetween(trial(), at(2), addMonths(END, 12)).length, 13, '12 monthly + first of the renewal');
  assert.equal(chargesBetween(trial({ interval: 'annual' }), at(2), addMonths(END, 12)).length, 2);
});

test('upgrades apply now with a pro-rata fee for the rest of the period', () => {
  // Annual premium, exactly half-way through the year: (1000 - 500) / 2.
  const b = trial({ interval: 'annual' });
  const half = new Date((+new Date(END) + +new Date(addMonths(END, 12))) / 2).toISOString();
  assert.equal(upgradeFee(b, 'institution', half), 250);
  assert.deepEqual(planChangeTiming(b, 'institution', half), { when: 'now', feeUsd: 250 });
  assert.deepEqual(planChangeTiming(trial(), 'institution', at(3)), { when: 'now', feeUsd: 0 }, 'free during the trial');
});

test('downgrades and interval changes wait for the renewal date', () => {
  const b = trial({ planId: 'institution' });
  assert.deepEqual(planChangeTiming(b, 'basic', at(30)), { when: 'renewal', at: addMonths(END, 12) });
  assert.deepEqual(planChangeTiming(b, 'basic', at(3)), { when: 'now', feeUsd: 0 }, 'immediate during the trial');
  const sched = { ...b, scheduledPlan: { planId: 'basic', at: addMonths(END, 12) }, scheduledInterval: { interval: 'annual', at: addMonths(END, 12) } };
  const first = nextCharge(sched, addMonths(END, 11));
  assert.deepEqual(first, { at: addMonths(END, 12), planId: 'basic', interval: 'annual', amountUsd: 150 });
  assert.equal(applyDueChanges(sched, addMonths(END, 6)).planId, 'institution');
  const rolled = applyDueChanges(sched, addMonths(END, 12));
  assert.equal(rolled.planId, 'basic');
  assert.equal(rolled.interval, 'annual');
  assert.equal(rolled.scheduledPlan, null);
});

test('interval can be set unless cancelled; the trial needs a card', () => {
  assert.equal(intervalBlocker(trial(), 'annual', at(3)), null);
  assert.equal(intervalBlocker(trial(), 'annual', at(30)), null);
  assert.match(intervalBlocker(trial({ cancelAt: addMonths(END, 12) }), 'annual', at(30)), /end at renewal/);
  assert.match(paymentMethodBlocker(trial(), 'stablecoin', at(3)), /authorised card/);
  assert.equal(paymentMethodBlocker(trial(), 'stablecoin', at(30)), null);
});
