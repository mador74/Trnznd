import type { Settings, Token, Transaction, Wallet } from '../lib/types';
import { TOKENS } from '../lib/types';
import { deriveDirection } from '../lib/direction';
import { txKey } from '../lib/ids';
import { addTransactions, getState, updateWallet } from '../lib/store';
import type { FetchFn, FetchResult } from './common';
import { fetchEthereum } from './etherscan';
import { fetchSolana } from './solana';
import { fetchTron } from './tron';

export interface SyncOutcome {
  walletId: string;
  added: number;
  duplicates: number;
  truncated: boolean;
  error?: string;
}

export function fetchFor(wallet: Wallet, token: Token, settings: Settings, fetchFn?: FetchFn): Promise<FetchResult> {
  const cursor = wallet.cursor?.[token];
  switch (wallet.chain) {
    case 'ETH':
      return fetchEthereum(wallet, token, settings.etherscanApiKey, cursor, fetchFn);
    case 'TRX':
      return fetchTron(wallet, token, settings.trongridApiKey, cursor, fetchFn);
    case 'SOL':
      return fetchSolana(wallet, token, settings.solanaRpcUrl, cursor, fetchFn);
  }
}

export async function syncWallet(walletId: string, onProgress?: (msg: string) => void, fetchFn?: FetchFn): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { walletId, added: 0, duplicates: 0, truncated: false };
  const s0 = getState();
  const wallet = s0.wallets.find((w) => w.id === walletId);
  if (!wallet) return { ...outcome, error: 'Wallet not found' };
  if (wallet.demo) return { ...outcome, error: 'Demo wallets are not synced.' };
  const cursor = { ...(wallet.cursor ?? {}) };
  const errors: string[] = [];
  for (const token of TOKENS) {
    onProgress?.(`${wallet.label}: fetching ${token}…`);
    try {
      const res = await fetchFor({ ...wallet, cursor }, token, getState().settings, fetchFn);
      const now = new Date().toISOString();
      const wallets = getState().wallets;
      const txs: Transaction[] = [];
      for (const r of res.transfers) {
        const dir = deriveDirection({ chain: wallet.chain, from: r.from, to: r.to }, wallets);
        if (!dir) continue;
        txs.push({
          id: txKey(wallet.chain, r.hash, token, r.from, r.to, r.amount),
          chain: wallet.chain,
          token,
          hash: r.hash,
          timestamp: r.timestamp,
          from: r.from,
          to: r.to,
          amount: r.amount,
          walletId: dir.walletId,
          direction: dir.direction,
          memo: r.memo,
          block: r.block,
          source: 'api',
          importedAt: now,
        });
      }
      const { added, duplicates } = addTransactions(txs, `${wallet.label} ${token} sync`);
      outcome.added += added;
      outcome.duplicates += duplicates;
      outcome.truncated ||= res.truncated;
      if (res.cursor) cursor[token] = res.cursor;
    } catch (e) {
      errors.push(`${token}: ${(e as Error).message}`);
    }
  }
  if (errors.length) outcome.error = errors.join(' · ');
  updateWallet(walletId, { cursor, lastSyncAt: new Date().toISOString(), lastSyncError: outcome.error }, false);
  return outcome;
}
