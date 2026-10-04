import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceStatus, invoiceTotal, matchCandidates, validateInvoice } from './invoice.js';

const inv = (over = {}) => ({
  contactId: 'k1', payToConnectionId: 'c1', currency: 'USDC', issueDate: '2026-10-01', dueDate: '2026-10-31',
  taxRate: 10, lines: [{ desc: 'A', qty: 2, unitPrice: 100.005 }, { desc: 'B', qty: 1, unitPrice: 50 }], status: 'sent', ...over,
});

test('totals round each line to cents, then add tax', () => {
  assert.equal(invoiceTotal(inv()), 275.01); // 200.01 + 50 = 250.01, +10% = 25.00 → 275.01
});

test('sent invoices past due read as overdue', () => {
  assert.equal(invoiceStatus(inv(), '2026-11-01'), 'overdue');
  assert.equal(invoiceStatus(inv(), '2026-10-31'), 'sent');
  assert.equal(invoiceStatus(inv({ status: 'paid' }), '2027-01-01'), 'paid');
});

test('validation catches empty lines and reversed dates', () => {
  assert.deepEqual(validateInvoice(inv()), []);
  assert.ok(validateInvoice(inv({ lines: [{ desc: '', qty: 1, unitPrice: 5 }] })).length);
  assert.ok(validateInvoice(inv({ dueDate: '2026-09-01' })).some((e) => /due date/.test(e)));
});

test('match candidates are same account and asset, exact amount first', () => {
  const txs = [
    { id: 'a', connectionId: 'c1', asset: 'USDC', amount: 100, type: 'deposit', date: '2026-10-05' },
    { id: 'b', connectionId: 'c1', asset: 'USDC', amount: 275.01, type: 'deposit', date: '2026-10-04' },
    { id: 'c', connectionId: 'c2', asset: 'USDC', amount: 275.01, type: 'deposit', date: '2026-10-04' },
    { id: 'd', connectionId: 'c1', asset: 'USDT', amount: 275.01, type: 'deposit', date: '2026-10-04' },
    { id: 'e', connectionId: 'c1', asset: 'USDC', amount: 275.01, type: 'deposit', date: '2026-10-04', invoiceId: 'x' },
  ];
  const m = matchCandidates(inv(), txs);
  assert.deepEqual(m.map((t) => t.id), ['b', 'a']);
  assert.equal(m[0].exact, true);
});
