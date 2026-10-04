// Outgoing crypto payments: who can send, how each source signs, and pre-flight checks.
// Pure functions, unit tested in send.test.js.

import { ASSET_NETWORKS, isFiatConn } from '../data/seed.js';

/** How a payment from each kind of connection is signed and broadcast in production. */
export const SEND_METHODS = {
  wallet: {
    label: 'Sign in your own wallet',
    detail: 'The payment is signed by your wallet app or hardware wallet. TRNZND never holds the private key.',
  },
  custodian: {
    label: 'Submit to custodian',
    detail: 'TRNZND submits the payment through the custodian’s API. The custodian’s own policy engine may require its own sign-off as well.',
  },
  exchange: {
    label: 'Withdraw via exchange API',
    detail: 'Needs a separate withdrawal-only API key, IP-restricted, with the destination also whitelisted at the exchange.',
  },
  otc: {
    label: 'Withdraw via broker API',
    detail: 'Needs a separate withdrawal-only API key with the destination whitelisted at the broker.',
  },
};

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
