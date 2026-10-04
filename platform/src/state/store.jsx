import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { buildSeed, MAX_SUB_USERS } from '../data/seed.js';
import { deriveStatus } from '../lib/policy.js';
import { usdOf } from '../lib/ledger.js';

// Prototype persistence: browser storage only. A production build replaces this with
// the API described in platform/ARCHITECTURE.md.
const KEY = 'trnznd-treasury-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.version === 1) return s;
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

export const subUserCount = (users) => users.filter((u) => u.role !== 'owner' && u.status !== 'removed').length;

function describe(req) {
  if (req.type === 'address_whitelist') return `Whitelist ${req.to}`;
  return `${req.amount.toLocaleString('en-US')} ${req.asset} to ${req.to}`;
}

function reducer(state, a) {
  switch (a.type) {
    case 'RESET':
      return buildSeed();
    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: a.userId };

    case 'ADD_CONNECTION': {
      const c = { ...a.connection, id: uid('c-'), status: 'connected', lastSync: now(), connectedAt: now() };
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
      const req = { ...a.request, id: uid('r'), requestedBy: state.currentUserId, createdAt: now(), approvals: [], rejections: [], status: 'pending' };
      return { ...state, requests: [req, ...state.requests], audit: audit(state, 'Created request', describe(req)) };
    }
    case 'SIGN_REQUEST': {
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
      const tx = {
        id: uid('t'), connectionId: r.connectionId, date: now(), type: r.type === 'internal_transfer' ? 'transfer_out' : 'withdrawal',
        asset: r.asset, amount: -r.amount, counterparty: r.to, counterpartyAddress: r.toAddress, txHash: a.txHash,
        category: r.type === 'internal_transfer' ? 'Internal transfer' : 'Supplier payment', reconciled: true,
        memo: r.reference, requestId: r.id, internal: r.type === 'internal_transfer',
      };
      return {
        ...state,
        requests: state.requests.map((x) => (x.id === a.id ? { ...x, status: 'executed', executedAt: now(), executedTxHash: a.txHash } : x)),
        transactions: [tx, ...state.transactions],
        audit: audit(state, 'Recorded execution', `${describe(r)} · ${a.txHash}`),
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
      if (subUserCount(state.users) >= MAX_SUB_USERS) return state;
      const u = { ...a.user, id: uid('u-'), status: 'invited', mfa: false };
      return { ...state, users: [...state.users, u], audit: audit(state, 'Invited user', `${u.name} as ${u.role}`) };
    }
    case 'UPDATE_USER': {
      const u = state.users.find((x) => x.id === a.id);
      return {
        ...state,
        users: state.users.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)),
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
  return <Ctx.Provider value={{ state, dispatch, me }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
export { usdOf };
