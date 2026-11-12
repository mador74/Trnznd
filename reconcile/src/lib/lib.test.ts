import { describe, expect, it } from 'vitest';
import { formatAmount, fromBaseUnits, parseAmount, toDecimalString } from './amount';
import { isValidAddress, normHash, parseChain, parseToken, guessChainFromAddress, TOKEN_CONTRACTS } from './chains';
import { parseDateInput } from './dates';
import { buildDemo } from './demo';
import { derive, outstanding } from './status';
import { autoMatchPlan, suggestForTx, uniqueAmount, isFingerprinted } from './match';
import { toCSV, guessTxMapping, buildTransactions, buildRequests, parseCSV } from './csv';
import { statementCSV, transactionHistoryCSV, requestsCSV, filterTransactions, backupJSON, parseBackup } from './exports';

describe('amounts', () => {
  it('parses human input into micro-units', () => {
    expect(parseAmount('1,234.56')).toBe(1_234_560_000);
    expect(parseAmount('0.000001')).toBe(1);
    expect(parseAmount('12.3456785')).toBe(12_345_679); // rounds half up at 6 dp
    expect(parseAmount('-5')).toBe(-5_000_000);
    expect(parseAmount('100 USDT')).toBe(100_000_000);
    expect(parseAmount('$42')).toBe(42_000_000);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('.5')).toBe(500_000);
  });
  it('converts base units', () => {
    expect(fromBaseUnits('1000000', 6)).toBe(1_000_000);
    expect(fromBaseUnits('1000000000000000000', 18)).toBe(1_000_000);
    expect(fromBaseUnits('5', 2)).toBe(50_000);
  });
  it('formats', () => {
    expect(formatAmount(1_234_567_500_000)).toBe('1,234,567.50');
    expect(formatAmount(4_800_003_700)).toBe('4,800.0037');
    expect(formatAmount(-2_000_000)).toBe('−2.00');
    expect(toDecimalString(-1_500_000)).toBe('-1.50');
  });
});

describe('chains', () => {
  it('validates address formats', () => {
    expect(isValidAddress('ETH', TOKEN_CONTRACTS.ETH.USDT)).toBe(true);
    expect(isValidAddress('ETH', '0x123')).toBe(false);
    expect(isValidAddress('TRX', TOKEN_CONTRACTS.TRX.USDT)).toBe(true);
    expect(isValidAddress('TRX', TOKEN_CONTRACTS.SOL.USDC)).toBe(false);
    expect(isValidAddress('SOL', TOKEN_CONTRACTS.SOL.USDC)).toBe(true);
    expect(isValidAddress('SOL', '0OIl' + 'a'.repeat(40))).toBe(false);
  });
  it('normalises names', () => {
    expect(parseChain('TRC20')).toBe('TRX');
    expect(parseChain('Ethereum Mainnet')).toBe('ETH');
    expect(parseChain('solana')).toBe('SOL');
    expect(parseToken('Tether USD')).toBe('USDT');
    expect(parseToken(TOKEN_CONTRACTS.ETH.USDC.toLowerCase())).toBe('USDC');
    expect(parseToken('DAI')).toBeNull();
    expect(guessChainFromAddress(TOKEN_CONTRACTS.TRX.USDT)).toBe('TRX');
    expect(normHash('TRX', '0xABC')).toBe('abc');
    expect(normHash('ETH', 'ABC')).toBe('0xabc');
  });
  it('parses export dates', () => {
    expect(parseDateInput('1700000000')).toBe('2023-11-14T22:13:20.000Z');
    expect(parseDateInput('2026-11-01 10:20:30')).toBe('2026-11-01T10:20:30.000Z');
    expect(parseDateInput('25/12/2026')).toBe('2026-12-25T00:00:00.000Z');
    expect(parseDateInput('01/02/2026')).toBeNull(); // ambiguous without a chosen order
    expect(parseDateInput('01/02/2026', 'dmy')).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('matching', () => {
  const data = buildDemo();
  const d = derive(data);
  const byNum = (n: string) => data.requests.find((r) => r.number === n)!;
  const txByAmount = (a: number) => data.transactions.find((t) => t.amount === a)!;

  it('scores exact amount + known wallet as high confidence', () => {
    const s = suggestForTx(txByAmount(12_500_000_000), data, d);
    expect(s[0].allocations[0].requestId).toBe(byNum('PR-0001').id);
    expect(s[0].confidence).toBe('high');
  });
  it('uses memo reference and fingerprinted amount', () => {
    const s = suggestForTx(txByAmount(4_800_003_700), data, d);
    expect(s[0].allocations[0].requestId).toBe(byNum('PR-0002').id);
    expect(s[0].reasons).toContain('Reference found in memo');
    expect(s[0].reasons).toContain('Unique fingerprinted amount');
  });
  it('suggests one payment covering two requests', () => {
    const s = suggestForTx(txByAmount(5_250_000_000), data, d);
    const ids = s[0].allocations.map((a) => a.requestId).sort();
    expect(ids).toEqual([byNum('PR-0004').id, byNum('PR-0005').id].sort());
    expect(s[0].allocations.reduce((a, x) => a + x.amount, 0)).toBe(5_250_000_000);
  });
  it('flags a short payment within tolerance', () => {
    const s = suggestForTx(txByAmount(7_499_000_000), data, d);
    expect(s[0].allocations[0].requestId).toBe(byNum('PR-0006').id);
    expect(s[0].reasons[0]).toBe('Short by 1.00 (within tolerance)');
  });
  it('treats a smaller payment as partial', () => {
    const s = suggestForTx(txByAmount(5_000_000_000), data, d);
    expect(s[0].allocations[0].requestId).toBe(byNum('PR-0003').id);
    expect(s[0].reasons).toContain('Partial payment');
  });
  it('ignores internal transfers and already reconciled payments', () => {
    expect(suggestForTx(txByAmount(10_000_000_000), data, d)).toEqual([]);
    expect(suggestForTx(txByAmount(6_400_000_000), data, d)).toEqual([]);
  });
  it('auto plan only takes unambiguous high-confidence matches', () => {
    const plan = autoMatchPlan(data, d);
    const reqs = plan.flatMap((p) => p.allocations.map((a) => data.requests.find((r) => r.id === a.requestId)!.number)).sort();
    expect(reqs).toContain('PR-0001');
    expect(reqs).toContain('PR-0002');
    expect(reqs).not.toContain('PR-0003');
    expect(reqs).not.toContain('PR-0006');
  });
  it('makes unique fingerprinted amounts', () => {
    let i = 0;
    const seq = [0.0, 0.0, 0.5];
    const v = uniqueAmount(1_000_000_000, [1_000_000_100], () => seq[i++ % seq.length]);
    expect(v).toBe(1_000_005_000);
    expect(isFingerprinted(v)).toBe(true);
    expect(isFingerprinted(1_000_000_000)).toBe(false);
  });
  it('computes outstanding after allocations', () => {
    const r = byNum('PR-0009');
    expect(outstanding(r, d)).toBe(0);
    expect(d.requestStatus.get(r.id)).toBe('paid');
    expect(d.requestStatus.get(byNum('PR-0008').id)).toBe('overdue');
  });
});

describe('csv', () => {
  it('quotes and guards cells', () => {
    const out = toCSV(['a', 'b'], [['x,y', '=SUM(A1)'], [-5, 'say "hi"']]);
    expect(out).toBe('a,b\r\n"x,y",\'=SUM(A1)\r\n-5,"say ""hi"""\r\n');
  });
  it('guesses explorer-style headers', () => {
    const m = guessTxMapping(['Transaction Hash', 'Blockno', 'UnixTimestamp', 'DateTime (UTC)', 'From', 'To', 'TokenValue', 'TokenSymbol']);
    expect(m).toMatchObject({ hash: 'Transaction Hash', date: 'DateTime (UTC)', from: 'From', to: 'To', amount: 'TokenValue', token: 'TokenSymbol' });
  });
  it('builds transactions relative to company wallets and skips foreign rows', () => {
    const data = buildDemo();
    const w = data.wallets.find((x) => x.chain === 'TRX')!;
    const other = data.contacts[0].addresses[0].address;
    const { rows } = parseCSV(
      `Transaction Hash,DateTime (UTC),From,To,TokenValue,TokenSymbol\n` +
        `${'a'.repeat(64)},2026-11-01 10:00:00,${other},${w.address},"1,000.50",USDT\n` +
        `${'b'.repeat(64)},2026-11-02 10:00:00,${w.address},${other},20,USDT\n` +
        `${'c'.repeat(64)},2026-11-02 10:00:00,${other},${other},20,USDT\n` +
        `${'d'.repeat(64)},bad date,${other},${w.address},20,USDT\n`,
    );
    const res = buildTransactions(rows, { mapping: guessTxMapping(['Transaction Hash', 'DateTime (UTC)', 'From', 'To', 'TokenValue', 'TokenSymbol']), dateOrder: 'auto', baseUnits: false, defaultChain: 'TRX' }, data.wallets);
    expect(res.transactions.map((t) => [t.direction, t.amount])).toEqual([['in', 1_000_500_000], ['out', 20_000_000]]);
    expect(res.skippedForeign).toBe(1);
    expect(res.errors[0]).toMatch(/Row 5: unreadable date/);
  });
  it('uses a chosen wallet and the amount sign when there are no address columns', () => {
    const data = buildDemo();
    const { rows } = parseCSV(`txid,time,amount,asset\nabc123,1700000000,-15,USDC\ndef456,1700000100,30,USDC\n`);
    const res = buildTransactions(rows, { mapping: { hash: 'txid', date: 'time', amount: 'amount', token: 'asset' }, walletId: 'w_eth', dateOrder: 'auto', baseUnits: false }, data.wallets);
    expect(res.transactions.map((t) => t.direction)).toEqual(['out', 'in']);
    expect(res.transactions[0].from).toBe(data.wallets[0].address);
  });
  it('validates request rows', () => {
    const { rows } = parseCSV(`number,kind,counterparty,chain,token,amount,issue_date\nINV-1,receivable,Acme,TRC20,USDT,100,2026-11-01\nINV-2,gift,Acme,TRX,USDT,1,2026-11-01\nINV-3,payable,Acme,ETH,DAI,1,2026-11-01\n`);
    const res = buildRequests(rows, [], 'auto');
    expect(res[0].input?.chain).toBe('TRX');
    expect(res[1].error).toMatch(/kind/);
    expect(res[2].error).toMatch(/token/);
  });
});

describe('exports', () => {
  const data = buildDemo();
  const d = derive(data);
  it('statement shows internal transfers from each wallet point of view', () => {
    const a = statementCSV(data, d, 'w_trx', 'USDT', 'iso');
    const b = statementCSV(data, d, 'w_trx2', 'USDT', 'iso');
    expect(a).toContain(',-10000.00,Payroll · Tron,');
    expect(b).toContain(',10000.00,Collections · Tron,');
    expect(a.split('\r\n')[0]).toBe('Date,Amount,Payee,Description,Reference');
  });
  it('transaction history carries reconciliation detail', () => {
    const csv = transactionHistoryCSV(data, d, filterTransactions(data, d, {}), 'dmy');
    const line = csv.split('\r\n').find((l) => l.includes('6400.00'))!;
    expect(line).toContain('Reconciled');
    expect(line).toContain('PR-0009');
    expect(filterTransactions(data, d, { status: 'unreconciled' }).length).toBe(8);
  });
  it('requests export and backup round-trip', () => {
    expect(requestsCSV(data, d, 'iso')).toContain('PR-0009,payable');
    const json = backupJSON({ ...data, settings: { ...data.settings, etherscanApiKey: 'SECRET' } }, false);
    expect(json).not.toContain('SECRET');
    expect(parseBackup(json).requests.length).toBe(10);
    expect(() => parseBackup('{"hello":1}')).toThrow();
  });
});
