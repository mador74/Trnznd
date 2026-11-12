import type { AppData, Chain, Contact, PaymentRequest, Transaction, Wallet } from './types';
import { emptyData } from './store';
import { txKey } from './ids';
import { addDays, todayISO } from './dates';
import { UNIT } from './amount';

/** Deterministic PRNG so the demo data set is the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const HEX = '0123456789abcdef';

export function buildDemo(): AppData {
  const rnd = mulberry32(20261112);
  const pick = (alphabet: string, n: number) => Array.from({ length: n }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('');
  const addr = (c: Chain) => (c === 'ETH' ? `0x${pick(HEX, 40)}` : c === 'TRX' ? `T${pick(B58, 33)}` : pick(B58, 44));
  const hash = (c: Chain) => (c === 'ETH' ? `0x${pick(HEX, 64)}` : c === 'TRX' ? pick(HEX, 64) : pick(B58, 88));
  const today = todayISO();
  const day = (n: number) => addDays(today, n);
  const at = (n: number, hh = 10) => `${day(n)}T${String(hh).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00.000Z`;
  const now = new Date().toISOString();
  const u = (v: number) => Math.round(v * UNIT);

  const wallets: Wallet[] = [
    { id: 'w_eth', label: 'Treasury · Ethereum', chain: 'ETH', address: addr('ETH'), createdAt: now, demo: true },
    { id: 'w_trx', label: 'Collections · Tron', chain: 'TRX', address: addr('TRX'), createdAt: now, demo: true },
    { id: 'w_trx2', label: 'Payroll · Tron', chain: 'TRX', address: addr('TRX'), createdAt: now, demo: true },
    { id: 'w_sol', label: 'Operations · Solana', chain: 'SOL', address: addr('SOL'), createdAt: now, demo: true },
  ];
  const W = Object.fromEntries(wallets.map((w) => [w.id, w]));
  const contacts: Contact[] = [
    { id: 'c_north', name: 'Northwind Imports', email: 'ap@northwind.example', addresses: [{ chain: 'TRX', address: addr('TRX') }] },
    { id: 'c_blue', name: 'Blue Harbor Logistics', email: 'finance@blueharbor.example', addresses: [{ chain: 'SOL', address: addr('SOL') }] },
    { id: 'c_kestrel', name: 'Kestrel Foods', addresses: [{ chain: 'ETH', address: addr('ETH') }] },
    { id: 'c_atlas', name: 'Atlas Freight (supplier)', addresses: [{ chain: 'TRX', address: addr('TRX') }] },
    { id: 'c_cloud', name: 'CloudWorks SaaS (supplier)', addresses: [{ chain: 'ETH', address: addr('ETH') }] },
    { id: 'c_orion', name: 'Orion Retail', addresses: [] },
  ];
  const C = Object.fromEntries(contacts.map((c) => [c.id, c]));
  const cAddr = (id: string) => C[id].addresses[0]?.address;

  let n = 1;
  const req = (p: Omit<PaymentRequest, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'reference' | 'counterparty'> & { reference?: string }): PaymentRequest => {
    const number = `PR-${String(n++).padStart(4, '0')}`;
    const contact = p.contactId ? C[p.contactId] : undefined;
    return { ...p, id: `pr_${number}`, number, reference: p.reference ?? number, counterparty: contact?.name ?? 'Unknown', createdAt: now, updatedAt: now };
  };
  const requests: PaymentRequest[] = [
    req({ kind: 'receivable', contactId: 'c_north', walletId: 'w_trx', chain: 'TRX', token: 'USDT', amount: u(12500), issueDate: day(-20), dueDate: day(-5), description: 'Container 41 — goods shipped' }),
    req({ kind: 'receivable', contactId: 'c_blue', walletId: 'w_sol', chain: 'SOL', token: 'USDC', amount: u(4800.0037), issueDate: day(-12), dueDate: day(2), description: 'Warehousing, October' }),
    req({ kind: 'receivable', contactId: 'c_kestrel', walletId: 'w_eth', chain: 'ETH', token: 'USDC', amount: u(9000), issueDate: day(-30), dueDate: day(-15), description: 'Cold-chain consignment' }),
    req({ kind: 'receivable', contactId: 'c_north', walletId: 'w_trx', chain: 'TRX', token: 'USDT', amount: u(2000), issueDate: day(-9), dueDate: day(5), description: 'Sample lot A' }),
    req({ kind: 'receivable', contactId: 'c_north', walletId: 'w_trx', chain: 'TRX', token: 'USDT', amount: u(3250), issueDate: day(-8), dueDate: day(6), description: 'Sample lot B' }),
    req({ kind: 'receivable', contactId: 'c_kestrel', walletId: 'w_eth', chain: 'ETH', token: 'USDT', amount: u(7500), issueDate: day(-10), dueDate: day(4), description: 'Packaging supply' }),
    req({ kind: 'receivable', contactId: 'c_blue', walletId: 'w_sol', chain: 'SOL', token: 'USDT', amount: u(1200), issueDate: day(-2), dueDate: day(14), description: 'Handling fees' }),
    req({ kind: 'receivable', contactId: 'c_orion', walletId: 'w_trx', chain: 'TRX', token: 'USDT', amount: u(3000), issueDate: day(-40), dueDate: day(-10), description: 'Retail order 5512' }),
    req({ kind: 'payable', contactId: 'c_atlas', walletId: 'w_trx', chain: 'TRX', token: 'USDT', amount: u(6400), issueDate: day(-14), dueDate: day(-1), description: 'Freight invoice AF-2291', reference: 'AF-2291' }),
    req({ kind: 'payable', contactId: 'c_cloud', walletId: 'w_eth', chain: 'ETH', token: 'USDC', amount: u(1450), issueDate: day(-3), dueDate: day(7), description: 'Annual licence', reference: 'CW-88013' }),
  ];

  const tx = (walletId: string, dir: 'in' | 'out' | 'internal', token: 'USDT' | 'USDC', amount: number, when: string, other: string, memo?: string): Transaction => {
    const w = W[walletId];
    const h = hash(w.chain);
    const from = dir === 'in' ? other : w.address;
    const to = dir === 'in' ? w.address : other;
    return { id: txKey(w.chain, h, token, from, to, amount), chain: w.chain, token, hash: h, timestamp: when, from, to, amount, walletId: dir === 'internal' ? undefined : walletId, direction: dir, memo, source: 'demo', importedAt: now };
  };
  const unknownPayer = addr('TRX');
  const transactions: Transaction[] = [
    tx('w_trx', 'in', 'USDT', u(12500), at(-6), cAddr('c_north')),
    tx('w_sol', 'in', 'USDC', u(4800.0037), at(-1, 14), cAddr('c_blue'), 'PR-0002'),
    tx('w_eth', 'in', 'USDC', u(5000), at(-22), cAddr('c_kestrel')),
    tx('w_eth', 'in', 'USDC', u(4000), at(-16, 15), cAddr('c_kestrel')),
    tx('w_trx', 'in', 'USDT', u(5250), at(-3, 9), cAddr('c_north')),
    tx('w_eth', 'in', 'USDT', u(7499), at(-2, 11), cAddr('c_kestrel')),
    tx('w_trx', 'out', 'USDT', u(6400), at(-1, 16), cAddr('c_atlas')),
    tx('w_trx', 'in', 'USDT', u(2750), at(-4, 12), unknownPayer),
    tx('w_sol', 'out', 'USDC', u(150), at(-5, 13), cAddr('c_blue')),
  ];
  // Internal transfer between the two Tron wallets.
  const ih = hash('TRX');
  transactions.push({
    id: txKey('TRX', ih, 'USDT', W.w_trx.address, W.w_trx2.address, u(10000)),
    chain: 'TRX', token: 'USDT', hash: ih, timestamp: at(-7, 17), from: W.w_trx.address, to: W.w_trx2.address, amount: u(10000),
    walletId: 'w_trx2', direction: 'internal', source: 'demo', importedAt: now,
  });

  // One payable already reconciled, to show the finished state.
  const paid = transactions[6];
  const data = emptyData();
  return {
    ...data,
    settings: { ...data.settings, companyName: 'Demo Trading Ltd', nextRequestNumber: n },
    wallets,
    contacts,
    requests,
    transactions,
    allocations: [{ id: 'al_demo1', txId: paid.id, requestId: requests[8].id, amount: paid.amount, method: 'manual', createdAt: now }],
    adjustments: [],
    activity: [],
  };
}
