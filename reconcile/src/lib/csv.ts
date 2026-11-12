import Papa from 'papaparse';
import type { Chain, PaymentRequest, RequestKind, Token, Transaction, Wallet } from './types';
import { parseAmount } from './amount';
import { guessChainFromAddress, parseChain, parseToken, isValidAddress } from './chains';
import { type DateOrder, parseDateInput } from './dates';
import { deriveDirection } from './direction';
import { txKey } from './ids';

export type Cell = string | number | null | undefined;

/** Neutralise spreadsheet formula injection in text cells (OWASP CSV injection guidance). */
function guard(v: string): string {
  return /^[=+@\t\r]/.test(v) || /^-[^\d.]/.test(v) ? `'${v}` : v;
}

export function toCSV(headers: string[], rows: Cell[][]): string {
  const esc = (c: Cell) => {
    if (c === null || c === undefined) return '';
    const s = typeof c === 'number' ? String(c) : guard(String(c));
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  return {
    headers: res.meta.fields ?? [],
    rows: res.data,
    errors: res.errors.slice(0, 20).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}

// ---------------- transaction import ----------------
export type TxField = 'date' | 'hash' | 'from' | 'to' | 'amount' | 'token' | 'chain' | 'memo' | 'direction';
export type TxMapping = Partial<Record<TxField, string>>;

export const TX_FIELD_LABELS: Record<TxField, string> = {
  date: 'Date / time',
  hash: 'Transaction hash / ID',
  from: 'From address',
  to: 'To address',
  amount: 'Amount',
  token: 'Token / symbol',
  chain: 'Chain / network',
  memo: 'Memo / reference',
  direction: 'Direction (in/out)',
};

const GUESS: [TxField, RegExp][] = [
  ['hash', /(^|\b)(tx ?hash|transaction ?hash|txn ?hash|hash|txid|tx ?id|transaction ?id|signature)\b/i],
  ['date', /(date|time|timestamp|block ?time)/i],
  ['from', /^(from|sender|from ?address|source)$/i],
  ['to', /^(to|recipient|receiver|to ?address|destination)$/i],
  ['amount', /(amount|value|quantity|qty|token ?value)/i],
  ['token', /(token ?symbol|symbol|token|asset|currency|coin)/i],
  ['chain', /(chain|network|blockchain)/i],
  ['memo', /(memo|reference|note|comment|description)/i],
  ['direction', /(direction|type|side|in\/out)/i],
];

export function guessTxMapping(headers: string[]): TxMapping {
  const m: TxMapping = {};
  const used = new Set<string>();
  for (const [field, re] of GUESS) {
    const h = headers.find((x) => !used.has(x) && re.test(x.trim()));
    if (h) {
      m[field] = h;
      used.add(h);
    }
  }
  // Prefer a "DateTime (UTC)"-style column over a raw unix column when both exist.
  const dt = headers.find((h) => /date ?time/i.test(h));
  if (dt) m.date = dt;
  return m;
}

export interface TxImportOptions {
  mapping: TxMapping;
  defaultChain?: Chain;
  defaultToken?: Token;
  /** Wallet the file belongs to; required when the file has no from/to columns. */
  walletId?: string;
  dateOrder: DateOrder;
  /** Amount column holds raw base units (1000000 = 1 USDT) instead of decimal tokens. */
  baseUnits: boolean;
}

export interface TxImportResult {
  transactions: Transaction[];
  errors: string[];
  skippedForeign: number;
}

const IN_WORDS = /^(in|incoming|received|receive|deposit|credit|cr|inflow)$/i;
const OUT_WORDS = /^(out|outgoing|sent|send|withdrawal|withdraw|debit|dr|outflow)$/i;

export function buildTransactions(rows: Record<string, string>[], opts: TxImportOptions, wallets: Wallet[]): TxImportResult {
  const { mapping: m } = opts;
  const errors: string[] = [];
  const out: Transaction[] = [];
  let skippedForeign = 0;
  const now = new Date().toISOString();
  const fixedWallet = wallets.find((w) => w.id === opts.walletId);
  rows.forEach((row, i) => {
    const line = i + 2;
    const get = (f: TxField) => (m[f] ? (row[m[f]!] ?? '').trim() : '');
    const hash = get('hash');
    if (!hash) return void errors.push(`Row ${line}: missing transaction hash`);
    const timestamp = parseDateInput(get('date'), opts.dateOrder);
    if (!timestamp) return void errors.push(`Row ${line}: unreadable date "${get('date')}"`);
    let amount = opts.baseUnits ? (/^-?\d+$/.test(get('amount').replace(/[,\s]/g, '')) ? Number(get('amount').replace(/[,\s]/g, '')) : null) : parseAmount(get('amount'));
    if (amount === null || amount === 0) return void errors.push(`Row ${line}: unreadable amount "${get('amount')}"`);
    const negative = amount < 0;
    amount = Math.abs(amount);
    const from = get('from');
    const to = get('to');
    const chain = parseChain(get('chain')) ?? fixedWallet?.chain ?? opts.defaultChain ?? (from ? guessChainFromAddress(from) : null);
    if (!chain) return void errors.push(`Row ${line}: cannot tell the chain; set a default chain`);
    const token = parseToken(get('token')) ?? opts.defaultToken;
    if (!token) return void errors.push(`Row ${line}: token "${get('token')}" is not USDT or USDC`);
    if (fixedWallet && fixedWallet.chain !== chain) return void errors.push(`Row ${line}: chain ${chain} does not match wallet ${fixedWallet.label}`);

    let direction: Transaction['direction'] | undefined;
    let walletId: string | undefined;
    let fromAddr = from;
    let toAddr = to;
    const r = from || to ? deriveDirection({ chain, from, to }, wallets) : null;
    if (r) ({ direction, walletId } = r);
    else if (fixedWallet && !(from && to)) {
      // File without both parties (e.g. an exchange or wallet-app export): use the chosen wallet.
      const dirText = get('direction');
      const isOut = OUT_WORDS.test(dirText) || (!IN_WORDS.test(dirText) && negative);
      direction = isOut ? 'out' : 'in';
      walletId = fixedWallet.id;
      if (isOut) fromAddr = fromAddr || fixedWallet.address;
      else toAddr = toAddr || fixedWallet.address;
    }
    if (!direction) {
      skippedForeign++;
      return;
    }
    if (fromAddr && !isValidAddress(chain, fromAddr)) return void errors.push(`Row ${line}: "${fromAddr}" is not a valid ${chain} address`);
    if (toAddr && !isValidAddress(chain, toAddr)) return void errors.push(`Row ${line}: "${toAddr}" is not a valid ${chain} address`);
    const memo = get('memo') || undefined;
    out.push({
      id: txKey(chain, hash, token, fromAddr, toAddr, amount),
      chain,
      token,
      hash: hash.trim(),
      timestamp,
      from: fromAddr,
      to: toAddr,
      amount,
      walletId,
      direction,
      memo,
      source: 'csv',
      importedAt: now,
    });
  });
  return { transactions: out, errors, skippedForeign };
}

// ---------------- payment request import ----------------
export const REQUEST_TEMPLATE_HEADERS = ['number', 'kind', 'counterparty', 'counterparty_address', 'chain', 'token', 'amount', 'issue_date', 'due_date', 'reference', 'description'];

export function requestTemplateCSV(): string {
  return toCSV(REQUEST_TEMPLATE_HEADERS, [
    ['INV-1001', 'receivable', 'Example Customer Ltd', '', 'TRX', 'USDT', '1250.00', '2026-11-01', '2026-11-30', 'INV-1001', 'Consulting, October'],
    ['BILL-77', 'payable', 'Example Supplier GmbH', '', 'ETH', 'USDC', '980.50', '2026-11-05', '2026-11-20', 'BILL-77', 'Freight'],
  ]);
}

export interface RequestImportRow {
  input?: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt' | 'number'> & { number?: string };
  error?: string;
  line: number;
}

export function buildRequests(rows: Record<string, string>[], wallets: Wallet[], dateOrder: DateOrder): RequestImportRow[] {
  return rows.map((raw, i) => {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) row[k.trim().toLowerCase().replace(/\s+/g, '_')] = (v ?? '').trim();
    const line = i + 2;
    const kindText = (row.kind || row.type || 'receivable').toLowerCase();
    const kind: RequestKind | null = /^(receivable|invoice|ar|sales|in)/.test(kindText) ? 'receivable' : /^(payable|bill|ap|purchase|out)/.test(kindText) ? 'payable' : null;
    if (!kind) return { line, error: `kind "${kindText}" must be receivable or payable` };
    const chain = parseChain(row.chain || row.network);
    if (!chain) return { line, error: `unknown chain "${row.chain ?? ''}"` };
    const token = parseToken(row.token || row.currency);
    if (!token) return { line, error: `token "${row.token ?? ''}" must be USDT or USDC` };
    const amount = parseAmount(row.amount);
    if (!amount || amount <= 0) return { line, error: `invalid amount "${row.amount ?? ''}"` };
    const issue = parseDateInput(row.issue_date || row.date, dateOrder);
    if (!issue) return { line, error: `unreadable issue_date "${row.issue_date ?? ''}"` };
    const due = row.due_date ? parseDateInput(row.due_date, dateOrder) : null;
    if (row.due_date && !due) return { line, error: `unreadable due_date "${row.due_date}"` };
    const cpAddr = row.counterparty_address || undefined;
    if (cpAddr && !isValidAddress(chain, cpAddr)) return { line, error: `counterparty_address is not a valid ${chain} address` };
    const counterparty = row.counterparty || row.customer || row.supplier || row.name;
    if (!counterparty) return { line, error: 'counterparty is required' };
    const wallet = wallets.find((w) => w.chain === chain);
    return {
      line,
      input: {
        number: row.number || undefined,
        kind,
        counterparty,
        counterpartyAddress: cpAddr,
        walletId: wallet?.id,
        chain,
        token,
        amount,
        issueDate: issue.slice(0, 10),
        dueDate: due?.slice(0, 10),
        reference: row.reference || row.number || '',
        description: row.description || undefined,
      },
    };
  });
}
