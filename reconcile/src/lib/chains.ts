import type { Chain, Token } from './types';

export const CHAIN_NAMES: Record<Chain, string> = {
  ETH: 'Ethereum',
  SOL: 'Solana',
  TRX: 'Tron',
};
export const CHAIN_STANDARD: Record<Chain, string> = {
  ETH: 'ERC-20',
  SOL: 'SPL',
  TRX: 'TRC-20',
};

/**
 * Canonical token contracts / mints. These are the widely published issuer addresses;
 * verify against Tether's and Circle's own pages before relying on them for funds.
 */
export const TOKEN_CONTRACTS: Record<Chain, Record<Token, string>> = {
  ETH: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  SOL: {
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  TRX: {
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  },
};

/** Circle stopped minting USDC on Tron in Feb 2024 and said support would end in Feb 2025. */
export function tokenWarning(chain: Chain, token: Token): string | null {
  if (chain === 'TRX' && token === 'USDC') {
    return 'Circle stopped minting USDC on Tron in February 2024 and announced the end of support in February 2025. Confirm the counterparty really intends to settle in USDC on Tron.';
  }
  return null;
}

const BASE58 = '[1-9A-HJ-NP-Za-km-z]';
const PATTERNS: Record<Chain, RegExp> = {
  ETH: /^0x[0-9a-fA-F]{40}$/,
  SOL: new RegExp(`^${BASE58}{32,44}$`),
  TRX: new RegExp(`^T${BASE58}{33}$`),
};

/** Format check only (no checksum verification). */
export function isValidAddress(chain: Chain, address: string): boolean {
  return PATTERNS[chain].test(address.trim());
}

/** Ethereum addresses compare case-insensitively; Solana and Tron are case-sensitive base58. */
export function normAddress(chain: Chain, address: string | undefined | null): string {
  const a = (address ?? '').trim();
  return chain === 'ETH' ? a.toLowerCase() : a;
}

export function sameAddress(chain: Chain, a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normAddress(chain, a) === normAddress(chain, b);
}

export function normHash(chain: Chain, hash: string): string {
  const h = hash.trim();
  if (chain === 'SOL') return h;
  const hex = h.toLowerCase().replace(/^0x/, '');
  return chain === 'ETH' ? `0x${hex}` : hex;
}

export function explorerTxUrl(chain: Chain, hash: string): string {
  switch (chain) {
    case 'ETH':
      return `https://etherscan.io/tx/${hash}`;
    case 'SOL':
      return `https://solscan.io/tx/${hash}`;
    case 'TRX':
      return `https://tronscan.org/#/transaction/${hash.replace(/^0x/, '')}`;
  }
}

export function explorerAddressUrl(chain: Chain, address: string): string {
  switch (chain) {
    case 'ETH':
      return `https://etherscan.io/address/${address}`;
    case 'SOL':
      return `https://solscan.io/account/${address}`;
    case 'TRX':
      return `https://tronscan.org/#/address/${address}`;
  }
}

export function shortAddress(a: string, head = 6, tail = 4): string {
  if (!a) return '';
  return a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function parseChain(v: string | undefined | null): Chain | null {
  const s = (v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/^(eth|ethereum|erc-?20|mainnet)$/.test(s) || s.includes('ethereum') || s.includes('erc20') || s.includes('erc-20')) return 'ETH';
  if (/^(sol|solana|spl)$/.test(s) || s.includes('solana')) return 'SOL';
  if (/^(trx|tron|trc-?20)$/.test(s) || s.includes('tron') || s.includes('trc20') || s.includes('trc-20')) return 'TRX';
  return null;
}

export function parseToken(v: string | undefined | null): Token | null {
  const raw = (v ?? '').trim();
  const s = raw.toLowerCase();
  if (!s) return null;
  for (const chain of Object.keys(TOKEN_CONTRACTS) as Chain[]) {
    for (const [tok, addr] of Object.entries(TOKEN_CONTRACTS[chain]) as [Token, string][]) {
      if (normAddress(chain, raw) === normAddress(chain, addr)) return tok;
    }
  }
  if (s === 'usdt' || s.includes('tether') || s.startsWith('usdt')) return 'USDT';
  if (s === 'usdc' || s.includes('usd coin') || s.startsWith('usdc')) return 'USDC';
  return null;
}

/** Guess the chain from an address or hash format. Returns null when ambiguous. */
export function guessChainFromAddress(address: string): Chain | null {
  const matches = (['ETH', 'TRX', 'SOL'] as Chain[]).filter((c) => isValidAddress(c, address));
  if (matches.includes('ETH')) return 'ETH';
  if (matches.includes('TRX')) return 'TRX';
  return matches.length === 1 ? matches[0] : null;
}
