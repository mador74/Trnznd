import { ASSET_NETWORKS, isSelfCustody } from '../data/seed.js';

/** Accounts that can receive an invoice in `currency`: your own wallets (published address) or bank accounts. */
export function payToOptions(connections, currency) {
  return connections.filter(
    (c) =>
      c.assets.includes(currency) &&
      (c.type === 'bank' || (isSelfCustody(c) && c.address && (ASSET_NETWORKS[currency] || []).includes(c.network))),
  );
}

/** Human-readable payment instructions printed on the invoice. */
export function payToDetails(conn, inv) {
  if (!conn) return ['Payment details not set.'];
  if (conn.type === 'bank')
    return [
      `Bank transfer in ${inv.currency} to ${conn.institution}, account ${conn.accountMask}.`,
      'Full account details (demo): shown from your verified bank connection in production.',
      `Payment reference: ${inv.number}`,
    ];
  return [
    `Send ${inv.currency} on the ${conn.network} network ONLY. Other networks will lose funds.`,
    `Address: ${conn.address}`,
    `Please quote ${inv.number} in your remittance advice.`,
  ];
}
