// Partner integrations: fiat on-ramp, self-custody multisig wallets, and ZEND minting/redemption.
// TRNZIT stays non-custodial throughout: it hands the user to the partner (onboarding, checkout,
// wallet signing) and records the result. Every figure marked PLACEHOLDER must be replaced with the
// partner's real terms before launch. Pure functions, unit tested in partners.test.js.

import { ASSETS } from '../data/seed.js';

export const PARTNERS = {
  onramp: {
    name: 'On-ramp partner',
    ref: 'our on-ramp partner',
    role: 'Fiat on-ramp',
    blurb: 'Buy stablecoins with fiat through our regulated on-ramp partner. The partner runs identity checks and checkout, and holds the coins in a custody account in your business’s name.',
    // PLACEHOLDER: confirm with the on-ramp partner which business accounts, currencies, assets and custody options are offered.
    fiat: ['USD', 'EUR', 'GBP'],
    assets: ['USDC', 'USDT'],
    feeRate: 0.01, // PLACEHOLDER for the demo only; not the partner's pricing. Real fees are shown at the partner's checkout.
  },
  trnznd: {
    name: 'TRNZND',
    ref: 'TRNZND',
    role: 'ZEND minting & redemption',
    blurb: 'Mint ZEND by sending fiat to TRNZND, or redeem ZEND back to fiat in your bank account. TRNZND is the issuer of ZEND.',
    // ZEND networks confirmed: Ethereum, Solana, Tron. PLACEHOLDER: confirm accepted currencies, minimums and fees.
    fiat: ['USD', 'EUR', 'GBP'],
    networks: ['Ethereum', 'Solana', 'Tron'],
    minimum: 10000,
    mintFeeRate: 0,
    redeemFeeRate: 0,
  },
};

export const MULTISIG_PROVIDERS = {
  safe: {
    name: 'Safe',
    blurb: 'Smart-account multisig for Ethereum and other EVM networks (formerly Gnosis Safe).',
    networks: ['Ethereum', 'Base', 'Arbitrum', 'Polygon'],
    assets: { Ethereum: ['ETH', 'USDC', 'USDT', 'ZEND'], Base: ['ETH', 'USDC'], Arbitrum: ['ETH', 'USDC', 'USDT'], Polygon: ['USDC', 'USDT'] },
  },
  squads: {
    name: 'Squads',
    blurb: 'Multisig for Solana.',
    networks: ['Solana'],
    assets: { Solana: ['SOL', 'USDC', 'USDT', 'ZEND'] },
  },
};

/** Reasons a multisig setup is invalid (empty array = valid). */
export function validateMultisig({ name, owners, threshold }) {
  const errors = [];
  if (!name || !name.trim()) errors.push('Give the wallet a name.');
  if (!owners || owners.length < 2) errors.push('Add at least two owners.');
  if (!Number.isInteger(threshold) || threshold < 1) errors.push('Signatures required must be at least 1.');
  else if (owners && threshold > owners.length) errors.push(`Signatures required (${threshold}) cannot exceed the number of owners (${owners.length}).`);
  else if (threshold === 1 && owners?.length > 1) errors.push('A 1-of-N wallet lets any single owner move funds. Require at least 2 signatures.');
  if (owners && new Set(owners.map((o) => o.address.toLowerCase())).size !== owners.length) errors.push('Each owner needs a different address.');
  return errors;
}

/** Fiat → stablecoin purchase estimate. The provider's checkout shows the binding price. */
export function onrampQuote(fiat, fiatAmount, asset) {
  const fee = fiatAmount * PARTNERS.onramp.feeRate;
  const receive = ((fiatAmount - fee) * ASSETS[fiat].price) / ASSETS[asset].price;
  return { fee, receive };
}

/** Fiat → ZEND at the issuer's rate. Demo uses the placeholder ZEND valuation. */
export function mintQuote(fiat, fiatAmount) {
  const fee = fiatAmount * PARTNERS.trnznd.mintFeeRate;
  const zend = ((fiatAmount - fee) * ASSETS[fiat].price) / ASSETS.ZEND.price;
  return { fee, zend };
}

/** ZEND → fiat at the issuer's rate. */
export function redeemQuote(zendAmount, fiat) {
  const gross = (zendAmount * ASSETS.ZEND.price) / ASSETS[fiat].price;
  const fee = gross * PARTNERS.trnznd.redeemFeeRate;
  return { fee, fiat: gross - fee };
}

/** The TRNZND redemption address to use for ZEND held in `conn` (custodians default to Ethereum). */
export function redemptionAddressFor(conn, whitelist, ids = []) {
  const network = PARTNERS.trnznd.networks.includes(conn?.network) ? conn.network : 'Ethereum';
  return whitelist.find((w) => ids.includes(w.id) && w.network === network);
}
