import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintQuote, onrampQuote, redeemQuote, redemptionAddressFor, validateMultisig } from './partners.js';
import { checkPayment } from './send.js';
import { convertBlockReason } from './convert.js';

const owners = (n) => Array.from({ length: n }, (_, i) => ({ label: 'o' + i, address: '0x' + i }));

test('multisig needs 2+ owners, a reachable threshold above 1, and distinct addresses', () => {
  assert.deepEqual(validateMultisig({ name: 'Ops', owners: owners(3), threshold: 2 }), []);
  assert.ok(validateMultisig({ name: 'Ops', owners: owners(3), threshold: 4 }).some((e) => /cannot exceed/.test(e)));
  assert.ok(validateMultisig({ name: 'Ops', owners: owners(3), threshold: 1 }).some((e) => /any single owner/.test(e)));
  assert.ok(validateMultisig({ name: 'Ops', owners: owners(1), threshold: 1 }).some((e) => /two owners/.test(e)));
  assert.ok(validateMultisig({ name: 'Ops', owners: [{ address: '0xA' }, { address: '0xa' }], threshold: 2 }).some((e) => /different address/.test(e)));
});

test('quotes deduct fees and convert currencies', () => {
  const q = onrampQuote('USD', 1000, 'USDC');
  assert.equal(q.fee, 10);
  assert.equal(q.receive, 990);
  assert.equal(mintQuote('USD', 5000).zend, 5000);
  assert.equal(redeemQuote(5000, 'USD').fiat, 5000);
});

test('multisig wallets follow self-custody rules', () => {
  const safe = { name: 'Treasury Safe', type: 'multisig', network: 'Ethereum', assets: ['USDC'], sendEnabled: true, convertKinds: [] };
  assert.equal(checkPayment({ conn: safe, asset: 'USDC', amount: 1, available: 5, dest: { network: 'Ethereum' } }), null);
  assert.match(checkPayment({ conn: safe, asset: 'USDC', amount: 1, available: 5, dest: { network: 'Base' } }), /is on Ethereum/);
  assert.match(convertBlockReason(safe, 'USDC', 'ETH'), /on-chain swap/);
});

test("redemption uses the TRNZND address on the wallet's own network", () => {
  const wl = [{ id: 'e', network: 'Ethereum' }, { id: 's', network: 'Solana' }, { id: 't', network: 'Tron' }, { id: 'x', network: 'Tron' }];
  const ids = ['e', 's', 't'];
  assert.equal(redemptionAddressFor({ network: 'Tron' }, wl, ids).id, 't');
  assert.equal(redemptionAddressFor({ network: 'Solana' }, wl, ids).id, 's');
  assert.equal(redemptionAddressFor({ network: 'Multi-chain' }, wl, ids).id, 'e');
});
