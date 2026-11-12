import type { Token } from '../lib/types';

/** A token transfer as read from a chain API, before it is attached to the company's wallets. */
export interface RawTransfer {
  hash: string;
  token: Token;
  from: string;
  to: string;
  amount: number; // micro-units
  timestamp: string; // ISO
  block?: number;
  memo?: string;
}

export interface FetchResult {
  transfers: RawTransfer[];
  cursor?: string;
  /** True when the per-sync page limit was hit and more history remains. */
  truncated: boolean;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(fetchFn: FetchFn, url: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, signal: ctrl?.signal });
  } catch (e) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    })();
    const reason = (e as Error)?.name === 'AbortError' ? 'timed out' : 'could not be reached';
    throw new Error(`${host} ${reason}. It may be down, rate-limiting you, or blocking requests from a browser (CORS).`);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 429) throw new Error(`Rate limited by ${new URL(url).host} (HTTP 429). Wait a minute, or add an API key / private RPC in Settings.`);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}
