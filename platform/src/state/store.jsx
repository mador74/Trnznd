import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { buildSeed } from '../data/seed.js';
import { setDisplayCurrency } from '../lib/format.js';
import { DISPLAY_CURRENCIES } from '../lib/fx.js';
import {
  addDays, applyDueChanges, billingNow, canAddConnection, canAddFiatConnection, cancellationDate, DEFAULT_INTERVAL, GRACE_DAYS, nextCharge, renewalReminders, canAddUser, canCancelFree, chargesBetween, intervalBlocker, INTERVALS,
  paymentMethodBlocker, planBlockers, planChangeTiming, planOf, PLANS, subscriptionStatus,
} from '../lib/plans.js';
import { deriveStatus } from '../lib/policy.js';
import { balances, usdOf } from '../lib/ledger.js';
import { cannotReleaseReason, sourceBlockReason } from '../lib/send.js';
import { convertBlockReason, defaultConvertKinds, quote } from '../lib/convert.js';
import { PARTNERS, redeemQuote } from '../lib/partners.js';

// Prototype persistence: browser storage only. A production build replaces this with
// the API described in platform/ARCHITECTURE.md.
const KEY = 'trnznd-treasury-v11';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.version === 11) return s;
    }
  } catch {
    /* storage unavailable — fall through to seed */
  }
  return buildSeed();
}

const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

/**
 * Prototype only: moves the demo billing clock to just after `target`, takes the charges that fall due
 * (the last one fails when `failLast`), logs the renewal reminders and notices sent on the way, and
 * applies scheduled renewal changes.
 */
function advanceClock(state, target, failLast) {
  const b0 = state.billing;
  const from = billingNow(b0);
  const to = new Date(+new Date(target) + 60000).toISOString();
  const s0 = subscriptionStatus(b0, from);
  let due = b0.paymentFailure ? [] : chargesBetween(b0, from, to);
  const failing = failLast ? due[due.length - 1] : null;
  const base = 1041 + state.subscriptionInvoices.length;
  const invoices = due.map((c, i) => ({
    id: 'SUB-' + (base + i), date: c.at, amountUsd: c.amountUsd, status: c === failing ? 'failed' : 'paid',
    method: b0.paymentMethod.label, period: `${PLANS[c.planId].name}, ${c.interval === 'annual' ? '12 months in advance' : 'monthly'}`,
  }));
  const failedInv = failing ? invoices[invoices.length - 1] : null;
  const events = [
    ...renewalReminders(b0, from).filter((r) => !r.sent && +new Date(r.at) <= +new Date(to))
      .map((r) => ({ at: r.at, action: `Renewal reminder sent (${r.label} before renewal)`, detail: `Emailed to the Owner: renews ${s0.renewsOn.slice(0, 10)}; notice to cancel needed by ${addDays(s0.renewsOn, -30).slice(0, 10)}` })),
    ...invoices.filter((i) => i.status === 'paid').map((i) => ({ at: i.date, action: 'Subscription charged', detail: `${i.id} ${i.period}: $${i.amountUsd.toFixed(2)}` })),
  ];
  if (failedInv)
    events.push({ at: failedInv.date, action: 'Card payment failed — Owner notified', detail: `${failedInv.id}: $${failedInv.amountUsd.toFixed(2)}. Email and in-app notice: fix within ${GRACE_DAYS} days or the subscription is cancelled automatically` });
  let billing = applyDueChanges({ ...b0, clockOffsetMs: (b0.clockOffsetMs || 0) + (+new Date(to) - +new Date(from)) }, to);
  if (failedInv) billing = { ...billing, paymentFailure: { at: failedInv.date, amountUsd: failedInv.amountUsd, invoiceId: failedInv.id } };
  const s1 = subscriptionStatus(billing, to);
  if (s1.phase === 'ended' && s0.phase !== 'ended')
    events.push({ at: s1.endedAt || to, action: s1.reason === 'payment' ? 'Subscription cancelled automatically' : 'Subscription ended',
      detail: s1.reason === 'payment' ? `Card payment not settled within ${GRACE_DAYS} days` : 'Cancellation took effect on the renewal date' });
  const logged = events.sort((x, y) => +new Date(y.at) - +new Date(x.at))
    .map((e) => ({ id: uid('a'), at: now(), userId: 'system', action: 'Demo clock: ' + e.action, detail: `${e.at.slice(0, 10)} · ${e.detail}` }));
  return {
    ...state,
    billing,
    subscriptionInvoices: [...invoices.reverse(), ...state.subscriptionInvoices],
    audit: [...logged, ...state.audit].slice(0, 500),
  };
}

function audit(state, action, detail) {
  return [{ id: uid('a'), at: now(), userId: state.currentUserId, action, detail }, ...state.audit].slice(0, 500);
}


function describe(req) {
  if (req.type === 'address_whitelist') return `Whitelist ${req.to}`;
  if (req.type === 'conversion') return `Convert ${req.amount.toLocaleString('en-US')} ${req.asset} to ${req.toAsset}`;
  return `${req.amount.toLocaleString('en-US')} ${req.asset} to ${req.to}`;
}

/** Marks a payment executed and writes its outflow into the ledger, linked to the request. */
function settle(state, r, txHash) {
  if (r.type === 'conversion') return settleConversion(state, r, txHash);
  const tx = {
    id: uid('t'), connectionId: r.connectionId, date: now(), type: r.type === 'internal_transfer' ? 'transfer_out' : 'withdrawal',
    asset: r.asset, amount: -r.amount, counterparty: r.to, counterpartyAddress: r.toAddress, txHash,
    category: r.type === 'internal_transfer' ? 'Internal transfer' : r.zendRedeem ? 'Treasury rebalance' : 'Supplier payment', reconciled: true,
    memo: r.reference, requestId: r.id, internal: r.type === 'internal_transfer',
  };
  const settled = {
    ...state,
    requests: state.requests.map((x) => (x.id === r.id ? { ...x, status: 'executed', executedAt: now(), executedTxHash: txHash } : x)),
    transactions: [tx, ...state.transactions],
  };
  return r.zendRedeem ? payRedemption(settled, r) : settled;
}

/** After ZEND reaches TRNZND S.A.'s redemption address, TRNZND S.A. pays fiat to the chosen bank account (demo: instantly). */
function payRedemption(state, r) {
  const { fiat, bankConnectionId } = r.zendRedeem;
  const q = redeemQuote(r.amount, fiat);
  const order = { id: uid('z'), kind: 'redeem', fiat, fiatAmount: q.fiat, zend: r.amount, connectionId: r.connectionId, bankConnectionId, status: 'paid', createdAt: r.createdAt, completedAt: now(), requestId: r.id };
  const credit = {
    id: uid('t'), connectionId: bankConnectionId, date: now(), type: 'deposit', asset: fiat, amount: +q.fiat.toFixed(2),
    counterparty: 'TRNZND S.A. (ZEND redemption)', txHash: 'bank-' + order.id, category: 'Treasury rebalance', reconciled: true, memo: `Redeemed ${r.amount} ZEND`,
  };
  const bankKnown = state.connections.some((c) => c.id === bankConnectionId);
  return { ...state, zendOrders: [order, ...state.zendOrders], transactions: bankKnown ? [credit, ...state.transactions] : state.transactions };
}

/** Moves on-ramp and mint orders from "processing" to "delivered" and credits the destination (demo timing). */
function advanceOrders(state) {
  const due = (o) => o.status === 'processing' && Date.now() - new Date(o.processingAt).getTime() > 4000;
  if (!state.onrampOrders.some(due) && !state.zendOrders.some(due)) return state;
  let transactions = state.transactions;
  let connections = state.connections;
  const credit = (connectionId, asset, amount, counterparty, memo) => {
    transactions = [{ id: uid('t'), connectionId, date: now(), type: 'deposit', asset, amount: +amount.toFixed(6), counterparty, txHash: '0x' + Math.random().toString(16).slice(2).padEnd(16, '0'), category: 'Treasury rebalance', reconciled: true, memo }, ...transactions];
    connections = connections.map((c) => (c.id === connectionId && !c.assets.includes(asset) ? { ...c, assets: [...c.assets, asset] } : c));
  };
  const onrampOrders = state.onrampOrders.map((o) => {
    if (!due(o)) return o;
    credit(o.connectionId, o.asset, o.receive, 'On-ramp partner (purchase)', `Bought with ${o.fiatAmount} ${o.fiat}`);
    return { ...o, status: 'delivered', completedAt: now() };
  });
  const zendOrders = state.zendOrders.map((o) => {
    if (!due(o)) return o;
    credit(o.connectionId, 'ZEND', o.zend, 'TRNZND S.A. (ZEND mint)', `Minted from ${o.fiatAmount} ${o.fiat}`);
    return { ...o, status: 'delivered', completedAt: now() };
  });
  return { ...state, onrampOrders, zendOrders, transactions, connections };
}

/** Outflow from a connected bank or card when the user pays a partner from it (shown by the open-banking feed). */
function payFrom(state, connectionId, fiat, amount, counterparty) {
  if (!state.connections.some((c) => c.id === connectionId)) return state.transactions;
  const type = state.connections.find((c) => c.id === connectionId).type === 'card' ? 'card_spend' : 'withdrawal';
  return [{ id: uid('t'), connectionId, date: now(), type, asset: fiat, amount: -amount, counterparty, txHash: 'bank-' + uid(''), category: 'Treasury rebalance', reconciled: true, memo: '' }, ...state.transactions];
}

/** Records an executed conversion as three ledger lines: amount out, gross amount in, provider fee. */
function settleConversion(state, r, ref) {
  const q = quote(r.asset, r.toAsset, r.amount);
  const base = { connectionId: r.connectionId, date: now(), type: 'conversion', counterparty: 'Provider conversion', txHash: 'conv-' + ref.slice(2, 14), reconciled: true, memo: r.reference, requestId: r.id };
  const lines = [
    { ...base, id: uid('t'), asset: r.asset, amount: -r.amount, category: 'Conversion' },
    { ...base, id: uid('t'), asset: r.toAsset, amount: +q.gross.toFixed(8), category: 'Conversion' },
    { ...base, id: uid('t'), asset: r.toAsset, amount: -+q.fee.toFixed(8), type: 'fee', category: 'Exchange fee', counterparty: 'Provider fee' },
  ];
  const connections = state.connections.map((c) => (c.id === r.connectionId && !c.assets.includes(r.toAsset) ? { ...c, assets: [...c.assets, r.toAsset] } : c));
  return {
    ...state,
    connections,
    requests: state.requests.map((x) => (x.id === r.id ? { ...x, status: 'executed', executedAt: now(), received: q.receive, rate: q.rate } : x)),
    transactions: [...lines, ...state.transactions],
  };
}

function reducer(state, a) {
  switch (a.type) {
    case 'RESET':
      return buildSeed();
    case 'SET_DISPLAY_CURRENCY':
      if (!DISPLAY_CURRENCIES[a.code]) return state;
      return { ...state, users: state.users.map((u) => (u.id === state.currentUserId ? { ...u, displayCurrency: a.code } : u)) };
    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: a.userId };

    case 'ADD_CONNECTION': {
      if (!canAddConnection(state)) return state;
      if ((a.connection.type === 'bank' || a.connection.type === 'card') && !canAddFiatConnection(state)) return state;
      const c = {
        convertKinds: defaultConvertKinds(a.connection.type), convertEnabled: false,
        ...a.connection, id: uid('c-'), status: 'connected', lastSync: now(), connectedAt: now(),
      };
      return {
        ...state,
        connections: [...state.connections, c],
        opening: { ...state.opening, [c.id]: a.openingBalances || {} },
        audit: audit(state, 'Added connection', c.name),
      };
    }
    case 'SYNC_CONNECTION':
      return {
        ...state,
        connections: state.connections.map((c) => (c.id === a.id ? { ...c, lastSync: now(), status: 'connected' } : c)),
      };
    case 'REMOVE_CONNECTION': {
      const c = state.connections.find((x) => x.id === a.id);
      return {
        ...state,
        connections: state.connections.filter((x) => x.id !== a.id),
        audit: audit(state, 'Removed connection', `${c?.name} (history retained in audit log)`),
      };
    }

    case 'UPDATE_TX':
      return {
        ...state,
        transactions: state.transactions.map((t) => (a.ids.includes(t.id) ? { ...t, ...a.patch } : t)),
        audit: a.silent ? state.audit : audit(state, 'Updated transactions', `${a.ids.length} item(s): ${Object.keys(a.patch).join(', ')}`),
      };

    case 'CREATE_REQUEST': {
      const single = !planOf(state).approvals;
      if (single && a.request.type === 'address_whitelist') {
        // Basic has one user and no approval rules: the address is added straight away (and audited).
        const w = { id: uid('w'), label: a.request.to, address: a.request.toAddress, network: a.request.network || '—', addedAt: now() };
        return { ...state, whitelist: [w, ...state.whitelist], audit: audit(state, 'Whitelisted address', `${w.label} · ${w.network} · ${w.address}`) };
      }
      const req = {
        ...a.request, id: uid('r'), requestedBy: state.currentUserId, createdAt: now(), approvals: [], rejections: [], status: 'pending',
        ...(single ? { policyExempt: true } : {}),
      };
      return { ...state, requests: [req, ...state.requests], audit: audit(state, single ? 'Created payment' : 'Created request', describe(req)) };
    }
    case 'SIGN_REQUEST': {
      if (!planOf(state).approvals) return state;
      let whitelist = state.whitelist;
      let entry;
      const requests = state.requests.map((r) => {
        if (r.id !== a.id) return r;
        const sig = { userId: state.currentUserId, at: now(), note: a.note || '' };
        const next = a.decision === 'approve' ? { ...r, approvals: [...r.approvals, sig] } : { ...r, rejections: [...r.rejections, sig] };
        next.status = deriveStatus(next, state.policies, state.users);
        if (next.type === 'address_whitelist' && next.status === 'approved') {
          whitelist = [{ id: uid('w'), label: next.to, address: next.toAddress, network: next.network || '—', addedAt: now() }, ...whitelist];
          next.status = 'executed';
          next.executedAt = now();
        }
        entry = `${describe(r)} → ${next.status}`;
        return next;
      });
      return { ...state, requests, whitelist, audit: audit(state, a.decision === 'approve' ? 'Approved request' : 'Rejected request', entry) };
    }
    case 'MARK_EXECUTED': {
      const r = state.requests.find((x) => x.id === a.id);
      if (deriveStatus(r, state.policies, state.users) !== 'approved') return state;
      return { ...settle(state, r, a.txHash), audit: audit(state, 'Recorded execution', `${describe(r)} · ${a.txHash}`) };
    }
    case 'SEND_REQUEST': {
      // Final release by an authorised user. TRNZIT only forwards the instruction to the provider holding the
      // assets; it never signs with or holds private keys. Re-checks releaser, approval, source and balance.
      const r = state.requests.find((x) => x.id === a.id);
      const conn = state.connections.find((c) => c.id === r?.connectionId);
      const releaser = state.users.find((u) => u.id === state.currentUserId);
      const sourceBlock = r?.type === 'conversion' ? convertBlockReason(conn, r.asset, r.toAsset) : sourceBlockReason(conn);
      if (!r || cannotReleaseReason(releaser) || deriveStatus(r, state.policies, state.users) !== 'approved' || sourceBlock) return state;
      const available = (balances(state)[conn.id] || {})[r.asset] || 0;
      if (r.amount > available) return state;
      return {
        ...state,
        requests: state.requests.map((x) => (x.id === a.id ? { ...x, status: 'broadcast', broadcastAt: now(), sentBy: state.currentUserId } : x)),
        audit: audit(state, r.type === 'conversion' ? 'Released conversion instruction' : 'Released payment instruction', `${describe(r)} → passed to ${conn.name}`),
      };
    }
    case 'CONVERT_NOW': {
      // A conversion no policy covers: create it and release it in one step (still by an authorised releaser).
      const id = uid('r');
      const req = { ...a.request, id, requestedBy: state.currentUserId, createdAt: now(), approvals: [], rejections: [], status: 'pending' };
      if (deriveStatus(req, state.policies, state.users) !== 'approved') return state;
      const created = { ...state, requests: [req, ...state.requests], audit: audit(state, 'Created conversion', describe(req)) };
      return reducer(created, { type: 'SEND_REQUEST', id });
    }
    case 'SET_CONVERT_ENABLED': {
      const c = state.connections.find((x) => x.id === a.id);
      return {
        ...state,
        connections: state.connections.map((x) => (x.id === a.id ? { ...x, convertEnabled: a.enabled } : x)),
        audit: audit(state, a.enabled ? 'Enabled conversions' : 'Disabled conversions', c?.name),
      };
    }
    case 'PARTNER_APPLY':
      return { ...state, partners: { ...state.partners, [a.partner]: { status: 'pending', appliedAt: now() } }, audit: audit(state, 'Started partner onboarding', PARTNERS[a.partner].name) };
    case 'PARTNER_APPROVE': {
      // Demo stand-in for the partner finishing its business checks (KYB).
      if (state.partners[a.partner]?.status !== 'pending') return state;
      if (a.partner === 'onramp') {
        if (!canAddConnection(state)) return state;
        const c = {
          id: uid('c-'), name: 'On-ramp custody account', type: 'custodian', provider: 'On-ramp partner', network: 'Partner custody', assets: [...PARTNERS.onramp.assets],
          status: 'connected', lastSync: now(), connectedAt: now(), sendEnabled: false, convertKinds: [], convertEnabled: false,
        };
        return {
          ...state,
          connections: [...state.connections, c],
          opening: { ...state.opening, [c.id]: {} },
          partners: { ...state.partners, onramp: { status: 'active', connectionId: c.id, approvedAt: now() } },
          audit: audit(state, 'Partner account opened', 'On-ramp partner. Custody account connected.'),
        };
      }
      // One TRNZND S.A. redemption address per ZEND network, so a redemption always goes out on the right chain.
      const rand = (chars, n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      const addr = { Ethereum: () => '0x' + rand('0123456789abcdef', 40), Solana: () => rand(b58, 44), Tron: () => 'T' + rand(b58, 33) };
      const ws = PARTNERS.trnznd.networks.map((network) => ({ id: uid('w'), label: `TRNZND S.A. — ZEND redemption (${network})`, network, address: addr[network](), addedAt: now(), system: true }));
      return {
        ...state,
        whitelist: [...ws, ...state.whitelist],
        partners: { ...state.partners, trnznd: { status: 'active', redemptionWhitelistIds: ws.map((w) => w.id), approvedAt: now() } },
        audit: audit(state, 'Partner account opened', `TRNZND S.A. minting account. Redemption addresses whitelisted on ${PARTNERS.trnznd.networks.join(', ')}.`),
      };
    }
    case 'ONRAMP_CREATE': {
      const o = { ...a.order, id: uid('o'), status: 'awaiting_payment', createdAt: now(), createdBy: state.currentUserId };
      return { ...state, onrampOrders: [o, ...state.onrampOrders], audit: audit(state, 'Started stablecoin purchase', `${o.fiatAmount} ${o.fiat} → ${o.asset} via on-ramp partner`) };
    }
    case 'ONRAMP_PAID': {
      const o = state.onrampOrders.find((x) => x.id === a.id);
      if (!o || o.status !== 'awaiting_payment') return state;
      return {
        ...state,
        onrampOrders: state.onrampOrders.map((x) => (x.id === a.id ? { ...x, status: 'processing', processingAt: now() } : x)),
        transactions: o.payFromConnectionId ? payFrom(state, o.payFromConnectionId, o.fiat, o.fiatAmount, 'On-ramp partner') : state.transactions,
        audit: audit(state, 'Paid at on-ramp partner checkout', `${o.fiatAmount} ${o.fiat}`),
      };
    }
    case 'ZEND_MINT_CREATE': {
      if (state.partners.trnznd?.status !== 'active') return state;
      const o = { ...a.order, id: uid('z'), kind: 'mint', status: 'awaiting_deposit', createdAt: now(), createdBy: state.currentUserId };
      return { ...state, zendOrders: [o, ...state.zendOrders], audit: audit(state, 'Requested ZEND mint', `${o.fiatAmount} ${o.fiat} → ${o.zend.toFixed(2)} ZEND`) };
    }
    case 'ZEND_DEPOSIT_SENT': {
      const o = state.zendOrders.find((x) => x.id === a.id);
      if (!o || o.status !== 'awaiting_deposit') return state;
      return {
        ...state,
        zendOrders: state.zendOrders.map((x) => (x.id === a.id ? { ...x, status: 'processing', processingAt: now() } : x)),
        transactions: o.payFromConnectionId ? payFrom(state, o.payFromConnectionId, o.fiat, o.fiatAmount, 'TRNZND S.A. (ZEND mint deposit)') : state.transactions,
        audit: audit(state, 'Fiat deposit sent to TRNZND S.A.', `${o.fiatAmount} ${o.fiat}`),
      };
    }
    case 'CANCEL_ORDER': {
      const key = a.kind === 'onramp' ? 'onrampOrders' : 'zendOrders';
      return { ...state, [key]: state[key].map((x) => (x.id === a.id && ['awaiting_payment', 'awaiting_deposit'].includes(x.status) ? { ...x, status: 'cancelled' } : x)) };
    }
    case 'CREATE_MULTISIG': {
      if (!canAddConnection(state)) return state;
      const c = { ...a.connection, id: uid('c-'), type: 'multisig', status: 'connected', lastSync: now(), connectedAt: now(), sendEnabled: true, convertKinds: [], convertEnabled: false };
      return {
        ...state,
        connections: [...state.connections, c],
        opening: { ...state.opening, [c.id]: {} },
        audit: audit(state, a.connection.created ? 'Created multisig wallet' : 'Connected multisig wallet', `${c.name} · ${c.provider} · ${c.threshold} of ${c.owners.length}`),
      };
    }
    case 'CONFIRM_BROADCASTS': {
      // Demo stand-in for the provider: it executes the instruction a few seconds later and reports the
      // on-chain hash back, which TRNZIT then records in the ledger.
      const due = state.requests.filter((r) => r.status === 'broadcast' && Date.now() - new Date(r.broadcastAt).getTime() > 4000);
      if (!due.length) return advanceOrders(state);
      let next = advanceOrders(state);
      for (const r of due) next = settle(next, r, '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''));
      return { ...next, audit: due.reduce((log, r) => [{ id: uid('a'), at: now(), userId: r.sentBy, action: r.type === 'conversion' ? 'Provider executed conversion' : 'Provider executed payment', detail: describe(r) }, ...log], next.audit) };
    }
    case 'SET_RELEASER': {
      const u = state.users.find((x) => x.id === a.id);
      // The Owner is always a releaser, so a business can never lock itself out of its own payments.
      if (!u || (u.role === 'owner' && !a.enabled) || (a.enabled && cannotReleaseReason({ ...u, canRelease: true }))) return state;
      return {
        ...state,
        users: state.users.map((x) => (x.id === a.id ? { ...x, canRelease: a.enabled } : x)),
        audit: audit(state, a.enabled ? 'Authorised payment releaser' : 'Removed payment releaser', u.name),
      };
    }
    case 'SET_SEND_ENABLED': {
      const c = state.connections.find((x) => x.id === a.id);
      return {
        ...state,
        connections: state.connections.map((x) => (x.id === a.id ? { ...x, sendEnabled: a.enabled } : x)),
        audit: audit(state, a.enabled ? 'Enabled sending' : 'Disabled sending', c?.name),
      };
    }
    case 'CANCEL_REQUEST': {
      const r = state.requests.find((x) => x.id === a.id);
      return {
        ...state,
        requests: state.requests.map((x) => (x.id === a.id ? { ...x, status: 'cancelled' } : x)),
        audit: audit(state, 'Cancelled request', describe(r)),
      };
    }

    case 'SAVE_POLICY': {
      const exists = state.policies.some((p) => p.id === a.policy.id);
      const policy = exists ? a.policy : { ...a.policy, id: uid('p') };
      const policies = exists ? state.policies.map((p) => (p.id === policy.id ? policy : p)) : [...state.policies, policy];
      return { ...state, policies, audit: audit(state, exists ? 'Edited policy' : 'Created policy', policy.name) };
    }
    case 'DELETE_POLICY': {
      const p = state.policies.find((x) => x.id === a.id);
      return { ...state, policies: state.policies.filter((x) => x.id !== a.id), audit: audit(state, 'Deleted policy', p?.name) };
    }

    case 'INVITE_USER': {
      if (!canAddUser(state)) return state;
      const u = { ...a.user, id: uid('u-'), status: 'invited', mfa: false };
      return { ...state, users: [...state.users, u], audit: audit(state, 'Invited user', `${u.name} as ${u.role}`) };
    }
    case 'UPDATE_USER': {
      const u = state.users.find((x) => x.id === a.id);
      return {
        ...state,
        users: state.users.map((x) => (x.id === a.id ? { ...x, ...a.patch, ...(a.patch.role === 'viewer' ? { canRelease: false } : {}) } : x)),
        audit: audit(state, 'Updated user', `${u?.name}: ${Object.entries(a.patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`),
      };
    }
    case 'REMOVE_USER': {
      const u = state.users.find((x) => x.id === a.id);
      return {
        ...state,
        users: state.users.map((x) => (x.id === a.id ? { ...x, status: 'removed' } : x)),
        policies: state.policies.map((p) => ({ ...p, approverIds: p.approverIds.filter((id) => id !== a.id) })),
        audit: audit(state, 'Removed user', `${u?.name} (also removed from approver lists)`),
      };
    }

    case 'CHANGE_PLAN': {
      if (planBlockers(state, a.planId).length) return state;
      const t = billingNow(state.billing);
      const timing = planChangeTiming(state.billing, a.planId, t);
      const from = planOf(state).name;
      const to = PLANS[a.planId].name;
      if (timing.when === 'renewal')
        return {
          ...state,
          billing: { ...state.billing, scheduledPlan: { planId: a.planId, at: timing.at } },
          audit: audit(state, 'Scheduled downgrade', `${from} → ${to} from the renewal date`),
        };
      const fee = timing.feeUsd
        ? [{ id: 'SUB-' + (1041 + state.subscriptionInvoices.length), date: t, amountUsd: timing.feeUsd, status: 'paid',
            method: state.billing.paymentMethod.label, period: `Upgrade to ${to}, pro rata to the end of the period` }]
        : [];
      return {
        ...state,
        billing: { ...state.billing, planId: a.planId, scheduledPlan: null },
        subscriptionInvoices: [...fee, ...state.subscriptionInvoices],
        audit: audit(state, 'Changed plan', `${from} → ${to}${timing.feeUsd ? ` (pro-rata fee $${timing.feeUsd.toFixed(2)})` : ''}`),
      };
    }
    case 'CANCEL_PLAN_CHANGE':
      return { ...state, billing: { ...state.billing, scheduledPlan: null }, audit: audit(state, 'Withdrew scheduled downgrade', '') };

    case 'SAVE_INVOICE': {
      const exists = state.invoices.some((i) => i.id === a.invoice.id);
      const next = state.invoices.length + 1;
      const inv = exists
        ? a.invoice
        : { ...a.invoice, id: uid('i'), number: `INV-${String(next).padStart(4, '0')}`, status: 'draft', sentLog: [] };
      return {
        ...state,
        invoices: exists ? state.invoices.map((i) => (i.id === inv.id ? inv : i)) : [inv, ...state.invoices],
        audit: audit(state, exists ? 'Edited invoice' : 'Created invoice', inv.number),
      };
    }
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, a.contact], audit: audit(state, 'Added contact', a.contact.name) };
    case 'SEND_INVOICE': {
      const inv = state.invoices.find((i) => i.id === a.id);
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === a.id ? { ...i, status: i.status === 'paid' ? 'paid' : 'sent', sentLog: [...i.sentLog, { at: now(), to: a.to }] } : i,
        ),
        audit: audit(state, 'Sent invoice', `${inv.number} to ${a.to.join(', ')}`),
      };
    }
    case 'MARK_INVOICE_PAID': {
      const inv = state.invoices.find((i) => i.id === a.id);
      return {
        ...state,
        invoices: state.invoices.map((i) => (i.id === a.id ? { ...i, status: 'paid', paidAt: now(), paidTxId: a.txId || null } : i)),
        transactions: a.txId
          ? state.transactions.map((t) =>
              t.id === a.txId ? { ...t, reconciled: true, category: 'Customer receipt', memo: t.memo || inv.number, invoiceId: inv.id } : t,
            )
          : state.transactions,
        audit: audit(state, 'Marked invoice paid', `${inv.number}${a.txId ? ' (matched to ledger receipt)' : ' (no ledger match)'}`),
      };
    }
    case 'VOID_INVOICE': {
      const inv = state.invoices.find((i) => i.id === a.id);
      return {
        ...state,
        invoices: state.invoices.map((i) => (i.id === a.id ? { ...i, status: 'void' } : i)),
        audit: audit(state, 'Voided invoice', inv.number),
      };
    }

    case 'SET_PAYMENT_METHOD':
      if (paymentMethodBlocker(state.billing, a.method.type, billingNow(state.billing))) return state;
      return { ...state, billing: { ...state.billing, paymentMethod: a.method }, audit: audit(state, 'Changed payment method', a.method.label) };

    case 'SET_BILLING_INTERVAL': {
      const t = billingNow(state.billing);
      if (intervalBlocker(state.billing, a.interval, t)) return state;
      const s = subscriptionStatus(state.billing, t);
      const label = (iv) => INTERVALS[iv].label;
      if (s.phase === 'trial')
        return { ...state, billing: { ...state.billing, interval: a.interval, scheduledInterval: null },
          audit: audit(state, 'Changed billing interval', `${label(state.billing.interval || DEFAULT_INTERVAL)} → ${label(a.interval)}`) };
      const back = a.interval === (state.billing.interval || DEFAULT_INTERVAL);
      return {
        ...state,
        billing: { ...state.billing, scheduledInterval: back ? null : { interval: a.interval, at: s.term.end } },
        audit: audit(state, back ? 'Withdrew billing interval change' : 'Scheduled billing interval change', back ? '' : `${label(a.interval)} from the renewal date`),
      };
    }
    case 'CANCEL_TRIAL':
      if (!canCancelFree(state.billing, billingNow(state.billing))) return state;
      return { ...state, billing: { ...state.billing, cancelledAt: billingNow(state.billing) }, audit: audit(state, 'Cancelled free trial', 'No charge; card authorisation released') };
    case 'UNDO_CANCEL_TRIAL':
      if (subscriptionStatus(state.billing, billingNow(state.billing)).phase !== 'cancelled') return state;
      return { ...state, billing: { ...state.billing, cancelledAt: null }, audit: audit(state, 'Resumed free trial', 'Cancellation withdrawn before the trial ended') };
    case 'CANCEL_RENEWAL': {
      const t = billingNow(state.billing);
      const s = subscriptionStatus(state.billing, t);
      if (s.phase !== 'committed' || state.billing.cancelAt) return state;
      const c = cancellationDate(state.billing, t);
      return {
        ...state,
        billing: { ...state.billing, cancelAt: c.effective },
        audit: audit(state, 'Cancelled subscription', c.late
          ? `Less than 30 days' notice before ${c.renewalDate.slice(0, 10)}: renews once more and ends ${c.effective.slice(0, 10)}`
          : `Takes effect on the renewal date, ${c.effective.slice(0, 10)}`),
      };
    }
    case 'RETRY_PAYMENT': {
      // Demo: the retried charge always succeeds.
      const f = state.billing.paymentFailure;
      if (!f || subscriptionStatus(state.billing, billingNow(state.billing)).phase !== 'committed') return state;
      return {
        ...state,
        billing: { ...state.billing, paymentFailure: null },
        subscriptionInvoices: state.subscriptionInvoices.map((i) => (i.id === f.invoiceId ? { ...i, status: 'paid', method: state.billing.paymentMethod.label, paidAt: billingNow(state.billing) } : i)),
        audit: audit(state, 'Subscription payment settled', `${f.invoiceId} retried with ${state.billing.paymentMethod.label}`),
      };
    }
    case 'DEMO_FAIL_CHARGE': {
      // Prototype only: move the clock to the next charge and make that card charge fail.
      const b = state.billing;
      const t = billingNow(b);
      const ph = subscriptionStatus(b, t).phase;
      const next = nextCharge(b, t);
      if (!['trial', 'committed'].includes(ph) || b.paymentFailure || b.paymentMethod.type !== 'card' || !next) return state;
      return advanceClock(state, next.at, true);
    }
    case 'UNDO_CANCEL_RENEWAL':
      if (subscriptionStatus(state.billing, billingNow(state.billing)).phase !== 'committed') return state;
      return { ...state, billing: { ...state.billing, cancelAt: null }, audit: audit(state, 'Withdrew cancellation', 'Subscription will renew automatically') };
    case 'DEMO_ADVANCE': {
      // Prototype only: move the billing clock forward to show the trial ending, reminders, renewals and the grace period.
      const t = billingNow(state.billing);
      const s = subscriptionStatus(state.billing, t);
      const target = a.to === 'trialEnd' ? s.trialEnds
        : a.to === 'reminder' ? renewalReminders(state.billing, t).find((r) => !r.sent)?.at
        : a.to === 'graceEnd' ? s.pastDue?.graceEnds
        : s.term?.end;
      if (!target || +new Date(target) <= +new Date(t)) return state;
      return advanceClock(state, target, false);
    }

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore — prototype still works without persistence */
    }
  }, [state]);
  const me = useMemo(() => state.users.find((u) => u.id === state.currentUserId), [state.users, state.currentUserId]);
  // Each user picks their own display currency; the organisation's base currency is the default.
  setDisplayCurrency(me?.displayCurrency || state.org.baseCurrency);
  const broadcasting = state.requests.some((r) => r.status === 'broadcast')
    || state.onrampOrders.some((o) => o.status === 'processing') || state.zendOrders.some((o) => o.status === 'processing');
  useEffect(() => {
    if (!broadcasting) return undefined;
    const t = setInterval(() => dispatch({ type: 'CONFIRM_BROADCASTS' }), 1000);
    return () => clearInterval(t);
  }, [broadcasting]);
  return <Ctx.Provider value={{ state, dispatch, me }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
export { usdOf };
