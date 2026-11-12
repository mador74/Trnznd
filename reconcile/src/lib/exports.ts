import type { AppData, Chain, Token, Transaction } from './types';
import { CATEGORY_LABELS } from './types';
import { toDecimalString } from './amount';
import { toCSV } from './csv';
import { CHAIN_NAMES, explorerTxUrl, sameAddress } from './chains';
import { type ExportDateFormat, formatExportDate } from './dates';
import { type Derived, REQUEST_STATUS_LABEL, TX_STATUS_LABEL, outstanding, settledOn, txRemaining } from './status';
import { counterpartyOf } from './match';

export interface TxFilter {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  walletIds?: string[];
  chains?: Chain[];
  tokens?: Token[];
  status?: 'all' | 'reconciled' | 'unreconciled';
}

export function filterTransactions(data: AppData, d: Derived, f: TxFilter): Transaction[] {
  return data.transactions
    .filter((t) => {
      const day = t.timestamp.slice(0, 10);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      if (f.walletIds?.length && !f.walletIds.includes(t.walletId ?? '')) return false;
      if (f.chains?.length && !f.chains.includes(t.chain)) return false;
      if (f.tokens?.length && !f.tokens.includes(t.token)) return false;
      const st = d.txStatus.get(t.id);
      const done = t.direction === 'internal' || st === 'matched' || st === 'excluded';
      if (f.status === 'reconciled' && !done) return false;
      if (f.status === 'unreconciled' && done) return false;
      return true;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

const dec = (micro: number) => toDecimalString(micro, 2);

export function transactionHistoryCSV(data: AppData, d: Derived, txs: Transaction[], fmt: ExportDateFormat): string {
  const wallets = new Map(data.wallets.map((w) => [w.id, w]));
  const headers = [
    'Date', 'Time (UTC)', 'Chain', 'Token', 'Direction', 'Amount', 'Signed amount', 'Wallet', 'Wallet address', 'Counterparty address',
    'From', 'To', 'Transaction hash', 'Explorer URL', 'Memo', 'Status', 'Matched requests', 'Counterparties', 'Allocated', 'Unallocated',
    'Explanation', 'Note', 'Source',
  ];
  const rows = txs.map((t) => {
    const w = t.walletId ? wallets.get(t.walletId) : undefined;
    const allocs = d.allocByTx.get(t.id) ?? [];
    const reqs = allocs.map((a) => d.requestById.get(a.requestId)).filter(Boolean);
    const signed = t.direction === 'out' ? -t.amount : t.direction === 'in' ? t.amount : 0;
    return [
      formatExportDate(t.timestamp, fmt), t.timestamp.slice(11, 19), CHAIN_NAMES[t.chain], t.token, t.direction, dec(t.amount), dec(signed),
      w?.label ?? '', w?.address ?? '', t.direction === 'internal' ? '' : counterpartyOf(t), t.from, t.to, t.hash,
      t.source === 'demo' ? '' : explorerTxUrl(t.chain, t.hash), t.memo ?? '',
      t.direction === 'internal' ? 'Internal transfer' : TX_STATUS_LABEL[d.txStatus.get(t.id) ?? 'unmatched'],
      reqs.map((r) => r!.number).join('; '), [...new Set(reqs.map((r) => r!.counterparty))].join('; '),
      dec(d.allocated.get(t.id) ?? 0), dec(txRemaining(t, d)), t.category ? CATEGORY_LABELS[t.category] : '', t.note ?? '', t.source,
    ];
  });
  return toCSV(headers, rows);
}

export function requestsCSV(data: AppData, d: Derived, fmt: ExportDateFormat): string {
  const wallets = new Map(data.wallets.map((w) => [w.id, w]));
  const headers = [
    'Number', 'Kind', 'Counterparty', 'Chain', 'Token', 'Amount', 'Settled', 'Outstanding', 'Written off', 'Status', 'Issue date', 'Due date',
    'Settled on', 'Reference', 'Description', 'Our wallet', 'Counterparty address', 'Settlement transactions',
  ];
  const rows = [...data.requests]
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number))
    .map((r) => {
      const allocs = d.allocByRequest.get(r.id) ?? [];
      const adj = (d.adjByRequest.get(r.id) ?? []).reduce((a, x) => a + x.amount, 0);
      const so = settledOn(r, d);
      return [
        r.number, r.kind, r.counterparty, CHAIN_NAMES[r.chain], r.token, dec(r.amount), dec(d.settled.get(r.id) ?? 0), dec(Math.max(0, outstanding(r, d))),
        dec(adj), REQUEST_STATUS_LABEL[d.requestStatus.get(r.id) ?? 'open'], formatExportDate(r.issueDate, fmt), r.dueDate ? formatExportDate(r.dueDate, fmt) : '',
        so ? formatExportDate(so, fmt) : '', r.reference, r.description ?? '', r.walletId ? wallets.get(r.walletId)?.label ?? '' : '', r.counterpartyAddress ?? '',
        allocs.map((a) => d.txById.get(a.txId)?.hash ?? '').join('; '),
      ];
    });
  return toCSV(headers, rows);
}

/** One row per allocation and per write-off: the audit trail of how each request was settled. */
export function reconciliationCSV(data: AppData, d: Derived, fmt: ExportDateFormat): string {
  const headers = ['Request', 'Counterparty', 'Kind', 'Chain', 'Token', 'Type', 'Amount', 'Transaction date', 'Transaction hash', 'Method', 'Recorded at', 'Reason'];
  const rows: (string | number)[][] = [];
  for (const a of data.allocations) {
    const r = d.requestById.get(a.requestId);
    const t = d.txById.get(a.txId);
    if (!r || !t) continue;
    rows.push([r.number, r.counterparty, r.kind, CHAIN_NAMES[r.chain], r.token, 'Payment', dec(a.amount), formatExportDate(t.timestamp, fmt), t.hash, a.method, a.createdAt, '']);
  }
  for (const a of data.adjustments) {
    const r = d.requestById.get(a.requestId);
    if (!r) continue;
    rows.push([r.number, r.counterparty, r.kind, CHAIN_NAMES[r.chain], r.token, 'Write-off', dec(a.amount), '', '', 'manual', a.createdAt, a.reason]);
  }
  rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])) || String(x[10]).localeCompare(String(y[10])));
  return toCSV(headers, rows);
}

/**
 * Bank-statement style lines for one wallet and token, signed from that wallet's point of view
 * (internal transfers appear as an outflow from one wallet and an inflow to the other).
 * Columns: Date, Amount, Payee, Description, Reference. Check your accounting package's
 * statement-import requirements; most accept a simple Date / Amount / Description layout.
 */
export function statementCSV(data: AppData, d: Derived, walletId: string, token: Token, fmt: ExportDateFormat, range: { from?: string; to?: string } = {}): string {
  const w = data.wallets.find((x) => x.id === walletId);
  if (!w) throw new Error('Wallet not found');
  const lines = data.transactions
    .filter((t) => t.chain === w.chain && t.token === token)
    .filter((t) => sameAddress(w.chain, t.to, w.address) || sameAddress(w.chain, t.from, w.address))
    .filter((t) => (!range.from || t.timestamp.slice(0, 10) >= range.from) && (!range.to || t.timestamp.slice(0, 10) <= range.to))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const contactByAddr = (addr: string) =>
    data.contacts.find((c) => c.addresses.some((a) => a.chain === w.chain && sameAddress(w.chain, a.address, addr)))?.name;
  const rows = lines.map((t) => {
    const incoming = sameAddress(w.chain, t.to, w.address);
    const other = incoming ? t.from : t.to;
    const reqs = (d.allocByTx.get(t.id) ?? []).map((a) => d.requestById.get(a.requestId)).filter(Boolean);
    const otherWallet = data.wallets.find((x) => x.chain === w.chain && sameAddress(w.chain, x.address, other));
    const payee = otherWallet?.label ?? reqs[0]?.counterparty ?? contactByAddr(other) ?? other;
    const desc = [
      `${t.token} ${incoming ? 'received from' : 'sent to'} ${other}`,
      reqs.length ? `for ${reqs.map((r) => r!.number).join(', ')}` : t.category ? CATEGORY_LABELS[t.category] : '',
      t.memo ? `memo: ${t.memo}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return [formatExportDate(t.timestamp, fmt), dec(incoming ? t.amount : -t.amount), payee, desc, t.hash];
  });
  return toCSV(['Date', 'Amount', 'Payee', 'Description', 'Reference'], rows);
}

export function backupJSON(data: AppData, includeKeys: boolean): string {
  const settings = { ...data.settings };
  if (!includeKeys) {
    delete settings.etherscanApiKey;
    delete settings.trongridApiKey;
  }
  return JSON.stringify({ ...data, settings, exportedAt: new Date().toISOString(), app: 'settlement-ledger' }, null, 2);
}

export function parseBackup(text: string): AppData {
  const obj = JSON.parse(text);
  if (!obj || obj.version !== 1 || !Array.isArray(obj.requests) || !Array.isArray(obj.transactions)) {
    throw new Error('This file is not a Settlement Ledger backup (version 1).');
  }
  return obj as AppData;
}

interface HostDownloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

/**
 * Save a generated file. Inside a claude.ai artifact the page may not download directly,
 * so the host's `downloads` capability is used (the viewer confirms the save); everywhere
 * else a normal browser download is started. Rejects with { code: 'declined' } when the
 * viewer says no.
 */
export async function download(filename: string, content: string, mime = 'text/csv;charset=utf-8'): Promise<void> {
  // A UTF-8 BOM helps Excel open non-ASCII counterparty names correctly.
  const body = mime.startsWith('text/csv') ? '\uFEFF' + content : content;
  if (typeof window !== 'undefined' && window.claude?.use) {
    const host = (await window.claude.use('downloads').catch(() => null)) as HostDownloads | null;
    if (host) {
      await host.save({ filename, data: body });
      return;
    }
  }
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
