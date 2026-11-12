import type { Chain, Token } from './types';
import { normAddress, normHash } from './chains';

export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

/**
 * Deterministic transaction id, so the same transfer imported twice (API + CSV, or two
 * overlapping CSV files) is stored once. One on-chain hash can contain several transfers,
 * so token, parties and amount are part of the key.
 */
export function txKey(chain: Chain, hash: string, token: Token, from: string, to: string, amount: number): string {
  return [chain, normHash(chain, hash), token, normAddress(chain, from), normAddress(chain, to), amount].join(':');
}
