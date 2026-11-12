import type { Token, Wallet } from '../lib/types';
import { TOKEN_CONTRACTS } from '../lib/chains';
import { fromBaseUnits } from '../lib/amount';
import { type FetchFn, type FetchResult, type RawTransfer, fetchJson, sleep } from './common';

/**
 * Tron TRC-20 transfers via TronGrid: GET /v1/accounts/{address}/transactions/trc20
 * with contract_address, limit (max 200), only_confirmed, min_timestamp, and the
 * `fingerprint` from meta of the previous page for pagination. An API key is optional
 * (sent as the TRON-PRO-API-KEY header) but raises rate limits.
 */
export const TRONGRID_BASE = 'https://api.trongrid.io';
const LIMIT = 200;
const MAX_PAGES = 25;

interface TronTrc20Tx {
  transaction_id: string;
  token_info?: { address?: string; decimals?: number; symbol?: string };
  block_timestamp: number;
  from: string;
  to: string;
  type?: string;
  value: string;
}

interface TronResponse {
  data?: TronTrc20Tx[];
  success?: boolean;
  error?: string;
  meta?: { fingerprint?: string; links?: { next?: string } };
}

export function parseTron(json: TronResponse, token: Token): RawTransfer[] {
  if (json.success === false) throw new Error(`TronGrid: ${json.error ?? 'request failed'}`);
  const contract = TOKEN_CONTRACTS.TRX[token];
  return (json.data ?? [])
    .filter((t) => !t.type || t.type === 'Transfer')
    .filter((t) => !t.token_info?.address || t.token_info.address === contract)
    .map((t) => ({
      hash: t.transaction_id,
      token,
      from: t.from,
      to: t.to,
      amount: fromBaseUnits(t.value, t.token_info?.decimals ?? 6),
      timestamp: new Date(Number(t.block_timestamp)).toISOString(),
    }));
}

export async function fetchTron(wallet: Wallet, token: Token, apiKey: string | undefined, cursor: string | undefined, fetchFn: FetchFn = fetch): Promise<FetchResult> {
  const minTs = cursor ? Number(cursor) : 0;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;
  const all: RawTransfer[] = [];
  let fingerprint: string | undefined;
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(LIMIT), contract_address: TOKEN_CONTRACTS.TRX[token], only_confirmed: 'true' });
    if (minTs) params.set('min_timestamp', String(minTs));
    if (fingerprint) params.set('fingerprint', fingerprint);
    const json = await fetchJson<TronResponse>(fetchFn, `${TRONGRID_BASE}/v1/accounts/${wallet.address}/transactions/trc20?${params}`, { headers });
    all.push(...parseTron(json, token));
    fingerprint = json.meta?.fingerprint;
    if (!fingerprint || (json.data ?? []).length < LIMIT) break;
    if (page === MAX_PAGES) truncated = true;
    await sleep(apiKey ? 120 : 350);
  }
  const maxTs = all.reduce((m, t) => Math.max(m, Date.parse(t.timestamp)), minTs);
  return { transfers: all, cursor: String(maxTs), truncated };
}
