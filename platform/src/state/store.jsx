import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { buildSeed } from '../data/seed.js';
import { setDisplayCurrency } from '../lib/format.js';
import { DISPLAY_CURRENCIES } from '../lib/fx.js';
import { canAddConnection, canAddUser, planBlockers, planOf, PLANS } from '../lib/plans.js';
import { deriveStatus } from '../lib/policy.js';
import { balances, usdOf } from '../lib/ledger.js';
import { cannotReleaseReason, sourceBlockReason } from '../lib/send.js';
import { convertBlockReason, defaultConvertKinds, quote } from '../lib/convert.js';

// Prototype persistence: browser storage only. A production build replaces this with
// the API described in platform/ARCHITECTURE.md.
const KEY = 'trnznd-treasury-v5';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.version === 5) return s;
    }
  } catch {
    /* storage unavailable — fall through to seed */
  }
  return buildSeed();
}

const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

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
    category: r.type === 'internal_transfer' ? 'Internal transfer' : 'Supplier payment', reconciled: true,
    memo: r.reference, requestId: r.id, internal: r.type === 'internal_transfer',
  };
  return {
    ...state,
    requests: state.requests.map((x) => (x.id === r.id ? { ...x, status: 'executed', executedAt: now(), executedTxHash: txHash } : x)),
    transactions: [tx, ...state.transactions],
  };
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
    case 'CONFIRM_BROADCASTS': {
      // Demo stand-in for the provider: it executes the instruction a few seconds later and reports the
      // on-chain hash back, which TRNZIT then records in the ledger.
      const due = state.requests.filter((r) => r.status === 'broadcast' && Date.now() - new Date(r.broadcastAt).getTime() > 4000);
      if (!due.length) return state;
      let next = state;
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
      return {
        ...state,
        billing: { ...state.billing, planId: a.planId },
        audit: audit(state, 'Changed plan', `${planOf(state).name} → ${PLANS[a.planId].name}`),
      };
    }

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
      return { ...state, billing: { ...state.billing, paymentMethod: a.method }, audit: audit(state, 'Changed payment method', a.method.label) };

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
  const broadcasting = state.requests.some((r) => r.status === 'broadcast');
  useEffect(() => {
    if (!broadcasting) return undefined;
    const t = setInterval(() => dispatch({ type: 'CONFIRM_BROADCASTS' }), 1000);
    return () => clearInterval(t);
  }, [broadcasting]);
  return <Ctx.Provider value={{ state, dispatch, me }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
export { usdOf };
