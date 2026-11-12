import type { Token, Wallet } from '../lib/types';
import { TOKEN_CONTRACTS } from '../lib/chains';
import { type FetchFn, type FetchResult, type RawTransfer, fetchJson, sleep } from './common';

/**
 * Solana SPL transfers via standard JSON-RPC:
 *  1. getTokenAccountsByOwner(wallet, { mint }) -> the wallet's token accounts for USDT/USDC
 *  2. getSignaturesForAddress(tokenAccount, { limit, until, before }) -> signatures (newest first)
 *  3. getTransaction(signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 })
 *     -> the wallet's balance change from meta.preTokenBalances / postTokenBalances
 * Token accounts are scanned (not the wallet address) because an incoming SPL transfer
 * references the recipient's token account, not the wallet itself.
 * The public endpoint is heavily rate-limited; a private RPC URL is recommended.
 */
export const SOLANA_PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const SIG_PAGE = 1000;
/** Transactions fetched per sync and token: kept low on the rate-limited public endpoint. */
const MAX_TX_PUBLIC = 150;
const MAX_TX_PRIVATE = 1000;
const MAX_SIG_PAGES = 10;

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

interface ParsedTx {
  blockTime?: number | null;
  slot?: number;
  meta?: { err: unknown; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } | null;
  transaction?: { message?: { accountKeys?: ({ pubkey: string } | string)[] } };
}

interface SigInfo {
  signature: string;
  err: unknown;
  memo: string | null;
  blockTime?: number | null;
  slot?: number;
}

let rpcId = 1;
async function rpc<T>(fetchFn: FetchFn, url: string, method: string, params: unknown[]): Promise<T> {
  const json = await fetchJson<{ result?: T; error?: { code: number; message: string } }>(fetchFn, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
  });
  if (json.error) throw new Error(`Solana RPC ${method}: ${json.error.message}`);
  return json.result as T;
}

/** "[12] invoice PR-0001" -> "invoice PR-0001" (the RPC prefixes each memo with its length). */
export function cleanMemo(memo: string | null | undefined): string | undefined {
  if (!memo) return undefined;
  const s = memo
    .split(/;\s*/)
    .map((m) => m.replace(/^\[\d+\]\s*/, ''))
    .join('; ')
    .trim();
  return s || undefined;
}

/** The wallet's net change for `mint` in one transaction, and the main counterparty. */
export function parseSolanaTx(tx: ParsedTx, wallet: string, mint: string, ownTokenAccounts: string[]): { delta: bigint; counterparty: string } | null {
  if (!tx?.meta || tx.meta.err) return null;
  const keys = (tx.transaction?.message?.accountKeys ?? []).map((k) => (typeof k === 'string' ? k : k.pubkey));
  const ownerOf = (b: TokenBalance) => b.owner ?? (ownTokenAccounts.includes(keys[b.accountIndex]) ? wallet : keys[b.accountIndex] ?? '');
  const deltas = new Map<string, bigint>();
  const addTo = (b: TokenBalance, sign: bigint) => {
    if (b.mint !== mint) return;
    const o = ownerOf(b);
    deltas.set(o, (deltas.get(o) ?? 0n) + sign * BigInt(b.uiTokenAmount.amount));
  };
  for (const b of tx.meta.preTokenBalances ?? []) addTo(b, -1n);
  for (const b of tx.meta.postTokenBalances ?? []) addTo(b, 1n);
  const delta = deltas.get(wallet) ?? 0n;
  if (delta === 0n) return null;
  let counterparty = '';
  let best = 0n;
  for (const [owner, d] of deltas) {
    if (owner === wallet) continue;
    const opposite = delta > 0n ? -d : d;
    if (opposite > best) {
      best = opposite;
      counterparty = owner;
    }
  }
  return { delta, counterparty };
}

export async function fetchSolana(wallet: Wallet, token: Token, rpcUrl: string | undefined, cursor: string | undefined, fetchFn: FetchFn = fetch): Promise<FetchResult> {
  const url = rpcUrl?.trim() || SOLANA_PUBLIC_RPC;
  const mint = TOKEN_CONTRACTS.SOL[token];
  const pause = url === SOLANA_PUBLIC_RPC ? 400 : 60;
  const cursors: Record<string, string> = cursor ? JSON.parse(cursor) : {};
  const accounts = await rpc<{ value: { pubkey: string }[] }>(fetchFn, url, 'getTokenAccountsByOwner', [wallet.address, { mint }, { encoding: 'jsonParsed' }]);
  const tokenAccounts = accounts.value.map((a) => a.pubkey);
  const transfers: RawTransfer[] = [];
  const seen = new Set<string>();
  let truncated = false;
  let budget = url === SOLANA_PUBLIC_RPC ? MAX_TX_PUBLIC : MAX_TX_PRIVATE;
  for (const acct of tokenAccounts) {
    const until = cursors[acct];
    const sigs: SigInfo[] = [];
    let before: string | undefined;
    // Page back until the last processed signature (or the start of history), so nothing
    // between syncs is skipped. Listing is cheap; fetching each transaction is what is budgeted.
    for (let pageNo = 0; ; pageNo++) {
      const opts: Record<string, unknown> = { limit: SIG_PAGE };
      if (until) opts.until = until;
      if (before) opts.before = before;
      const page = await rpc<SigInfo[]>(fetchFn, url, 'getSignaturesForAddress', [acct, opts]);
      sigs.push(...page);
      if (page.length < SIG_PAGE) break;
      if (pageNo + 1 >= MAX_SIG_PAGES) {
        truncated = true; // history older than this window is not fetched; import it by CSV
        break;
      }
      before = page[page.length - 1].signature;
      await sleep(pause);
    }
    // Oldest first, so a truncated sync resumes cleanly from the newest processed signature.
    const ordered = sigs.filter((s) => !s.err && !seen.has(s.signature)).reverse();
    let newest = until;
    for (const s of ordered) {
      if (budget <= 0) {
        truncated = true;
        break;
      }
      seen.add(s.signature);
      budget--;
      const tx = await rpc<ParsedTx | null>(fetchFn, url, 'getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
      newest = s.signature;
      await sleep(pause);
      if (!tx) continue;
      const parsed = parseSolanaTx(tx, wallet.address, mint, tokenAccounts);
      if (!parsed) continue;
      const incoming = parsed.delta > 0n;
      const abs = incoming ? parsed.delta : -parsed.delta;
      const time = tx.blockTime ?? s.blockTime;
      transfers.push({
        hash: s.signature,
        token,
        from: incoming ? parsed.counterparty : wallet.address,
        to: incoming ? wallet.address : parsed.counterparty,
        amount: Number(abs), // USDT and USDC mints use 6 decimals = micro-units
        timestamp: time ? new Date(time * 1000).toISOString() : new Date().toISOString(),
        block: tx.slot ?? s.slot,
        memo: cleanMemo(s.memo),
      });
    }
    if (newest) cursors[acct] = newest;
  }
  return { transfers, cursor: JSON.stringify(cursors), truncated };
}
