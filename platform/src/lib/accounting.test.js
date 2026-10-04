import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../data/seed.js';
import { balances } from './ledger.js';
import { computeBooks, incomeStatement, trialBalance } from './accounting.js';
import { priceAt } from './prices.js';

const now = new Date('2026-10-04T12:00:00Z');
const s = buildSeed(now);
const books = computeBooks({ ...s, accounting: { ...s.accounting, policy: 'US-GAAP' } }, now.toISOString());

test('every journal entry balances', () => {
  for (const e of books.entries) {
    const dr = e.lines.reduce((x, l) => x + l.dr, 0);
    const cr = e.lines.reduce((x, l) => x + l.cr, 0);
    assert.ok(Math.abs(dr - cr) < 0.011, `${e.id}: ${dr} vs ${cr}`);
  }
});

test('trial balance: total debits equal total credits', () => {
  const tb = trialBalance(books);
  assert.ok(tb.balanced, `${tb.dr} vs ${tb.cr}`);
});

test('cash at bank in the GL equals the bank account balance', () => {
  assert.ok(Math.abs(books.balances[1000] - balances(s)['c-bank'].USD) < 0.02);
});

test('digital assets are carried at fair value after remeasurement', () => {
  const bal = balances(s);
  const fv = (kind) => Object.values(bal).reduce((t, b) => t + Object.entries(b).filter(([a]) => ({ BTC: 'crypto', ETH: 'crypto', SOL: 'crypto', USDT: 'stablecoin', USDC: 'stablecoin', ZEND: 'stablecoin' })[a] === kind).reduce((x, [a, q]) => x + q * priceAt(a, now.toISOString(), s.priceAnchor), 0), 0);
  assert.ok(Math.abs(books.balances[1200] + (books.balances[1205] || 0) - fv('crypto')) < 1);
  assert.ok(Math.abs(books.balances[1210] + (books.balances[1215] || 0) - fv('stablecoin')) < 1);
});

test('a crypto disposal records cost and a realised gain or loss', () => {
  const t = s.transactions.find((x) => x.asset === 'BTC' && x.type === 'withdrawal');
  const p = books.byTx[t.id];
  assert.ok(p.cost > 0);
  assert.ok(Math.abs(p.value - p.cost - p.gain) < 0.011);
});

test('prices equal today’s price from the anchor onwards and move before it', () => {
  assert.equal(priceAt('BTC', now.toISOString(), s.priceAnchor), 60000);
  assert.notEqual(priceAt('BTC', '2026-07-01T00:00:00Z', s.priceAnchor), 60000);
  assert.equal(priceAt('USDC', '2026-07-01T00:00:00Z', s.priceAnchor), 1);
});

for (const policy of ['IFRS-cost', 'IFRS-revaluation', 'US-GAAP']) {
  test(`${policy}: trial balance balances`, () => {
    const b = computeBooks({ ...s, accounting: { ...s.accounting, policy } }, now.toISOString());
    assert.ok(trialBalance(b).balanced);
  });
}

test('IFRS cost model carries each asset at the lower of cost and fair value', () => {
  const b = computeBooks({ ...s, accounting: { ...s.accounting, policy: 'IFRS-cost' } }, now.toISOString());
  for (const r of b.rollforward) assert.ok(Math.abs(r.carrying - Math.min(r.closeCost, r.fairValue)) < 0.02, r.asset);
  const carried = (b.balances[1200] || 0) + (b.balances[1206] || 0);
  const expected = b.rollforward.filter((r) => ['BTC', 'ETH', 'SOL'].includes(r.asset)).reduce((t, r) => t + r.carrying, 0);
  assert.ok(Math.abs(carried - expected) < 1);
  assert.equal(b.balances[3100] || 0, 0);
});

test('IFRS revaluation model: gains above cost go to OCI, not profit', () => {
  const b = computeBooks({ ...s, accounting: { ...s.accounting, policy: 'IFRS-revaluation' } }, now.toISOString());
  const gains = b.rollforward.reduce((t, r) => t + Math.max(0, r.fairValue - r.closeCost), 0);
  assert.ok(Math.abs(-(b.balances[3100] || 0) - gains) < 1);
  const pl = incomeStatement(b);
  assert.ok(Math.abs(pl.oci - gains) < 1);
});
