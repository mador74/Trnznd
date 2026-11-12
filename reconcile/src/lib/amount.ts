/**
 * Amounts are stored as integer micro-units (6 decimals). USDT and USDC use 6 decimals
 * on Ethereum, Solana and Tron, so one micro-unit is the smallest on-chain unit.
 * Number.MAX_SAFE_INTEGER micro-units is ~9 billion tokens, far above any single settlement.
 */
export const DECIMALS = 6;
export const UNIT = 1_000_000;

/** Parse a human decimal string ("1,234.56", "1234.5", "-12") into micro-units. Returns null if invalid. */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[\s,_]/g, '').replace(/^\+/, '');
  if (s === '') return null;
  // Strip a trailing token symbol, e.g. "100 USDT".
  s = s.replace(/(usdt|usdc|usd|\$)$/i, '').replace(/^\$/, '');
  if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(s)) s = Number(s).toFixed(DECIMALS);
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return null;
  const neg = m[1] === '-';
  const whole = m[2] || '0';
  let frac = m[3] ?? '';
  let roundUp = false;
  if (frac.length > DECIMALS) {
    roundUp = Number(frac[DECIMALS]) >= 5;
    frac = frac.slice(0, DECIMALS);
  }
  frac = frac.padEnd(DECIMALS, '0');
  let micro = Number(whole) * UNIT + Number(frac);
  if (roundUp) micro += 1;
  if (!Number.isSafeInteger(micro)) return null;
  return neg ? -micro : micro;
}

/** Convert an integer string in token base units with `decimals` decimals into micro-units. */
export function fromBaseUnits(value: string | number, decimals: number): number {
  const raw = BigInt(String(value).split('.')[0] || '0');
  let micro: bigint;
  if (decimals === DECIMALS) micro = raw;
  else if (decimals > DECIMALS) {
    const div = 10n ** BigInt(decimals - DECIMALS);
    micro = (raw + div / 2n) / div;
  } else micro = raw * 10n ** BigInt(DECIMALS - decimals);
  const n = Number(micro);
  if (!Number.isSafeInteger(n)) throw new Error(`Amount too large: ${value}`);
  return n;
}

/** Plain decimal string without grouping, e.g. 1234.5 -> "1234.500000" trimmed to at least 2 dp. */
export function toDecimalString(micro: number, minDp = 2): string {
  const neg = micro < 0;
  const abs = Math.abs(Math.round(micro));
  const whole = Math.floor(abs / UNIT);
  let frac = String(abs % UNIT).padStart(DECIMALS, '0');
  while (frac.length > minDp && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}

/** Display format with thousands separators: 1234567.5 -> "1,234,567.50". */
export function formatAmount(micro: number, opts: { sign?: boolean; minDp?: number } = {}): string {
  const s = toDecimalString(Math.abs(micro), opts.minDp ?? 2);
  const [w, f] = s.split('.');
  const grouped = w.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = micro < 0 ? '−' : opts.sign && micro > 0 ? '+' : '';
  return `${sign}${grouped}${f ? '.' + f : ''}`;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
