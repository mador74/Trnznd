import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertBlockReason, convertTargets, pairKind, quote } from './convert.js';
import { governingPolicies } from './policy.js';
import { checkPayment } from './send.js';

const exchange = {
  name: 'Main exchange', type: 'exchange', assets: ['USD', 'USDC', 'BTC'], convertEnabled: true,
  convertKinds: ['fiat-stablecoin', 'crypto-stablecoin'],
};

test('pair kinds ignore direction', () => {
  assert.equal(pairKind('USD', 'USDC'), pairKind('USDC', 'USD'));
  assert.equal(pairKind('BTC', 'USDT'), 'crypto-stablecoin');
});

test('only pairs the provider allows can be converted', () => {
  assert.equal(convertBlockReason(exchange, 'USD', 'USDC'), null);
  assert.equal(convertBlockReason(exchange, 'USDC', 'BTC'), null);
  assert.match(convertBlockReason(exchange, 'USD', 'BTC'), /does not allow/);
  assert.match(convertBlockReason({ ...exchange, convertEnabled: false }, 'USD', 'USDC'), /not switched on/);
  assert.match(convertBlockReason({ type: 'wallet', name: 'W', assets: [] }, 'USDC', 'ETH'), /on-chain swap/);
  assert.match(convertBlockReason({ type: 'bank', name: 'B', assets: ['USD'] }, 'USD', 'USDC'), /open banking/);
});

test('targets list only allowed pairs among assets the provider supports', () => {
  const t = convertTargets(exchange, 'USDC');
  assert.ok(t.includes('USD') && t.includes('BTC') && !t.includes('EUR') && !t.includes('USDC'));
  assert.deepEqual(convertTargets(exchange, 'USD').filter((a) => a === 'BTC'), []);
});

test('quote deducts the fee from what you receive', () => {
  const q = quote('USDC', 'USDT', 1000);
  assert.equal(q.gross, 1000);
  assert.equal(q.receive, 999);
});

test('conversions need approval only when a policy covers them', () => {
  const r = { type: 'conversion', connectionId: 'x', usdValue: 50000, requestedBy: 'u' };
  assert.deepEqual(governingPolicies(r, [], []), []);
  const p = { id: 'p', enabled: true, actionTypes: ['conversion'], connectionIds: [], minUsd: 10000, approverIds: ['a'], required: 1 };
  assert.equal(governingPolicies(r, [p], []).length, 1);
});

test('fiat held at an exchange cannot be sent as a payment', () => {
  const conn = { ...exchange, sendEnabled: true };
  assert.match(checkPayment({ conn, asset: 'USD', amount: 1, available: 10, dest: { network: 'Ethereum' } }), /Fiat payments/);
});
