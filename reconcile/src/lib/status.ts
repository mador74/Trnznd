import type { AppData, PaymentRequest, Transaction, Allocation, Adjustment } from './types';
import { todayISO } from './dates';

export type RequestStatus = 'open' | 'overdue' | 'partial' | 'paid' | 'overpaid' | 'void';
export type TxStatus = 'unmatched' | 'partial' | 'matched' | 'excluded';

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: 'Open',
  overdue: 'Overdue',
  partial: 'Part paid',
  paid: 'Paid',
  overpaid: 'Overpaid',
  void: 'Void',
};
export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  unmatched: 'Unreconciled',
  partial: 'Part allocated',
  matched: 'Reconciled',
  excluded: 'Explained',
};

export interface Derived {
  allocByTx: Map<string, Allocation[]>;
  allocByRequest: Map<string, Allocation[]>;
  adjByRequest: Map<string, Adjustment[]>;
  txById: Map<string, Transaction>;
  requestById: Map<string, PaymentRequest>;
  /** micro-units settled against each request (allocations + adjustments) */
  settled: Map<string, number>;
  /** micro-units allocated from each transaction */
  allocated: Map<string, number>;
  requestStatus: Map<string, RequestStatus>;
  txStatus: Map<string, TxStatus>;
}

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function requestStatusOf(req: PaymentRequest, settledAmount: number, today = todayISO()): RequestStatus {
  if (req.voided) return 'void';
  if (settledAmount <= 0) return req.dueDate && req.dueDate < today ? 'overdue' : 'open';
  if (settledAmount < req.amount) return 'partial';
  if (settledAmount === req.amount) return 'paid';
  return 'overpaid';
}

export function txStatusOf(tx: Transaction, allocatedAmount: number): TxStatus {
  if (allocatedAmount <= 0) return tx.category ? 'excluded' : 'unmatched';
  if (allocatedAmount >= tx.amount) return 'matched';
  // A remainder that has been explained (e.g. overpayment held as credit) counts as reconciled.
  return tx.category ? 'matched' : 'partial';
}

/** Internal transfers between the company's own wallets never need a payment request. */
export function needsReconciliation(tx: Transaction, status: TxStatus): boolean {
  if (tx.direction === 'internal') return false;
  return status === 'unmatched' || status === 'partial';
}

export function derive(data: AppData, today = todayISO()): Derived {
  const allocByTx = group(data.allocations, (a) => a.txId);
  const allocByRequest = group(data.allocations, (a) => a.requestId);
  const adjByRequest = group(data.adjustments, (a) => a.requestId);
  const txById = new Map(data.transactions.map((t) => [t.id, t]));
  const requestById = new Map(data.requests.map((r) => [r.id, r]));
  const settled = new Map<string, number>();
  const allocated = new Map<string, number>();
  const requestStatus = new Map<string, RequestStatus>();
  const txStatus = new Map<string, TxStatus>();
  for (const r of data.requests) {
    const s =
      (allocByRequest.get(r.id) ?? []).reduce((a, x) => a + x.amount, 0) +
      (adjByRequest.get(r.id) ?? []).reduce((a, x) => a + x.amount, 0);
    settled.set(r.id, s);
    requestStatus.set(r.id, requestStatusOf(r, s, today));
  }
  for (const t of data.transactions) {
    const a = (allocByTx.get(t.id) ?? []).reduce((acc, x) => acc + x.amount, 0);
    allocated.set(t.id, a);
    txStatus.set(t.id, txStatusOf(t, a));
  }
  return { allocByTx, allocByRequest, adjByRequest, txById, requestById, settled, allocated, requestStatus, txStatus };
}

export function outstanding(req: PaymentRequest, d: Derived): number {
  return req.amount - (d.settled.get(req.id) ?? 0);
}

export function txRemaining(tx: Transaction, d: Derived): number {
  return tx.amount - (d.allocated.get(tx.id) ?? 0);
}

/** Last date a request was settled (latest allocated transaction), for exports. */
export function settledOn(req: PaymentRequest, d: Derived): string | undefined {
  const allocs = d.allocByRequest.get(req.id) ?? [];
  let latest: string | undefined;
  for (const a of allocs) {
    const t = d.txById.get(a.txId);
    if (t && (!latest || t.timestamp > latest)) latest = t.timestamp;
  }
  return latest;
}
