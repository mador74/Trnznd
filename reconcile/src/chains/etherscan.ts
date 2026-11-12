import type { Token, Wallet } from '../lib/types';
import { TOKEN_CONTRACTS } from '../lib/chains';
import { fromBaseUnits } from '../lib/amount';
import { type FetchFn, type FetchResult, type RawTransfer, fetchJson, sleep } from './common';

/**
 * Ethereum ERC-20 transfers via the Etherscan API V2 "tokentx" endpoint
 * (module=account, action=tokentx, chainid=1). Needs a free Etherscan API key.
 * Paging: page * offset is capped by Etherscan, so we page within a block range and
 * resume from the last block seen on the next sync (the store de-duplicates overlaps).
 */
export const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const OFFSET = 1000;
const MAX_PAGES = 10;

interface EtherscanTokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenDecimal?: string;
  tokenSymbol?: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTokenTx[] | string;
}

export function parseEtherscan(json: EtherscanResponse, token: Token): RawTransfer[] {
  if (json.status !== '1') {
    const text = `${json.message ?? ''} ${typeof json.result === 'string' ? json.result : ''}`;
    if (/no (token )?transactions found/i.test(text)) return [];
    throw new Error(`Etherscan: ${text.trim() || 'unknown error'}`);
  }
  if (!Array.isArray(json.result)) return [];
  const contract = TOKEN_CONTRACTS.ETH[token].toLowerCase();
  return json.result
    .filter((t) => (t.contractAddress ?? '').toLowerCase() === contract)
    .map((t) => ({
      hash: t.hash,
      token,
      from: t.from,
      to: t.to,
      amount: fromBaseUnits(t.value, Number(t.tokenDecimal ?? 6) || 6),
      timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
      block: Number(t.blockNumber),
    }));
}

export async function fetchEthereum(wallet: Wallet, token: Token, apiKey: string | undefined, cursor: string | undefined, fetchFn: FetchFn = fetch): Promise<FetchResult> {
  if (!apiKey) throw new Error('Add an Etherscan API key in Settings to sync Ethereum wallets.');
  const startBlock = cursor ? Number(cursor) : 0;
  const all: RawTransfer[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      chainid: '1',
      module: 'account',
      action: 'tokentx',
      contractaddress: TOKEN_CONTRACTS.ETH[token],
      address: wallet.address,
      startblock: String(startBlock),
      endblock: '99999999',
      page: String(page),
      offset: String(OFFSET),
      sort: 'asc',
      apikey: apiKey,
    });
    const json = await fetchJson<EtherscanResponse>(fetchFn, `${ETHERSCAN_BASE}?${params}`);
    const batch = parseEtherscan(json, token);
    all.push(...batch);
    if (batch.length < OFFSET) break;
    if (page === MAX_PAGES) truncated = true;
    await sleep(350); // stay under free-tier per-second limits
  }
  const maxBlock = all.reduce((m, t) => Math.max(m, t.block ?? 0), startBlock);
  return { transfers: all, cursor: String(maxBlock), truncated };
}
