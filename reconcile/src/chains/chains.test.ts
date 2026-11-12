import { describe, expect, it } from 'vitest';
import { parseEtherscan, fetchEthereum } from './etherscan';
import { parseTron, fetchTron } from './tron';
import { parseSolanaTx, cleanMemo, fetchSolana } from './solana';
import { TOKEN_CONTRACTS } from '../lib/chains';
import type { Wallet } from '../lib/types';

const ethWallet: Wallet = { id: 'w', label: 'e', chain: 'ETH', address: '0x' + '1'.repeat(40), createdAt: '' };
const trxWallet: Wallet = { id: 't', label: 't', chain: 'TRX', address: 'T' + 'A'.repeat(33), createdAt: '' };
const solWallet: Wallet = { id: 's', label: 's', chain: 'SOL', address: 'So1' + 'a'.repeat(40), createdAt: '' };
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('etherscan', () => {
  it('parses tokentx results and filters by contract', () => {
    const r = parseEtherscan(
      {
        status: '1',
        message: 'OK',
        result: [
          { blockNumber: '100', timeStamp: '1700000000', hash: '0xaa', from: '0xf', to: ethWallet.address, value: '2500000', contractAddress: TOKEN_CONTRACTS.ETH.USDT.toLowerCase(), tokenDecimal: '6' },
          { blockNumber: '101', timeStamp: '1700000001', hash: '0xbb', from: '0xf', to: ethWallet.address, value: '1', contractAddress: '0xdeadbeef', tokenDecimal: '18' },
        ],
      },
      'USDT',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ amount: 2_500_000, block: 100, timestamp: '2023-11-14T22:13:20.000Z' });
  });
  it('treats "No transactions found" as empty and surfaces other errors', () => {
    expect(parseEtherscan({ status: '0', message: 'No transactions found', result: [] }, 'USDC')).toEqual([]);
    expect(() => parseEtherscan({ status: '0', message: 'NOTOK', result: 'Invalid API Key' }, 'USDC')).toThrow(/Invalid API Key/);
  });
  it('requires an API key and builds a V2 request', async () => {
    await expect(fetchEthereum(ethWallet, 'USDT', undefined, undefined)).rejects.toThrow(/Etherscan API key/);
    const urls: string[] = [];
    const res = await fetchEthereum(ethWallet, 'USDT', 'KEY', '50', (u) => {
      urls.push(u);
      return json({ status: '1', message: 'OK', result: [{ blockNumber: '77', timeStamp: '1700000000', hash: '0x1', from: '0x2', to: ethWallet.address, value: '1000000', contractAddress: TOKEN_CONTRACTS.ETH.USDT }] });
    });
    expect(urls[0]).toContain('/v2/api?chainid=1&module=account&action=tokentx');
    expect(urls[0]).toContain('startblock=50');
    expect(res.cursor).toBe('77');
  });
});

describe('trongrid', () => {
  const item = (id: string, ts: number, type = 'Transfer') => ({ transaction_id: id, token_info: { address: TOKEN_CONTRACTS.TRX.USDT, decimals: 6, symbol: 'USDT' }, block_timestamp: ts, from: 'TX', to: trxWallet.address, type, value: '3000000' });
  it('parses transfers and skips approvals', () => {
    const r = parseTron({ data: [item('a', 1700000000000), item('b', 1700000000001, 'Approval')], success: true, meta: {} }, 'USDT');
    expect(r).toEqual([{ hash: 'a', token: 'USDT', from: 'TX', to: trxWallet.address, amount: 3_000_000, timestamp: '2023-11-14T22:13:20.000Z' }]);
  });
  it('follows the fingerprint and sends the API key header', async () => {
    const calls: { url: string; headers?: HeadersInit }[] = [];
    const page1 = Array.from({ length: 200 }, (_, i) => item(`p1-${i}`, 1700000000000 + i));
    const res = await fetchTron(trxWallet, 'USDT', 'K', undefined, (url, init) => {
      calls.push({ url, headers: init?.headers });
      return calls.length === 1 ? json({ data: page1, success: true, meta: { fingerprint: 'FP' } }) : json({ data: [item('last', 1800000000000)], success: true, meta: {} });
    });
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain('fingerprint=FP');
    expect(calls[0].url).toContain(`/v1/accounts/${trxWallet.address}/transactions/trc20?`);
    expect((calls[0].headers as Record<string, string>)['TRON-PRO-API-KEY']).toBe('K');
    expect(res.transfers).toHaveLength(201);
    expect(res.cursor).toBe('1800000000000');
  });
});

describe('solana', () => {
  const mint = TOKEN_CONTRACTS.SOL.USDC;
  const tx = (pre: [string, string][], post: [string, string][]) => ({
    blockTime: 1700000000,
    slot: 9,
    meta: {
      err: null,
      preTokenBalances: pre.map(([owner, amount], i) => ({ accountIndex: i, mint, owner, uiTokenAmount: { amount, decimals: 6 } })),
      postTokenBalances: post.map(([owner, amount], i) => ({ accountIndex: i, mint, owner, uiTokenAmount: { amount, decimals: 6 } })),
    },
  });
  it('computes the wallet delta and counterparty from token balances', () => {
    const r = parseSolanaTx(tx([['payer', '10000000'], [solWallet.address, '0']], [['payer', '4000000'], [solWallet.address, '6000000']]), solWallet.address, mint, []);
    expect(r).toEqual({ delta: 6_000_000n, counterparty: 'payer' });
    // New token account created in the same transaction (no pre balance).
    const r2 = parseSolanaTx(tx([['payer', '10000000']], [['payer', '9000000'], [solWallet.address, '1000000']]), solWallet.address, mint, []);
    expect(r2?.delta).toBe(1_000_000n);
    expect(parseSolanaTx(tx([], []), solWallet.address, mint, [])).toBeNull();
  });
  it('cleans RPC memo prefixes', () => {
    expect(cleanMemo('[7] PR-0002')).toBe('PR-0002');
    expect(cleanMemo(null)).toBeUndefined();
  });
  it('walks token accounts, signatures and transactions', async () => {
    const methods: string[] = [];
    const res = await fetchSolana(solWallet, 'USDC', 'https://rpc.example', undefined, (_u, init) => {
      const body = JSON.parse(String(init?.body));
      methods.push(body.method);
      if (body.method === 'getTokenAccountsByOwner') return json({ jsonrpc: '2.0', id: body.id, result: { value: [{ pubkey: 'ATA1' }] } });
      if (body.method === 'getSignaturesForAddress') return json({ jsonrpc: '2.0', id: body.id, result: [{ signature: 'SIG2', err: null, memo: '[7] PR-0002', blockTime: 1700000100 }, { signature: 'SIG1', err: { x: 1 }, memo: null }] });
      return json({ jsonrpc: '2.0', id: body.id, result: tx([['payer', '5000000']], [['payer', '0'], [solWallet.address, '5000000']]) });
    });
    expect(methods).toEqual(['getTokenAccountsByOwner', 'getSignaturesForAddress', 'getTransaction']);
    expect(res.transfers[0]).toMatchObject({ hash: 'SIG2', amount: 5_000_000, from: 'payer', to: solWallet.address, memo: 'PR-0002' });
    expect(JSON.parse(res.cursor!)).toEqual({ ATA1: 'SIG2' });
  });
});
