import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromUsd } from './fx.js';
import { money, moneyShort, setDisplayCurrency, usd } from './format.js';

test('converts USD into the display currency', () => {
  assert.equal(fromUsd(108, 'EUR'), 100);
  assert.ok(Math.abs(fromUsd(1, 'AED') - 3.6725) < 1e-9);
  assert.equal(fromUsd(50, 'XXX'), 50); // unknown code falls back to USD
});

test('money follows the display currency; usd never changes', () => {
  setDisplayCurrency('EUR');
  assert.equal(money(108), '€100.00');
  assert.equal(usd(108), '$108.00');
  setDisplayCurrency('JPY');
  assert.equal(money(67), '¥10,000');
  setDisplayCurrency('GBP');
  assert.equal(moneyShort(5000000), '£3.9M'); // 5M USD / 1.27
  setDisplayCurrency('USD');
  assert.equal(money(5), '$5.00');
});
