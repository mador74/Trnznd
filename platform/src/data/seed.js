// Deterministic DEMO data. Every name, address, hash and price below is fictional.
// Balances are derived from opening balances + the generated ledger so the numbers
// on every screen reconcile with each other.

import { DISPLAY_CURRENCIES } from '../lib/fx.js';


export const ASSETS = {
  BTC: { name: 'Bitcoin', kind: 'crypto', price: 60000 },
  ETH: { name: 'Ether', kind: 'crypto', price: 3000 },
  SOL: { name: 'Solana', kind: 'crypto', price: 150 },
  USDT: { name: 'Tether USD', kind: 'stablecoin', price: 1 },
  USDC: { name: 'USD Coin', kind: 'stablecoin', price: 1 },
  USD: { name: 'US Dollar', kind: 'fiat', price: 1 },
  EUR: { name: 'Euro', kind: 'fiat', price: DISPLAY_CURRENCIES.EUR.usdPer },
  GBP: { name: 'British Pound', kind: 'fiat', price: DISPLAY_CURRENCIES.GBP.usdPer },
};
export const FIAT = ['USD', 'EUR', 'GBP'];
export const CRYPTO = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'];

// Which networks each asset can be sent on (used to block mismatched payments).
export const ASSET_NETWORKS = {
  BTC: ['Bitcoin'],
  ETH: ['Ethereum', 'Arbitrum', 'Base'],
  SOL: ['Solana'],
  USDT: ['Ethereum', 'Tron', 'Solana'],
  USDC: ['Ethereum', 'Solana', 'Base', 'Polygon', 'Arbitrum'],
};

export const CONNECTION_TYPES = {
  exchange: { label: 'Exchange', auth: 'Read-only API key + secret' },
  custodian: { label: 'Custodian', auth: 'Read-only API key / service account' },
  wallet: { label: 'Self-custody wallet', auth: 'Public address or xpub (no private keys)' },
  otc: { label: 'OTC / broker account', auth: 'Read-only API key or statement import' },
  bank: { label: 'Bank account', auth: 'Open-banking consent (read-only)', fiat: true },
  card: { label: 'Credit card', auth: 'Open-banking consent (read-only)', fiat: true },
};
export const isFiatConn = (c) => !!CONNECTION_TYPES[c?.type]?.fiat;

export const ROLES = {
  owner: { label: 'Owner', desc: 'The business account. Full control including billing.' },
  admin: { label: 'Admin', desc: 'Manages team, connections and policies. Can request and approve.' },
  approver: { label: 'Approver', desc: 'Creates and signs approval requests. Read access elsewhere.' },
  accountant: { label: 'Accountant', desc: 'Reconciles, categorises and exports. Can create requests.' },
  viewer: { label: 'Viewer', desc: 'Read-only access to balances and the ledger.' },
};

export const PERMISSIONS = {
  manageBilling: ['owner'],
  manageTeam: ['owner', 'admin'],
  manageConnections: ['owner', 'admin'],
  managePolicies: ['owner', 'admin'],
  createRequest: ['owner', 'admin', 'approver', 'accountant'],
  reconcile: ['owner', 'admin', 'accountant'],
  export: ['owner', 'admin', 'accountant', 'approver'],
  invoices: ['owner', 'admin', 'accountant'],
};

export const can = (user, perm) => !!user && user.status === 'active' && PERMISSIONS[perm].includes(user.role);

export const CATEGORIES = [
  'Uncategorised', 'Customer receipt', 'Supplier payment', 'Payroll', 'Internal transfer',
  'Exchange fee', 'Network fee', 'Conversion', 'Treasury rebalance', 'Other income',
  'Card spend', 'Software & services', 'Travel', 'Card repayment',
];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const hex = (r, n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');

export function buildSeed(nowDate = new Date()) {
  const now = +nowDate; // number, so `now + n` is arithmetic rather than string concatenation
  const r = rng(20261004);
  const DAY = 86400000;
  const iso = (t) => new Date(t).toISOString();

  const users = [
    { id: 'u-owner', name: 'Alex Morgan', email: 'alex@example.com', role: 'owner', status: 'active', mfa: true, canRelease: true },
    { id: 'u-cfo', name: 'Priya Shah', email: 'priya@example.com', role: 'admin', status: 'active', mfa: true, canRelease: true },
    { id: 'u-tm', name: 'Daniel Okafor', email: 'daniel@example.com', role: 'approver', status: 'active', mfa: true },
    { id: 'u-ops', name: 'Sofia Lindqvist', email: 'sofia@example.com', role: 'approver', status: 'active', mfa: true },
    { id: 'u-acc', name: 'Tom Becker', email: 'tom@example.com', role: 'accountant', status: 'active', mfa: false },
  ];

  const connections = [
    { id: 'c-ex1', name: 'Main exchange — trading', type: 'exchange', network: 'Multi-chain', assets: ['BTC', 'ETH', 'SOL', 'USDT', 'USDC'] },
    { id: 'c-ex2', name: 'EU exchange — settlement', type: 'exchange', network: 'Multi-chain', assets: ['BTC', 'ETH', 'USDC'] },
    { id: 'c-cus', name: 'Cold storage — MPC custodian', type: 'custodian', network: 'Multi-chain', assets: ['BTC', 'ETH', 'USDC'] },
    { id: 'c-eth', name: 'Ops wallet — Ethereum', type: 'wallet', network: 'Ethereum', address: '0x' + hex(r, 40), assets: ['ETH', 'USDC', 'USDT'] },
    { id: 'c-trx', name: 'Payments wallet — Tron', type: 'wallet', network: 'Tron', address: 'T' + hex(r, 33), assets: ['USDT'] },
  ].map((c, i) => ({
    ...c, status: 'connected', lastSync: iso(now - (i * 7 + 3) * 60000), connectedAt: iso(now - 200 * DAY),
    // Wallets sign on the user's own device and the custodian has a payments API; exchanges need a withdrawal key first.
    sendEnabled: c.type === 'wallet' || c.type === 'custodian',
  }));

  const opening = {
    'c-ex1': { BTC: 6, ETH: 120, SOL: 2500, USDT: 900000, USDC: 400000 },
    'c-ex2': { BTC: 2, ETH: 40, USDC: 600000 },
    'c-cus': { BTC: 35, ETH: 600, USDC: 1500000 },
    'c-eth': { ETH: 25, USDC: 300000, USDT: 150000 },
    'c-trx': { USDT: 650000 },
  };

  const contacts = [
    { id: 'k1', name: 'Harbourline Logistics', kind: 'supplier' },
    { id: 'k2', name: 'Kestrel Components', kind: 'supplier' },
    { id: 'k3', name: 'Meridian Textiles', kind: 'customer' },
    { id: 'k4', name: 'Solano Imports', kind: 'customer' },
    { id: 'k5', name: 'Atlas Payroll Services', kind: 'supplier' },
    { id: 'k6', name: 'Brightwater Consulting', kind: 'supplier' },
    { id: 'k7', name: 'Qadir Trading House', kind: 'customer' },
  ].map((k) => ({ ...k, address: '0x' + hex(r, 40), network: 'Ethereum', email: `accounts@${k.name.split(' ')[0].toLowerCase()}.example` }));

  const whitelist = contacts.slice(0, 6).map((k, i) => ({
    id: 'w' + i, label: k.name, address: k.address, network: k.network, addedAt: iso(now - (150 - i * 9) * DAY),
  }));

  const cryptoConns = connections.slice();
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const transactions = [];
  let n = 0;
  const push = (t) => transactions.push({ id: 't' + ++n, reconciled: false, memo: '', ...t });

  for (let d = 120; d >= 0; d--) {
    const perDay = 1 + Math.floor(r() * 3);
    for (let k = 0; k < perDay; k++) {
      const ts = now - d * DAY - Math.floor(r() * DAY * 0.9);
      const conn = pick(cryptoConns);
      const asset = pick(conn.assets);
      const price = ASSETS[asset].price;
      const roll = r();
      const sizeUsd = asset === 'USDT' || asset === 'USDC' ? 2000 + r() * 90000 : 1000 + r() * 40000;
      const qty = +(sizeUsd / price).toFixed(asset === 'BTC' ? 5 : asset === 'ETH' ? 4 : 2);
      const reconciled = d > 10 ? r() > 0.08 : r() > 0.7;
      const hash = '0x' + hex(r, 64);
      const contact = pick(contacts);

      if (roll < 0.42) {
        push({ connectionId: conn.id, date: iso(ts), type: 'deposit', asset, amount: qty, counterparty: contact.name,
          counterpartyAddress: contact.address, txHash: hash, category: reconciled ? 'Customer receipt' : 'Uncategorised', reconciled });
      } else if (roll < 0.72) {
        const out = +(qty * 0.8).toFixed(6);
        push({ connectionId: conn.id, date: iso(ts), type: 'withdrawal', asset, amount: -out, counterparty: contact.name,
          counterpartyAddress: contact.address, txHash: hash, category: reconciled ? pick(['Supplier payment', 'Payroll']) : 'Uncategorised', reconciled });
        push({ connectionId: conn.id, date: iso(ts + 1000), type: 'fee', asset, amount: -+(out * 0.0008).toFixed(6),
          counterparty: 'Network', txHash: hash, category: 'Network fee', reconciled });
      } else if (roll < 0.88) {
        const to = pick(cryptoConns.filter((c) => c.id !== conn.id && c.assets.includes(asset)));
        if (!to) continue;
        const q = +(qty * 0.6).toFixed(6);
        push({ connectionId: conn.id, date: iso(ts), type: 'transfer_out', asset, amount: -q, counterparty: to.name,
          counterpartyAddress: to.address || 'Internal', txHash: hash, category: 'Internal transfer', reconciled, internal: true });
        push({ connectionId: to.id, date: iso(ts + 600000), type: 'transfer_in', asset, amount: q, counterparty: conn.name,
          counterpartyAddress: conn.address || 'Internal', txHash: hash, category: 'Internal transfer', reconciled, internal: true });
      } else if (conn.type === 'exchange') {
        // Conversion executed by the user directly on the exchange — imported for the record only.
        const stable = conn.assets.includes('USDC') ? 'USDC' : 'USDT';
        const crypto = pick(conn.assets.filter((a) => ASSETS[a].kind === 'crypto'));
        const cq = +(sizeUsd / ASSETS[crypto].price).toFixed(5);
        const sell = r() > 0.5;
        push({ connectionId: conn.id, date: iso(ts), type: 'conversion', asset: crypto, amount: sell ? -cq : cq,
          counterparty: 'Exchange order book', txHash: 'order-' + hex(r, 12), category: 'Conversion', reconciled });
        push({ connectionId: conn.id, date: iso(ts), type: 'conversion', asset: stable, amount: +(sell ? cq * ASSETS[crypto].price : -cq * ASSETS[crypto].price).toFixed(2),
          counterparty: 'Exchange order book', txHash: 'order-' + hex(r, 12), category: 'Conversion', reconciled });
        push({ connectionId: conn.id, date: iso(ts), type: 'fee', asset: stable, amount: -+(sizeUsd * 0.001).toFixed(2),
          counterparty: 'Exchange', txHash: 'order-' + hex(r, 12), category: 'Exchange fee', reconciled });
      }
    }
  }
  // ---- Fiat accounts via open banking (separate RNG so the crypto ledger above is unchanged) ----
  const r2 = rng(777);
  const pick2 = (arr) => arr[Math.floor(r2() * arr.length)];
  const fiatConns = [
    { id: 'c-bank', name: 'Business current account', type: 'bank', network: 'Demo Bank · USD', institution: 'Demo Bank', accountMask: '••••4821', assets: ['USD'] },
    { id: 'c-card', name: 'Corporate credit card', type: 'card', network: 'Demo Bank · USD', institution: 'Demo Bank', accountMask: '••••9034', assets: ['USD'] },
  ].map((c, i) => ({ ...c, status: 'connected', lastSync: iso(now - (i * 5 + 8) * 60000), connectedAt: iso(now - 150 * DAY), consentExpires: iso(now + (62 - i * 50) * DAY) }));
  connections.push(...fiatConns);
  opening['c-bank'] = { USD: 420000 };
  opening['c-card'] = { USD: -3200 };
  const merchants = [['Cloud hosting provider', 'Software & services'], ['Airline', 'Travel'], ['Hotel', 'Travel'], ['Office supplies', 'Card spend'], ['Data subscription', 'Software & services']];
  for (let d = 120; d >= 0; d--) {
    const ts = now - d * DAY - Math.floor(r2() * DAY * 0.8);
    const rec = d > 10 ? r2() > 0.1 : r2() > 0.6;
    if (r2() < 0.45) {
      const [m, cat] = pick2(merchants);
      push({ connectionId: 'c-card', date: iso(ts), type: 'card_spend', asset: 'USD', amount: -Math.round(80 + r2() * 2400), counterparty: m, txHash: 'card-' + hex(r2, 10), category: rec ? cat : 'Uncategorised', reconciled: rec });
    }
    if (r2() < 0.18) {
      const k2 = pick2(contacts);
      push({ connectionId: 'c-bank', date: iso(ts), type: 'deposit', asset: 'USD', amount: Math.round(5000 + r2() * 60000), counterparty: k2.name, txHash: 'bank-' + hex(r2, 10), category: rec ? 'Customer receipt' : 'Uncategorised', reconciled: rec });
    }
    if (r2() < 0.12) {
      const k2 = pick2(contacts);
      push({ connectionId: 'c-bank', date: iso(ts), type: 'withdrawal', asset: 'USD', amount: -Math.round(3000 + r2() * 40000), counterparty: k2.name, txHash: 'bank-' + hex(r2, 10), category: rec ? 'Supplier payment' : 'Uncategorised', reconciled: rec });
    }
    if (d % 30 === 5) {
      const amt = 17000;
      push({ connectionId: 'c-bank', date: iso(ts), type: 'transfer_out', asset: 'USD', amount: -amt, counterparty: 'Corporate credit card', txHash: 'bank-' + hex(r2, 10), category: 'Card repayment', reconciled: true, internal: true });
      push({ connectionId: 'c-card', date: iso(ts + 3600000), type: 'transfer_in', asset: 'USD', amount: amt, counterparty: 'Business current account', txHash: 'card-' + hex(r2, 10), category: 'Card repayment', reconciled: true, internal: true });
    }
  }
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const policies = [
    { id: 'p1', name: 'Outgoing payments ≥ $10k — 2 of 3', enabled: true, actionTypes: ['withdrawal'], connectionIds: [],
      minUsd: 10000, approverIds: ['u-cfo', 'u-tm', 'u-ops'], required: 2, allowSelfApproval: false },
    { id: 'p2', name: 'Outgoing payments ≥ $250k — Owner co-sign', enabled: true, actionTypes: ['withdrawal', 'internal_transfer'], connectionIds: [],
      minUsd: 250000, approverIds: ['u-owner'], required: 1, allowSelfApproval: false },
    { id: 'p3', name: 'New whitelisted address — 2 of 3', enabled: true, actionTypes: ['address_whitelist'], connectionIds: [],
      minUsd: 0, approverIds: ['u-owner', 'u-cfo', 'u-ops'], required: 2, allowSelfApproval: false },
  ];

  const k = Object.fromEntries(contacts.map((c) => [c.id, c]));
  const requests = [
    { id: 'r5', type: 'withdrawal', connectionId: 'c-eth', asset: 'USDT', amount: 48500, usdValue: 48500, to: k.k1.name,
      toAddress: k.k1.address, reference: 'INV-2291 freight Q3', requestedBy: 'u-tm', createdAt: iso(now - 0.2 * DAY),
      approvals: [{ userId: 'u-cfo', at: iso(now - 0.1 * DAY), note: 'Matches PO-1182' }], rejections: [], status: 'pending' },
    { id: 'r4', type: 'internal_transfer', connectionId: 'c-ex1', asset: 'BTC', amount: 2, usdValue: 120000, to: 'Cold storage — MPC custodian',
      toAddress: 'Internal', reference: 'Sweep excess BTC to cold storage', requestedBy: 'u-ops', createdAt: iso(now - 0.5 * DAY),
      approvals: [], rejections: [], status: 'pending' },
    { id: 'r3', type: 'address_whitelist', connectionId: 'c-eth', asset: '—', amount: 0, usdValue: 0, to: k.k7.name,
      toAddress: k.k7.address, reference: 'New customer refund address', requestedBy: 'u-acc', createdAt: iso(now - 1.2 * DAY),
      approvals: [{ userId: 'u-owner', at: iso(now - 1 * DAY), note: '' }], rejections: [], status: 'pending' },
    { id: 'r2', type: 'withdrawal', connectionId: 'c-eth', asset: 'USDC', amount: 15000, usdValue: 15000, to: k.k6.name,
      toAddress: k.k6.address, reference: 'Advisory retainer — Sept', requestedBy: 'u-acc', createdAt: iso(now - 6 * DAY),
      approvals: [], rejections: [{ userId: 'u-cfo', at: iso(now - 5.8 * DAY), note: 'Invoice not yet received' }], status: 'rejected' },
    { id: 'r1', type: 'withdrawal', connectionId: 'c-eth', asset: 'USDT', amount: 92000, usdValue: 92000, to: k.k5.name,
      toAddress: k.k5.address, reference: 'Payroll — September', requestedBy: 'u-acc', createdAt: iso(now - 9 * DAY),
      approvals: [{ userId: 'u-cfo', at: iso(now - 8.9 * DAY), note: '' }, { userId: 'u-ops', at: iso(now - 8.8 * DAY), note: '' }],
      rejections: [], status: 'executed', executedAt: iso(now - 8.7 * DAY), executedTxHash: '0x' + hex(r, 64) },
  ];

  const audit = [
    { id: 'a3', at: iso(now - 0.1 * DAY), userId: 'u-cfo', action: 'Approved request', detail: '48,500 USDT to Harbourline Logistics' },
    { id: 'a2', at: iso(now - 0.2 * DAY), userId: 'u-tm', action: 'Created request', detail: '48,500 USDT to Harbourline Logistics' },
    { id: 'a1', at: iso(now - 1 * DAY), userId: 'u-owner', action: 'Approved request', detail: 'Whitelist Qadir Trading House' },
  ];

  const subscriptionInvoices = [0, 1, 2, 3].map((i) => ({
    id: 'SUB-' + (1040 - i), date: iso(now - (i * 30 + 4) * DAY), amountUsd: 100, status: 'paid',
    method: i % 2 ? 'USDC (Ethereum)' : 'Card •••• 4242',
  }));

  // Sales invoices. The paid one is matched to a real receipt in the ledger above.
  const receipt = transactions.find((t) => t.connectionId === 'c-eth' && t.asset === 'USDC' && t.type === 'deposit' && t.reconciled);
  receipt.memo = 'INV-0001';
  receipt.invoiceId = 'i1';
  receipt.category = 'Customer receipt';
  const day = (n) => iso(now + n * DAY).slice(0, 10);
  const payer = contacts.find((c) => c.name === receipt.counterparty) || contacts[2];
  const invoices = [
    { id: 'i1', number: 'INV-0001', contactId: payer.id,
      issueDate: receipt.date.slice(0, 10), dueDate: receipt.date.slice(0, 10), currency: 'USDC', payToConnectionId: 'c-eth', taxRate: 0,
      lines: [{ desc: 'Goods supplied per order', qty: 1, unitPrice: receipt.amount }], notes: '', status: 'paid',
      paidTxId: receipt.id, paidAt: receipt.date, sentLog: [{ at: receipt.date, to: [payer.email] }] },
    { id: 'i2', number: 'INV-0002', contactId: 'k4', issueDate: day(-40), dueDate: day(-10), currency: 'USDT', payToConnectionId: 'c-trx', taxRate: 0,
      lines: [{ desc: 'Cotton yarn, grade A (tonnes)', qty: 12, unitPrice: 2150 }, { desc: 'Freight and insurance', qty: 1, unitPrice: 1800 }],
      notes: 'Please include the invoice number as the payment reference.', status: 'sent', sentLog: [{ at: iso(now - 40 * DAY), to: ['accounts@solano.example'] }] },
    { id: 'i3', number: 'INV-0003', contactId: 'k7', issueDate: day(-6), dueDate: day(24), currency: 'USD', payToConnectionId: 'c-bank', taxRate: 0,
      lines: [{ desc: 'Consulting — trade finance setup', qty: 3, unitPrice: 4500 }], notes: '', status: 'sent',
      sentLog: [{ at: iso(now - 6 * DAY), to: ['accounts@qadir.example', 'alex@example.com'] }] },
    { id: 'i4', number: 'INV-0004', contactId: 'k3', issueDate: day(0), dueDate: day(30), currency: 'USDC', payToConnectionId: 'c-eth', taxRate: 0,
      lines: [{ desc: 'Dyed fabric rolls', qty: 40, unitPrice: 310 }], notes: '', status: 'draft', sentLog: [] },
  ];

  return {
    version: 4,
    org: { name: 'Demo Trading Co. Ltd', baseCurrency: 'USD', address: '1 Example Street, Example City', email: 'finance@example.com', regNo: 'Company no. 00000000 (demo)' },
    currentUserId: 'u-owner',
    users, connections, opening, contacts, whitelist, transactions, policies, requests, audit, invoices, subscriptionInvoices,
    billing: { planId: 'institution', paymentMethod: { type: 'card', label: 'Visa •••• 4242' }, nextInvoice: iso(now + 26 * DAY) },
  };
}
