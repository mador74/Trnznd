import type { AppData, PaymentRequest, Transaction } from './types';
import { sameAddress } from './chains';
import { addDays } from './dates';
import { formatAmount } from './amount';
import { type Derived, outstanding, txRemaining, needsReconciliation } from './status';

export type Confidence = 'high' | 'medium' | 'low';

export interface Suggestion {
  txId: string;
  /** One entry per request the transaction should be allocated to. */
  allocations: { requestId: string; amount: number }[];
  score: number;
  confidence: Confidence;
  reasons: string[];
}

export const HIGH = 85;
export const MEDIUM = 55;
const MIN_SCORE = 30;
const MAX_COMBO_CANDIDATES = 25;

export function confidenceOf(score: number): Confidence {
  return score >= HIGH ? 'high' : score >= MEDIUM ? 'medium' : 'low';
}

export function toleranceFor(amount: number, data: AppData): number {
  const pct = Math.round((Math.abs(amount) * (data.settings.tolerancePct || 0)) / 100);
  return Math.max(data.settings.toleranceAbs || 0, pct);
}

/** Normalise for reference comparison: case-insensitive, alphanumerics only. */
function normRef(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function memoMentions(memo: string | undefined, req: PaymentRequest): boolean {
  if (!memo) return false;
  const m = normRef(memo);
  if (!m) return false;
  return [req.reference, req.number].some((r) => {
    const n = normRef(r ?? '');
    return n.length >= 3 && m.includes(n);
  });
}

/** True when the request amount carries a non-round sub-cent fingerprint (see uniqueAmount). */
export function isFingerprinted(amount: number): boolean {
  return amount % 10_000 !== 0;
}

/** The wallet on the other side of the transfer. */
export function counterpartyOf(tx: Transaction): string {
  return tx.direction === 'out' ? tx.to : tx.from;
}

export function expectedAddresses(req: PaymentRequest, data: AppData): string[] {
  const out: string[] = [];
  if (req.counterpartyAddress) out.push(req.counterpartyAddress);
  if (req.contactId) {
    const c = data.contacts.find((x) => x.id === req.contactId);
    for (const a of c?.addresses ?? []) if (a.chain === req.chain) out.push(a.address);
  }
  return out;
}

/** Whether a request could in principle be settled by this transaction. */
export function eligible(tx: Transaction, req: PaymentRequest, d: Derived): boolean {
  if (req.voided) return false;
  if (req.chain !== tx.chain || req.token !== tx.token) return false;
  if (tx.direction === 'in' && req.kind !== 'receivable') return false;
  if (tx.direction === 'out' && req.kind !== 'payable') return false;
  if (tx.direction === 'internal') return false;
  if (req.walletId && tx.walletId && req.walletId !== tx.walletId) return false;
  return outstanding(req, d) > 0;
}

interface Scored {
  score: number;
  reasons: string[];
}

function scoreCommon(tx: Transaction, req: PaymentRequest, data: AppData): Scored {
  let score = 0;
  const reasons: string[] = [];
  if (memoMentions(tx.memo, req)) {
    score += 40;
    reasons.push('Reference found in memo');
  }
  const expected = expectedAddresses(req, data);
  if (expected.length) {
    if (expected.some((a) => sameAddress(tx.chain, a, counterpartyOf(tx)))) {
      score += 30;
      reasons.push('Known counterparty wallet');
    } else {
      score -= 10;
      reasons.push('Different wallet than expected');
    }
  }
  if (req.walletId && req.walletId === tx.walletId) score += 5;
  const day = tx.timestamp.slice(0, 10);
  const windowEnd = addDays(req.dueDate ?? req.issueDate, data.settings.dateWindowDays);
  if (day < addDays(req.issueDate, -1)) {
    score -= 25;
    reasons.push('Paid before the request date');
  } else if (day <= windowEnd) {
    score += 10;
    reasons.push('Within date window');
  } else {
    reasons.push('Paid after date window');
  }
  return { score, reasons };
}

function scoreSingle(tx: Transaction, req: PaymentRequest, data: AppData, d: Derived, exactCount: number): Suggestion | null {
  const rem = txRemaining(tx, d);
  const out = outstanding(req, d);
  if (rem <= 0 || out <= 0) return null;
  const tol = toleranceFor(req.amount, data);
  const diff = rem - out;
  let score = 0;
  const reasons: string[] = [];
  let alloc = Math.min(rem, out);
  if (diff === 0) {
    score += 50;
    reasons.push('Exact amount');
    if (exactCount === 1) {
      score += 15;
      reasons.push('Only open request with this amount');
    }
    if (isFingerprinted(req.amount)) {
      score += 20;
      reasons.push('Unique fingerprinted amount');
    }
  } else if (Math.abs(diff) <= tol) {
    score += 35;
    reasons.push(`${diff < 0 ? 'Short' : 'Over'} by ${formatAmount(Math.abs(diff))} (within tolerance)`);
    alloc = Math.min(rem, out);
  } else if (diff < 0) {
    score += 10;
    reasons.push('Partial payment');
  } else {
    score += 5;
    reasons.push('Payment exceeds amount due');
  }
  const common = scoreCommon(tx, req, data);
  score += common.score;
  reasons.push(...common.reasons);
  if (score < MIN_SCORE) return null;
  return { txId: tx.id, allocations: [{ requestId: req.id, amount: alloc }], score, confidence: confidenceOf(score), reasons };
}

/** One transaction paying two or three open requests at once (exact total within tolerance). */
function comboSuggestions(tx: Transaction, cands: PaymentRequest[], data: AppData, d: Derived): Suggestion[] {
  const rem = txRemaining(tx, d);
  const cp = counterpartyOf(tx);
  // Prefer requests from the same counterparty wallet; fall back to the closest-dated ones.
  const sameParty = cands.filter((r) => expectedAddresses(r, data).some((a) => sameAddress(tx.chain, a, cp)));
  const pool = (sameParty.length >= 2 ? sameParty : cands)
    .slice()
    .sort((a, b) => Math.abs(Date.parse(a.issueDate) - Date.parse(tx.timestamp)) - Math.abs(Date.parse(b.issueDate) - Date.parse(tx.timestamp)))
    .slice(0, MAX_COMBO_CANDIDATES);
  const outs = pool.map((r) => outstanding(r, d));
  const res: Suggestion[] = [];
  const consider = (idx: number[]) => {
    const total = idx.reduce((a, i) => a + outs[i], 0);
    const reqs = idx.map((i) => pool[i]);
    const tol = toleranceFor(total, data);
    if (Math.abs(total - rem) > tol) return;
    let score = total === rem ? 45 : 30;
    const reasons = [`Total of ${idx.length} open requests${total === rem ? '' : ' (within tolerance)'}`];
    const parties = reqs.map((r) => expectedAddresses(r, data).some((a) => sameAddress(tx.chain, a, cp)));
    if (parties.every(Boolean)) {
      score += 30;
      reasons.push('All from this counterparty wallet');
    }
    const memoHits = reqs.filter((r) => memoMentions(tx.memo, r)).length;
    if (memoHits) {
      score += Math.min(30, memoHits * 15);
      reasons.push('Reference(s) found in memo');
    }
    if (reqs.every((r) => tx.timestamp.slice(0, 10) >= addDays(r.issueDate, -1))) score += 10;
    if (score < MIN_SCORE) return;
    res.push({
      txId: tx.id,
      allocations: reqs.map((r, k) => ({ requestId: r.id, amount: outs[idx[k]] })),
      score,
      confidence: confidenceOf(score),
      reasons,
    });
  };
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      consider([i, j]);
      for (let k = j + 1; k < pool.length; k++) consider([i, j, k]);
    }
  // If allocations must not exceed the transaction (within tolerance shortfall), trim the last one.
  for (const s of res) {
    const total = s.allocations.reduce((a, x) => a + x.amount, 0);
    if (total > rem) s.allocations[s.allocations.length - 1].amount -= total - rem;
  }
  return res;
}

export function suggestForTx(tx: Transaction, data: AppData, d: Derived): Suggestion[] {
  const status = d.txStatus.get(tx.id) ?? 'unmatched';
  if (!needsReconciliation(tx, status)) return [];
  const rem = txRemaining(tx, d);
  if (rem <= 0) return [];
  const cands = data.requests.filter((r) => eligible(tx, r, d));
  if (!cands.length) return [];
  const exactCount = cands.filter((r) => outstanding(r, d) === rem).length;
  const out: Suggestion[] = [];
  for (const r of cands) {
    const s = scoreSingle(tx, r, data, d, exactCount);
    if (s) out.push(s);
  }
  const hasStrongSingle = out.some((s) => s.score >= MEDIUM && s.reasons.includes('Exact amount'));
  if (!hasStrongSingle && cands.length >= 2) out.push(...comboSuggestions(tx, cands, data, d));
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function suggestAll(data: AppData, d: Derived): Map<string, Suggestion[]> {
  const m = new Map<string, Suggestion[]>();
  for (const tx of data.transactions) {
    const s = suggestForTx(tx, data, d);
    if (s.length) m.set(tx.id, s);
  }
  return m;
}

/**
 * Pick high-confidence suggestions that are safe to apply without review:
 * the best suggestion for its transaction, clearly ahead of the runner-up, and not
 * competing with another transaction's high-confidence claim on the same request.
 */
export function autoMatchPlan(data: AppData, d: Derived): Suggestion[] {
  const all = suggestAll(data, d);
  const best: Suggestion[] = [];
  for (const list of all.values()) {
    const [top, second] = list;
    if (!top || top.confidence !== 'high') continue;
    if (second && second.score >= top.score - 10) continue; // ambiguous
    best.push(top);
  }
  const claims = new Map<string, number>();
  for (const s of best) for (const a of s.allocations) claims.set(a.requestId, (claims.get(a.requestId) ?? 0) + 1);
  return best.filter((s) => s.allocations.every((a) => claims.get(a.requestId) === 1)).sort((a, b) => b.score - a.score);
}

/**
 * Add a sub-cent fingerprint (0.0001 to 0.0099) so the request amount is unique among open
 * requests on the same chain and token. Makes exact-amount matching unambiguous.
 */
export function uniqueAmount(base: number, existing: number[], rand: () => number = Math.random): number {
  const taken = new Set(existing);
  const rounded = Math.floor(base / 10_000) * 10_000;
  for (let i = 0; i < 200; i++) {
    const cents = 1 + Math.floor(rand() * 99); // 1..99 hundredths of a cent
    const v = rounded + cents * 100;
    if (!taken.has(v)) return v;
  }
  return base;
}
