import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../data/seed.js';
import { balances, connectionUsd, history, totalsByAsset } from './ledger.js';

const now = new Date('2026-10-04T12:00:00Z');
const s = buildSeed(now);

test('seed is deterministic', () => {
  assert.deepEqual(buildSeed(now).transactions.slice(0, 5), s.transactions.slice(0, 5));
});

test('no connection ends with a negative balance', () => {
  for (const [cid, bal] of Object.entries(balances(s))) {
    if (cid === 'c-card') continue; // a credit card balance is money owed, so negative is normal
    for (const [a, q] of Object.entries(bal)) assert.ok(q >= 0, `${cid} ${a} = ${q}`);
  }
});

test('aggregate equals the sum of individual connections', () => {
  const bal = balances(s);
  const perConn = s.connections.reduce((t, c) => t + connectionUsd(bal[c.id]), 0);
  const byAsset = totalsByAsset(s, bal).reduce((t, a) => t + a.usd, 0);
  assert.ok(Math.abs(perConn - byAsset) < 0.01);
  assert.ok(Math.abs(history(s, 30, null, now.getTime()).at(-1).usd - perConn) < 1);
});

test('internal transfers net to zero across connections', () => {
  for (const asset of ['BTC', 'USD']) {
    const net = s.transactions.filter((t) => t.internal && t.asset === asset).reduce((t, x) => t + x.amount, 0);
    assert.ok(Math.abs(net) < 1e-6, `${asset} ${net}`);
  }
});

test('the paid demo invoice is matched to a ledger receipt of the same amount', () => {
  const inv = s.invoices.find((i) => i.status === 'paid');
  const tx = s.transactions.find((t) => t.id === inv.paidTxId);
  assert.equal(tx.invoiceId, inv.id);
  assert.equal(tx.amount, inv.lines[0].unitPrice);
});
