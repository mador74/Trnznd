import { get, set } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import type { AppData, Contact, PaymentRequest, Settings, Transaction, TxCategory, Wallet, ActivityEntry } from './types';
import { uid } from './ids';
import { deriveDirection } from './direction';
import { formatAmount } from './amount';

const KEY = 'settlement-ledger:v1';
const LS_KEY = 'settlement-ledger:v1:fallback';
const MAX_ACTIVITY = 2000;

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'My Company',
  requestPrefix: 'PR-',
  nextRequestNumber: 1,
  toleranceAbs: 1_000_000, // 1.00 token
  tolerancePct: 0.5,
  dateWindowDays: 30,
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
  theme: 'dark',
};

export function emptyData(): AppData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    wallets: [],
    contacts: [],
    requests: [],
    transactions: [],
    allocations: [],
    adjustments: [],
    activity: [],
  };
}

let state: AppData = emptyData();
let hydrated = false;
let persistError: string | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await set(KEY, state);
      persistError = null;
    } catch (e) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
        persistError = null;
      } catch {
        persistError = `Could not save data in this browser: ${(e as Error).message}`;
        emit();
      }
    }
  }, 250);
}

export async function hydrate(): Promise<void> {
  try {
    const saved = (await get(KEY)) as AppData | undefined;
    if (saved && saved.version === 1) state = normalise(saved);
    else {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) state = normalise(JSON.parse(ls));
    }
  } catch {
    try {
      const ls = localStorage.getItem(LS_KEY);
      if (ls) state = normalise(JSON.parse(ls));
    } catch {
      // Storage is blocked (e.g. a sandboxed or private view): run in memory and say so.
      persistError = 'This browser view does not allow saving, so changes will be lost when the page closes. Download a backup from Reports & export to keep your work.';
    }
  } finally {
    hydrated = true;
    emit();
  }
}

/** Fill in fields added in later versions so older backups keep loading. */
export function normalise(d: Partial<AppData>): AppData {
  const base = emptyData();
  return {
    version: 1,
    settings: { ...base.settings, ...(d.settings ?? {}) },
    wallets: d.wallets ?? [],
    contacts: d.contacts ?? [],
    requests: d.requests ?? [],
    transactions: d.transactions ?? [],
    allocations: d.allocations ?? [],
    adjustments: d.adjustments ?? [],
    activity: d.activity ?? [],
  };
}

export function getState(): AppData {
  return state;
}

/** For tests: replace state without persisting. */
export function setStateForTest(d: AppData) {
  state = d;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => state);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => hydrated);
}

export function usePersistError(): string | null {
  return useSyncExternalStore(subscribe, () => persistError);
}

function commit(next: AppData, action?: string, detail?: string) {
  if (action) {
    const entry: ActivityEntry = { id: uid('act'), at: new Date().toISOString(), action, detail: detail ?? '' };
    next = { ...next, activity: [entry, ...next.activity].slice(0, MAX_ACTIVITY) };
  }
  state = next;
  schedulePersist();
  emit();
}

const nowIso = () => new Date().toISOString();

// ---------- settings ----------
export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

// ---------- wallets ----------
export { deriveDirection };
function rederive(transactions: Transaction[], wallets: Wallet[]): Transaction[] {
  return transactions.map((t) => {
    const r = deriveDirection(t, wallets);
    if (!r || (r.direction === t.direction && r.walletId === t.walletId)) return t;
    return { ...t, ...r };
  });
}

export function addWallet(w: Omit<Wallet, 'id' | 'createdAt'>): Wallet {
  const wallet: Wallet = { ...w, address: w.address.trim(), id: uid('w'), createdAt: nowIso() };
  const wallets = [...state.wallets, wallet];
  commit({ ...state, wallets, transactions: rederive(state.transactions, wallets) }, 'Wallet added', `${wallet.label} (${wallet.chain})`);
  return wallet;
}

export function updateWallet(id: string, patch: Partial<Wallet>, log = true) {
  const wallets = state.wallets.map((w) => (w.id === id ? { ...w, ...patch } : w));
  const w = wallets.find((x) => x.id === id);
  commit({ ...state, wallets }, log && patch.label ? 'Wallet updated' : undefined, w?.label);
}

export function removeWallet(id: string, removeTransactions: boolean) {
  const w = state.wallets.find((x) => x.id === id);
  const wallets = state.wallets.filter((x) => x.id !== id);
  let transactions = state.transactions;
  let allocations = state.allocations;
  if (removeTransactions) {
    const drop = new Set(transactions.filter((t) => t.walletId === id).map((t) => t.id));
    transactions = transactions.filter((t) => !drop.has(t.id));
    allocations = allocations.filter((a) => !drop.has(a.txId));
  }
  transactions = rederive(transactions, wallets);
  const requests = state.requests.map((r) => (r.walletId === id ? { ...r, walletId: undefined } : r));
  commit({ ...state, wallets, transactions, allocations, requests }, 'Wallet removed', `${w?.label ?? id}${removeTransactions ? ' (with its transactions)' : ''}`);
}

// ---------- contacts ----------
export function saveContact(c: Omit<Contact, 'id'> & { id?: string }): Contact {
  const contact: Contact = { ...c, id: c.id ?? uid('c') };
  const exists = state.contacts.some((x) => x.id === contact.id);
  const contacts = exists ? state.contacts.map((x) => (x.id === contact.id ? contact : x)) : [...state.contacts, contact];
  commit({ ...state, contacts }, exists ? 'Contact updated' : 'Contact added', contact.name);
  return contact;
}

export function removeContact(id: string) {
  const c = state.contacts.find((x) => x.id === id);
  const requests = state.requests.map((r) => (r.contactId === id ? { ...r, contactId: undefined } : r));
  commit({ ...state, contacts: state.contacts.filter((x) => x.id !== id), requests }, 'Contact removed', c?.name);
}

// ---------- payment requests ----------
export type RequestInput = Omit<PaymentRequest, 'id' | 'number' | 'createdAt' | 'updatedAt'> & { number?: string };

export function nextRequestNumber(): string {
  const s = state.settings;
  return `${s.requestPrefix}${String(s.nextRequestNumber).padStart(4, '0')}`;
}

export function createRequest(input: RequestInput): PaymentRequest {
  const auto = !input.number;
  const number = input.number?.trim() || nextRequestNumber();
  const req: PaymentRequest = { ...input, number, reference: input.reference?.trim() || number, id: uid('pr'), createdAt: nowIso(), updatedAt: nowIso() };
  const settings = auto ? { ...state.settings, nextRequestNumber: state.settings.nextRequestNumber + 1 } : state.settings;
  commit({ ...state, settings, requests: [...state.requests, req] }, 'Payment request created', `${req.number} · ${req.counterparty} · ${formatAmount(req.amount)} ${req.token}`);
  return req;
}

/** Bulk import; returns how many were added and which numbers were skipped as duplicates. */
export function importRequests(inputs: RequestInput[]): { added: number; duplicates: string[] } {
  const existing = new Set(state.requests.map((r) => r.number.toLowerCase()));
  const duplicates: string[] = [];
  const added: PaymentRequest[] = [];
  let n = state.settings.nextRequestNumber;
  for (const input of inputs) {
    let number = input.number?.trim();
    if (!number) number = `${state.settings.requestPrefix}${String(n++).padStart(4, '0')}`;
    if (existing.has(number.toLowerCase())) {
      duplicates.push(number);
      continue;
    }
    existing.add(number.toLowerCase());
    added.push({ ...input, number, reference: input.reference?.trim() || number, id: uid('pr'), createdAt: nowIso(), updatedAt: nowIso() });
  }
  commit({ ...state, settings: { ...state.settings, nextRequestNumber: n }, requests: [...state.requests, ...added] }, 'Payment requests imported', `${added.length} added, ${duplicates.length} duplicates skipped`);
  return { added: added.length, duplicates };
}

export function updateRequest(id: string, patch: Partial<PaymentRequest>) {
  const requests = state.requests.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r));
  const r = requests.find((x) => x.id === id);
  const what = patch.voided === true ? 'Payment request voided' : patch.voided === false ? 'Payment request reinstated' : 'Payment request edited';
  commit({ ...state, requests }, what, r?.number);
}

export function deleteRequest(id: string) {
  const r = state.requests.find((x) => x.id === id);
  if (state.allocations.some((a) => a.requestId === id)) throw new Error('Unmatch its transactions before deleting this request.');
  commit(
    { ...state, requests: state.requests.filter((x) => x.id !== id), adjustments: state.adjustments.filter((a) => a.requestId !== id) },
    'Payment request deleted',
    r?.number,
  );
}

// ---------- transactions ----------
export function addTransactions(txs: Transaction[], sourceLabel: string): { added: number; duplicates: number } {
  const existing = new Set(state.transactions.map((t) => t.id));
  const fresh: Transaction[] = [];
  let duplicates = 0;
  for (const t of txs) {
    if (existing.has(t.id)) {
      duplicates++;
      continue;
    }
    existing.add(t.id);
    fresh.push(t);
  }
  if (fresh.length || duplicates) {
    commit({ ...state, transactions: [...state.transactions, ...fresh] }, fresh.length ? 'Transactions imported' : undefined, `${fresh.length} new from ${sourceLabel}, ${duplicates} already present`);
  }
  return { added: fresh.length, duplicates };
}

export function updateTransaction(id: string, patch: Partial<Pick<Transaction, 'category' | 'note' | 'memo'>>) {
  const transactions = state.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t));
  const t = transactions.find((x) => x.id === id);
  let action: string | undefined;
  if ('category' in patch) action = patch.category ? 'Transaction explained' : 'Explanation removed';
  else if ('note' in patch) action = 'Transaction note edited';
  commit({ ...state, transactions }, action, t ? `${t.hash.slice(0, 12)}… ${patch.category ?? ''}` : id);
}

export function deleteTransaction(id: string) {
  const t = state.transactions.find((x) => x.id === id);
  commit(
    { ...state, transactions: state.transactions.filter((x) => x.id !== id), allocations: state.allocations.filter((a) => a.txId !== id) },
    'Transaction deleted',
    t ? `${t.hash.slice(0, 16)}… ${formatAmount(t.amount)} ${t.token}` : id,
  );
}

// ---------- reconciliation ----------
export interface AllocationInput {
  requestId: string;
  amount: number;
}

export function allocate(txId: string, items: AllocationInput[], method: 'auto' | 'manual', writeOffs: { requestId: string; amount: number; reason: string }[] = []) {
  const tx = state.transactions.find((t) => t.id === txId);
  if (!tx) throw new Error('Transaction not found');
  const already = state.allocations.filter((a) => a.txId === txId).reduce((a, x) => a + x.amount, 0);
  const total = items.reduce((a, x) => a + x.amount, 0);
  if (items.some((i) => !(i.amount > 0))) throw new Error('Allocation amounts must be greater than zero');
  if (already + total > tx.amount) throw new Error('Allocations exceed the transaction amount');
  const at = nowIso();
  const allocations = [...state.allocations, ...items.map((i) => ({ id: uid('al'), txId, requestId: i.requestId, amount: i.amount, method, createdAt: at }))];
  const adjustments = [...state.adjustments, ...writeOffs.filter((w) => w.amount > 0).map((w) => ({ id: uid('adj'), requestId: w.requestId, amount: w.amount, reason: w.reason, createdAt: at }))];
  const numbers = items.map((i) => state.requests.find((r) => r.id === i.requestId)?.number ?? i.requestId).join(', ');
  commit({ ...state, allocations, adjustments }, method === 'auto' ? 'Auto-matched' : 'Matched', `${formatAmount(total)} ${tx.token} from ${tx.hash.slice(0, 12)}… → ${numbers}`);
}

export function applySuggestions(list: { txId: string; allocations: AllocationInput[] }[]): number {
  let applied = 0;
  for (const s of list) {
    try {
      allocate(s.txId, s.allocations, 'auto');
      applied++;
    } catch {
      /* skip conflicting suggestion */
    }
  }
  return applied;
}

export function removeAllocation(id: string) {
  const a = state.allocations.find((x) => x.id === id);
  if (!a) return;
  const r = state.requests.find((x) => x.id === a.requestId);
  commit({ ...state, allocations: state.allocations.filter((x) => x.id !== id) }, 'Unmatched', `${formatAmount(a.amount)} from ${r?.number ?? a.requestId}`);
}

export function unmatchTransaction(txId: string) {
  const n = state.allocations.filter((a) => a.txId === txId).length;
  if (!n) return;
  commit({ ...state, allocations: state.allocations.filter((a) => a.txId !== txId) }, 'Unmatched', `${n} allocation(s) removed from transaction`);
}

export function categorize(txId: string, category: TxCategory | undefined, note?: string) {
  updateTransaction(txId, note !== undefined ? { category, note } : { category });
}

export function addAdjustment(requestId: string, amount: number, reason: string) {
  const r = state.requests.find((x) => x.id === requestId);
  commit({ ...state, adjustments: [...state.adjustments, { id: uid('adj'), requestId, amount, reason, createdAt: nowIso() }] }, 'Difference written off', `${formatAmount(amount)} on ${r?.number}: ${reason}`);
}

export function removeAdjustment(id: string) {
  const a = state.adjustments.find((x) => x.id === id);
  commit({ ...state, adjustments: state.adjustments.filter((x) => x.id !== id) }, 'Write-off removed', a ? formatAmount(a.amount) : id);
}

// ---------- data management ----------
export function replaceAll(data: AppData, action = 'Data restored from backup') {
  commit(normalise(data), action, `${data.requests?.length ?? 0} requests, ${data.transactions?.length ?? 0} transactions`);
}

export function resetAll() {
  commit(emptyData(), 'All data cleared');
}
