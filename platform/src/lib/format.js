import { fromUsd } from './fx.js';

// Values are held in USD everywhere. `money` / `moneyShort` show a USD amount in the viewer's
// chosen display currency; `usd` always shows US dollars (plan prices, policy thresholds).
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
export const usd = (n) => usdFmt.format(n || 0);

let display = 'USD';
let fmt = usdFmt;
let compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

/** Called by the store whenever the signed-in user's display currency changes. */
export function setDisplayCurrency(code) {
  if (code === display) return;
  display = code;
  fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }); // minor units per ISO 4217 (e.g. JPY, VND, CLP: none)
  compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 });
}
export const displayCurrency = () => display;
export const money = (nUsd) => fmt.format(fromUsd(nUsd || 0, display));
export const moneyShort = (nUsd) => compact.format(fromUsd(nUsd || 0, display));

export function amount(n, asset) {
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 4 : 6;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: digits })} ${asset}`;
}

export const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const shortAddr = (a) => (!a ? '—' : a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function relative(iso, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** RFC 4180 CSV. */
export function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
