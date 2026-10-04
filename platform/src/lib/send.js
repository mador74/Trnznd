// Outgoing crypto payments: who can send, how each source signs, and pre-flight checks.
// Pure functions, unit tested in send.test.js.

import { ASSET_NETWORKS, isFiatConn } from '../data/seed.js';

// TRNZND is non-custodial: it never holds private keys or customer funds. A released payment is an
// instruction passed through, by API, to the provider that holds the assets; the provider executes it.
export const SEND_METHODS = {
  wallet: {
    label: 'Passed to your wallet to sign',
    detail: 'TRNZND prepares the payment and hands it to your own wallet app or hardware wallet. You sign it there; your keys never leave your device.',
  },
  custodian: {
    label: 'Instruction passed to your custodian',
    detail: 'TRNZND passes your authorised instruction to the custodian by API. The custodian holds the assets and executes the payment, and its own controls still apply.',
  },
  exchange: {
    label: 'Instruction passed to your exchange',
    detail: 'TRNZND passes your authorised withdrawal instruction to the exchange by API. The exchange holds the assets and executes the payment, and its own controls still apply.',
  },
  otc: {
    label: 'Instruction passed to your broker',
    detail: 'TRNZND passes your authorised instruction to the broker by API. The broker holds the assets and executes the payment.',
  },
};

/** Why `user` can't give the final release for a payment, or null if they can. */
export function cannotReleaseReason(user) {
  if (!user || user.status !== 'active') return 'Only active users can release payments.';
  if (user.role === 'viewer') return 'Viewers cannot release payments.';
  if (!user.canRelease) return 'Only authorised payment releasers can give the final release.';
  return null;
}

/** Demo network-fee estimates in USD. Real fees move with network demand. */
export const NETWORK_FEE_USD = { Ethereum: 2.5, Tron: 1.5, Solana: 0.01, Bitcoin: 3, Polygon: 0.02, Arbitrum: 0.1, Base: 0.05 };

/** Why a connection can't be used as a payment source, or null if it can. */
export function sourceBlockReason(conn) {
  if (!conn) return 'Choose an account to pay from.';
  if (isFiatConn(conn)) return 'Bank and card payments are not available yet.';
  if (!conn.sendEnabled) return 'Sending is not switched on for this connection.';
  return null;
}

/**
 * Pre-flight checks for a payment to a whitelisted address.
 * Returns an error message, or null when the payment can be submitted.
 */
export function checkPayment({ conn, asset, amount, available, dest }) {
  const block = sourceBlockReason(conn);
  if (block) return block;
  if (!conn.assets.includes(asset)) return `${conn.name} does not hold ${asset}.`;
  if (!(amount > 0)) return 'Enter an amount.';
  if (amount > available) return `That is more than the available balance (${available.toLocaleString('en-US')} ${asset}).`;
  if (!dest) return 'Payments can only go to a whitelisted address.';
  if (!(ASSET_NETWORKS[asset] || []).includes(dest.network))
    return `${asset} cannot be sent to a ${dest.network} address. Whitelist a ${(ASSET_NETWORKS[asset] || []).join(' / ')} address first.`;
  if (conn.type === 'wallet' && conn.network !== dest.network)
    return `${conn.name} is on ${conn.network}, but this address is on ${dest.network}. Pay from a ${dest.network} account.`;
  return null;
}
