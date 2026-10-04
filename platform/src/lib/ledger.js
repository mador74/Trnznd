import { ASSETS } from '../data/seed.js';

export const priceOf = (asset) => ASSETS[asset]?.price ?? 0;
export const usdOf = (asset, qty) => qty * priceOf(asset);

/** { [connectionId]: { [asset]: qty } } = opening balances + every ledger movement. */
export function balances(state) {
  const out = {};
  for (const c of state.connections) out[c.id] = { ...(state.opening[c.id] || {}) };
  for (const t of state.transactions) {
    if (!out[t.connectionId]) continue;
    out[t.connectionId][t.asset] = (out[t.connectionId][t.asset] || 0) + t.amount;
  }
  return out;
}

export function connectionUsd(bal) {
  return Object.entries(bal || {}).reduce((s, [a, q]) => s + usdOf(a, q), 0);
}

export function totalsByAsset(state, bal = balances(state)) {
  const out = {};
  for (const c of state.connections) for (const [a, q] of Object.entries(bal[c.id] || {})) out[a] = (out[a] || 0) + q;
  return Object.entries(out)
    .map(([asset, qty]) => ({ asset, qty, usd: usdOf(asset, qty), kind: ASSETS[asset]?.kind }))
    .sort((a, b) => b.usd - a.usd);
}

/** Daily aggregate USD value over the last `days` days (at today's demo prices). */
export function history(state, days = 90, connectionId = null, now = Date.now()) {
  const conns = state.connections.filter((c) => !connectionId || c.id === connectionId);
  const ids = new Set(conns.map((c) => c.id));
  const bal = balances(state);
  let value = conns.reduce((s, c) => s + connectionUsd(bal[c.id]), 0);
  const txs = state.transactions.filter((t) => ids.has(t.connectionId)); // newest first
  const points = [];
  let i = 0;
  for (let d = 0; d <= days; d++) {
    const dayEnd = now - d * 86400000;
    while (i < txs.length && new Date(txs[i].date).getTime() > dayEnd) {
      value -= usdOf(txs[i].asset, txs[i].amount);
      i++;
    }
    points.push({ date: new Date(dayEnd).toISOString().slice(0, 10), usd: Math.round(value) });
  }
  return points.reverse();
}

/** Inflow / outflow per month (excluding internal transfers, which net to zero). */
export function cashflow(state, months = 6, now = new Date()) {
  const buckets = [];
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    buckets.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-GB', { month: 'short' }), in: 0, out: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const t of state.transactions) {
    if (t.internal || t.type === 'conversion') continue;
    const b = byKey[t.date.slice(0, 7)];
    if (!b) continue;
    const v = usdOf(t.asset, t.amount);
    if (v >= 0) b.in += v;
    else b.out += -v;
  }
  return buckets.map((b) => ({ ...b, in: Math.round(b.in), out: Math.round(b.out) }));
}

export const TX_TYPES = {
  deposit: 'Received',
  withdrawal: 'Sent',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  conversion: 'Conversion',
  fee: 'Fee',
};
