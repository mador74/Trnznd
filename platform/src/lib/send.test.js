import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPayment, sourceBlockReason } from './send.js';
import { deriveStatus } from './policy.js';

const ethWallet = { id: 'w', name: 'Ops wallet', type: 'wallet', network: 'Ethereum', assets: ['USDC', 'USDT', 'ETH'], sendEnabled: true };
const ethDest = { label: 'Supplier', network: 'Ethereum', address: '0xabc' };
const ok = { conn: ethWallet, asset: 'USDC', amount: 100, available: 1000, dest: ethDest };

test('a valid stablecoin payment passes', () => {
  assert.equal(checkPayment(ok), null);
});

test('fiat accounts and switched-off connections cannot send', () => {
  assert.match(sourceBlockReason({ type: 'bank' }), /not available yet/);
  assert.match(sourceBlockReason({ ...ethWallet, sendEnabled: false }), /not switched on/);
});

test('blocks overspending, wrong networks and non-whitelisted destinations', () => {
  assert.match(checkPayment({ ...ok, amount: 5000 }), /available balance/);
  assert.match(checkPayment({ ...ok, dest: null }), /whitelisted/);
  assert.match(checkPayment({ ...ok, asset: 'BTC', conn: { ...ethWallet, assets: ['BTC'] } }), /cannot be sent to a Ethereum/);
  const tron = { ...ethWallet, network: 'Tron', assets: ['USDT'] };
  assert.match(checkPayment({ ...ok, conn: tron, asset: 'USDT' }), /is on Tron/);
});

test('sent and single-user payments keep their status', () => {
  const base = { type: 'withdrawal', approvals: [], rejections: [], usdValue: 10, connectionId: 'w', requestedBy: 'u' };
  assert.equal(deriveStatus({ ...base, status: 'broadcast' }, [], []), 'broadcast');
  assert.equal(deriveStatus({ ...base, status: 'pending', policyExempt: true }, [], []), 'approved');
});
