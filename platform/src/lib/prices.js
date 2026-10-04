// Demo price history. Crypto prices move day by day before `anchor` (the date the demo data was
// created) and equal today's demo price from then on; stablecoins and fiat stay flat.
// Production replaces this with a priced data feed (with source and timestamp for audit).

import { ASSETS } from '../data/seed.js';

const DAY = 86400000;
const PHASE = { BTC: 0.4, ETH: 1.7, SOL: 2.9 };

/** Fair value of one unit of `asset` (in USD) on the date of `iso`. */
export function priceAt(asset, iso, anchor) {
  const base = ASSETS[asset]?.price ?? 0;
  if (ASSETS[asset]?.kind !== 'crypto' || !anchor) return base;
  const d = Math.max(0, Math.floor((Date.parse(anchor) - Date.parse(iso)) / DAY));
  const phase = PHASE[asset] ?? 1;
  return base * (1 + 0.1 * (Math.sin(d / 15 + phase) - Math.sin(phase)) - 0.0007 * d);
}

/** Value of a ledger line at its transaction date, in USD (the reporting currency). */
export const valueAt = (tx, anchor) => tx.amount * priceAt(tx.asset, tx.date, anchor);
