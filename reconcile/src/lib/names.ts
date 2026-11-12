import type { AppData, Chain } from './types';
import { normAddress } from './chains';

/** Resolve an on-chain address to a wallet label or contact name, when known. */
export function nameResolver(data: AppData): (chain: Chain, address: string) => string | undefined {
  const m = new Map<string, string>();
  for (const c of data.contacts) for (const a of c.addresses) m.set(`${a.chain}:${normAddress(a.chain, a.address)}`, c.name);
  for (const r of data.requests) if (r.counterpartyAddress) {
    const k = `${r.chain}:${normAddress(r.chain, r.counterpartyAddress)}`;
    if (!m.has(k)) m.set(k, r.counterparty);
  }
  for (const w of data.wallets) m.set(`${w.chain}:${normAddress(w.chain, w.address)}`, `${w.label} (own)`);
  return (chain, address) => m.get(`${chain}:${normAddress(chain, address)}`);
}
