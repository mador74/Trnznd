// Converting holdings inside one connection (fiat ↔ stablecoin, stablecoin ↔ crypto, and so on).
// TRNZIT never trades on its own: it passes a one-off conversion instruction, released by an authorised
// user, to the provider holding the assets, and only for pairs that provider's API allows.
// Pure functions, unit tested in convert.test.js.

import { ASSETS, isFiatConn, isSelfCustody } from '../data/seed.js';

/** Demo provider fee (spread), as a fraction. Real fees and quotes come from the provider. */
export const CONVERT_FEE = 0.001;
export const QUOTE_SECONDS = 30;

export const PAIR_LABELS = {
  'fiat-stablecoin': 'Fiat ↔ stablecoin',
  'crypto-stablecoin': 'Stablecoin ↔ crypto',
  'crypto-fiat': 'Fiat ↔ crypto',
  'crypto-crypto': 'Crypto ↔ crypto',
  'stablecoin-stablecoin': 'Stablecoin ↔ stablecoin',
};

/** e.g. pairKind('USD', 'USDC') === 'fiat-stablecoin' (order-independent). */
export const pairKind = (from, to) => [ASSETS[from]?.kind, ASSETS[to]?.kind].sort().join('-');

/** What a new connection of this type is assumed to support until the provider's API says otherwise. */
export function defaultConvertKinds(type) {
  if (type === 'exchange') return ['fiat-stablecoin', 'crypto-stablecoin', 'crypto-fiat'];
  if (type === 'custodian' || type === 'otc') return ['crypto-stablecoin'];
  return [];
}

/** Why `conn` can't convert at all, or null if it can for at least one pair. */
export function connectionConvertBlock(conn) {
  if (!conn) return 'Choose an account.';
  if (isFiatConn(conn)) return 'Bank and card accounts are connected read-only through open banking, so they cannot convert.';
  if (isSelfCustody(conn)) return 'Self-custody wallets cannot convert inside TRNZIT. That would need an on-chain swap, which is not supported.';
  if (!(conn.convertKinds || []).length) return `${conn.name}’s API does not offer conversions.`;
  if (!conn.convertEnabled) return 'Conversions are not switched on for this connection.';
  return null;
}

/** Why `from → to` can't be converted in `conn`, or null if it can. */
export function convertBlockReason(conn, from, to) {
  const block = connectionConvertBlock(conn);
  if (block) return block;
  if (!from || !to) return 'Choose what to convert from and to.';
  if (from === to) return 'Choose two different assets.';
  if (!(conn.convertKinds || []).includes(pairKind(from, to)))
    return `${conn.name} does not allow ${from} → ${to} through its API (${PAIR_LABELS[pairKind(from, to)] || 'this pair'} is not supported).`;
  return null;
}

/** Assets `from` can be converted into at `conn`: only assets this provider supports for the account. */
export function convertTargets(conn, from) {
  if (!conn || connectionConvertBlock(conn)) return [];
  return conn.assets.filter((to) => ASSETS[to] && to !== from && !convertBlockReason(conn, from, to));
}

/** Indicative quote at demo prices: `fee` is charged in the asset received. */
export function quote(from, to, amount) {
  const rate = ASSETS[from].price / ASSETS[to].price;
  const gross = amount * rate;
  const fee = gross * CONVERT_FEE;
  return { rate, gross, fee, receive: gross - fee };
}
