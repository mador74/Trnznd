// General ledger built from the transaction feed, designed to support IFRS (default, for the target
// markets in Latin America, Africa and South-East Asia) or US GAAP, chosen in Accounting settings.
//
// What it implements:
//  - Double-entry: every ledger transaction becomes a balanced journal entry (debits = credits).
//  - Measurement at the transaction date: each entry is valued at that day's fair value, in USD (reporting currency).
//  - Cost basis: FIFO lots per asset across the whole entity. A disposal (payment, fee, conversion out)
//    removes lots at cost, and the difference to fair value is a realised gain or loss.
//  - Fair-value remeasurement at the reporting date for digital assets (crypto in scope of ASC 350-60 as
//    amended by ASU 2023-08), with the change in unrealised gain/loss shown in net income.
//  - Accrual for invoices: issuing an invoice books a receivable and revenue; the matched receipt clears it.
// What it does not decide: which assets are in scope of ASU 2023-08 (stablecoin classification is a policy
// decision for the business and its auditor), presentation and disclosures, and tax. Those need an accountant.

import { ASSETS } from '../data/seed.js';
import { priceAt } from './prices.js';
import { invoiceTotal } from './invoice.js';

export const ACCOUNTS = {
  1000: { name: 'Cash at bank', type: 'asset' },
  1010: { name: 'Cash held at exchanges & custodians', type: 'asset' },
  1100: { name: 'Accounts receivable', type: 'asset' },
  1200: { name: 'Digital assets: crypto (cost)', type: 'asset' },
  1205: { name: 'Digital assets: crypto fair-value / revaluation adjustment', type: 'asset' },
  1206: { name: 'Digital assets: accumulated impairment', type: 'asset' },
  1210: { name: 'Digital assets: stablecoins (cost)', type: 'asset' },
  1215: { name: 'Digital assets: stablecoins fair-value / revaluation adjustment', type: 'asset' },
  1216: { name: 'Digital assets: stablecoins accumulated impairment', type: 'asset' },
  1900: { name: 'Transfers in transit (clearing)', type: 'asset' },
  1910: { name: 'Conversion clearing', type: 'asset' },
  2000: { name: 'Credit card payable', type: 'liability' },
  2900: { name: 'Suspense: uncategorised', type: 'liability' },
  3000: { name: 'Opening balance equity', type: 'equity' },
  3100: { name: 'Revaluation surplus (other comprehensive income)', type: 'equity' },
  4000: { name: 'Sales revenue', type: 'income' },
  4100: { name: 'Other income', type: 'income' },
  4900: { name: 'Realised gain/(loss) on digital assets', type: 'income' },
  4910: { name: 'Unrealised gain/(loss) on digital assets', type: 'income' },
  4920: { name: 'Impairment of digital assets', type: 'expense' },
  5000: { name: 'Purchases & supplier costs', type: 'expense' },
  5100: { name: 'Payroll', type: 'expense' },
  5200: { name: 'Software & services', type: 'expense' },
  5300: { name: 'Travel', type: 'expense' },
  5400: { name: 'General card spend', type: 'expense' },
  5500: { name: 'Exchange & provider fees', type: 'expense' },
  5510: { name: 'Network fees', type: 'expense' },
};

const CATEGORY_ACCOUNT = {
  'Customer receipt': 4000, 'Supplier payment': 5000, Payroll: 5100, 'Software & services': 5200, Travel: 5300,
  'Card spend': 5400, 'Exchange fee': 5500, 'Network fee': 5510, 'Other income': 4100,
  'Treasury rebalance': 1900, 'Internal transfer': 1900, 'Card repayment': 1900, Conversion: 1910, Uncategorised: 2900,
};

const round = (n) => Math.round(n * 100) / 100;
const isFiat = (a) => ASSETS[a]?.kind === 'fiat';
const tracked = (a) => !!ASSETS[a] && !isFiat(a); // assets carried in cost lots

/** GL account holding `asset` in `conn` (unknown connections are treated as third-party holders). */
export function assetAccount(asset, conn) {
  if (isFiat(asset)) return conn?.type === 'bank' ? 1000 : conn?.type === 'card' ? 2000 : 1010;
  return ASSETS[asset]?.kind === 'crypto' ? 1200 : 1210;
}

export function counterAccount(tx) {
  if (tx.category === 'Customer receipt' && tx.invoiceId) return 1100;
  return CATEGORY_ACCOUNT[tx.category] ?? 2900;
}

/**
 * Builds the books. Returns journal entries, account balances, per-transaction postings,
 * a digital-asset rollforward and readiness warnings. All amounts in USD.
 */
export function computeBooks(state, asOf = new Date().toISOString()) {
  const anchor = state.priceAnchor;
  const connById = Object.fromEntries(state.connections.map((c) => [c.id, c]));
  const lots = {}; // asset -> [{ qty, unit }]
  const roll = {}; // asset -> rollforward figures
  const r0 = (a) => (roll[a] ||= { asset: a, openQty: 0, openValue: 0, inQty: 0, inValue: 0, outQty: 0, outCost: 0, realised: 0 });
  const entries = [];
  const byTx = {};

  const addLot = (asset, qty, value) => {
    (lots[asset] ||= []).push({ qty, unit: qty ? value / qty : 0 });
  };
  const takeLots = (asset, qty) => {
    let left = qty;
    let cost = 0;
    const q = lots[asset] || [];
    while (left > 1e-12 && q.length) {
      const lot = q[0];
      const take = Math.min(lot.qty, left);
      cost += take * lot.unit;
      lot.qty -= take;
      left -= take;
      if (lot.qty <= 1e-12) q.shift();
    }
    // Disposing of more than the lots hold (data gap): value the shortfall at today's price and flag it.
    return { cost, shortfall: left > 1e-9 ? left : 0 };
  };

  // Opening balances, valued on the opening date.
  const openDate = state.openingDate || state.priceAnchor;
  const openLines = [];
  for (const [cid, bal] of Object.entries(state.opening || {})) {
    for (const [asset, qty] of Object.entries(bal)) {
      if (!qty || !ASSETS[asset]) continue;
      const v = round(qty * priceAt(asset, openDate, anchor));
      const acct = assetAccount(asset, connById[cid]);
      openLines.push(v >= 0 ? { acct, dr: v, cr: 0 } : { acct, dr: 0, cr: -v });
      openLines.push(v >= 0 ? { acct: 3000, dr: 0, cr: v } : { acct: 3000, dr: -v, cr: 0 });
      if (tracked(asset) && qty > 0) {
        addLot(asset, qty, v);
        Object.assign(r0(asset), { openQty: r0(asset).openQty + qty, openValue: r0(asset).openValue + v });
      }
    }
  }
  entries.push({ id: 'opening', date: openDate, source: 'Opening balances', memo: 'Opening balances at fair value', lines: openLines });

  // Invoices issued (accrual): Dr receivable, Cr revenue.
  for (const inv of state.invoices || []) {
    if (!['sent', 'paid'].includes(inv.status)) continue;
    const v = round(invoiceTotal(inv) * priceAt(inv.currency, inv.issueDate, anchor));
    entries.push({ id: 'inv-' + inv.id, date: inv.issueDate + 'T00:00:00.000Z', source: 'Invoice', memo: `${inv.number} issued`,
      lines: [{ acct: 1100, dr: v, cr: 0 }, { acct: 4000, dr: 0, cr: v }] });
  }

  // Ledger transactions, oldest first.
  const txs = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const warnings = [];
  for (const t of txs) {
    if (!ASSETS[t.asset]) continue;
    const conn = connById[t.connectionId];
    const acct = assetAccount(t.asset, conn);
    const counter = counterAccount(t);
    const value = round(Math.abs(t.amount) * priceAt(t.asset, t.date, anchor));
    let lines;
    let gain = 0;
    let cost = null;
    if (t.amount >= 0) {
      lines = [{ acct, dr: value, cr: 0 }, { acct: counter, dr: 0, cr: value }];
      if (tracked(t.asset) && !t.internal) {
        addLot(t.asset, t.amount, value);
        const r = r0(t.asset); r.inQty += t.amount; r.inValue += value;
      }
    } else if (tracked(t.asset) && !t.internal) {
      // Disposal: derecognise at FIFO cost, recognise the difference to fair value as realised gain/loss.
      const took = takeLots(t.asset, -t.amount);
      if (took.shortfall) warnings.push(`${t.asset}: disposal on ${t.date.slice(0, 10)} exceeds recorded lots by ${took.shortfall.toFixed(6)}.`);
      cost = round(took.cost + took.shortfall * priceAt(t.asset, t.date, anchor));
      gain = round(value - cost);
      lines = [{ acct: counter, dr: value, cr: 0 }, { acct, dr: 0, cr: cost }];
      if (gain) lines.push(gain > 0 ? { acct: 4900, dr: 0, cr: gain } : { acct: 4900, dr: -gain, cr: 0 });
      const r = r0(t.asset); r.outQty += -t.amount; r.outCost += cost; r.realised += gain;
    } else {
      lines = [{ acct: counter, dr: value, cr: 0 }, { acct, dr: 0, cr: value }];
    }
    const entry = { id: 'tx-' + t.id, txId: t.id, date: t.date, source: 'Transaction', memo: `${t.counterparty} · ${t.amount} ${t.asset}`, lines };
    entries.push(entry);
    byTx[t.id] = { entry, value, cost, gain };
  }

  // Measurement at the reporting date, per the chosen framework:
  //  - US GAAP (ASU 2023-08): carrying amount = fair value; changes go to net income.
  //  - IFRS, IAS 38 cost model: carrying amount = cost less impairment (per asset, the lower of cost and
  //    fair value at this date); impairment goes to profit or loss.
  //  - IFRS, IAS 38 revaluation model: carrying amount = fair value; increases above cost go to
  //    revaluation surplus in OCI, decreases below cost go to profit or loss.
  const policy = measurementPolicy(state);
  const holdings = {};
  for (const [a, q] of Object.entries(lots)) holdings[a] = q.reduce((s, l) => s + l.qty, 0);
  const sumBy = (acct) => entries.reduce((s, e) => s + e.lines.filter((l) => l.acct === acct).reduce((x, l) => x + l.dr - l.cr, 0), 0);
  const remeasure = [];
  const post = (dr, cr, amt) => amt > 0 && remeasure.push({ acct: dr, dr: round(amt), cr: 0 }, { acct: cr, dr: 0, cr: round(amt) });
  const perAsset = {};
  for (const [costAcct, kind] of [[1200, 'crypto'], [1210, 'stablecoin']]) {
    const adjAcct = costAcct + 5;
    const impAcct = costAcct + 6;
    const assets = Object.keys(holdings).filter((a) => ASSETS[a].kind === kind);
    // Book cost in the GL can differ from lot cost by cents (same-day transfers); true it up to lot cost first.
    const lotCost = assets.reduce((s, a) => s + (lots[a] || []).reduce((x, l) => x + l.qty * l.unit, 0), 0);
    const drift = round(lotCost - sumBy(costAcct));
    if (drift > 0) post(costAcct, 4900, drift); else post(4900, costAcct, -drift);
    for (const a of assets) {
      const cost = (lots[a] || []).reduce((x, l) => x + l.qty * l.unit, 0);
      const fv = holdings[a] * priceAt(a, asOf, anchor);
      const diff = fv - cost;
      let carrying = fv;
      if (policy.model === 'fair-value') { if (diff > 0) post(adjAcct, 4910, diff); else post(4910, adjAcct, -diff); }
      else if (policy.model === 'cost') { carrying = Math.min(cost, fv); post(4920, impAcct, cost - carrying); }
      else { if (diff > 0) post(adjAcct, 3100, diff); else post(4910, adjAcct, -diff); }
      perAsset[a] = { cost: round(cost), fv: round(fv), carrying: round(carrying), adjustment: round(carrying - cost) };
    }
  }
  if (remeasure.length) entries.push({ id: 'remeasure', date: asOf, source: 'Remeasurement', memo: policy.memo, lines: remeasure });

  // Balances and rollforward.
  const balancesByAcct = {};
  for (const e of entries) for (const l of e.lines) balancesByAcct[l.acct] = round((balancesByAcct[l.acct] || 0) + l.dr - l.cr);
  const rollforward = Object.values(roll).map((r) => {
    const closeQty = holdings[r.asset] || 0;
    const closeCost = (lots[r.asset] || []).reduce((s, l) => s + l.qty * l.unit, 0);
    const fv = closeQty * priceAt(r.asset, asOf, anchor);
    const pa = perAsset[r.asset] || { carrying: round(fv), adjustment: round(fv - closeCost) };
    return { ...r, closeQty, closeCost: round(closeCost), fairValue: round(fv), carrying: pa.carrying, adjustment: pa.adjustment, unrealised: round(fv - closeCost) };
  });

  const uncategorised = state.transactions.filter((t) => t.category === 'Uncategorised').length;
  const unreconciled = state.transactions.filter((t) => !t.reconciled).length;
  if (uncategorised) warnings.unshift(`${uncategorised} transaction(s) are uncategorised and sit in Suspense. Classify them before closing a period.`);
  if (unreconciled) warnings.unshift(`${unreconciled} transaction(s) are not yet reconciled.`);
  const clearing = round((balancesByAcct[1900] || 0) + (balancesByAcct[1910] || 0));
  if (Math.abs(clearing) >= 1) warnings.push(`Clearing accounts hold ${clearing.toLocaleString('en-US')} USD. These are transfers still in transit, partner fees, or flows from accounts not connected to TRNZIT. Review before closing.`);

  return { entries, balances: balancesByAcct, byTx, rollforward, warnings, policy };
}

export const FRAMEWORKS = {
  'IFRS-cost': { framework: 'IFRS', model: 'cost', label: 'IFRS: IAS 38 cost model', memo: 'IAS 38 cost model: impair digital assets to the lower of cost and fair value' },
  'IFRS-revaluation': { framework: 'IFRS', model: 'revaluation', label: 'IFRS: IAS 38 revaluation model', memo: 'IAS 38 revaluation: increases to OCI revaluation surplus, decreases to profit or loss' },
  'US-GAAP': { framework: 'US GAAP', model: 'fair-value', label: 'US GAAP: ASC 350-60 fair value (ASU 2023-08)', memo: 'Remeasure digital assets to fair value (ASU 2023-08)' },
};

export function measurementPolicy(state) {
  return FRAMEWORKS[state.accounting?.policy] || FRAMEWORKS['IFRS-cost'];
}

/** Trial balance rows plus totals (debits must equal credits). */
export function trialBalance(books) {
  const rows = Object.entries(books.balances)
    .filter(([, b]) => Math.abs(b) >= 0.005)
    .map(([acct, b]) => ({ acct: Number(acct), ...ACCOUNTS[acct], dr: b > 0 ? b : 0, cr: b < 0 ? -b : 0 }))
    .sort((a, b) => a.acct - b.acct);
  const dr = round(rows.reduce((s, r) => s + r.dr, 0));
  const cr = round(rows.reduce((s, r) => s + r.cr, 0));
  return { rows, dr, cr, balanced: Math.abs(dr - cr) < 0.01 };
}

/** Simple income statement from the GL balances. */
export function incomeStatement(books) {
  const lines = Object.entries(books.balances)
    .filter(([acct]) => ['income', 'expense'].includes(ACCOUNTS[acct]?.type))
    .map(([acct, b]) => ({ acct: Number(acct), name: ACCOUNTS[acct].name, type: ACCOUNTS[acct].type, amount: round(-b) }))
    .sort((a, b) => a.acct - b.acct);
  const net = round(lines.reduce((s, l) => s + l.amount, 0));
  const oci = round(-(books.balances[3100] || 0)); // IFRS revaluation surplus for the period
  return { lines, net, oci, total: round(net + oci) };
}
