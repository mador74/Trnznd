export type DateOrder = 'auto' | 'dmy' | 'mdy';

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a), using the date part only. */
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((db - da) / 86_400_000);
}

/**
 * Parse the date formats found in explorer and exchange exports into an ISO UTC string.
 * Accepts ISO 8601, "YYYY-MM-DD HH:mm:ss" (treated as UTC), Unix seconds or milliseconds,
 * and DD/MM/YYYY or MM/DD/YYYY (order chosen by `order`; "auto" resolves only unambiguous dates).
 */
export function parseDateInput(input: string | number | null | undefined, order: DateOrder = 'auto'): string | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d{9,10}$/.test(s)) return new Date(Number(s) * 1000).toISOString();
  if (/^\d{12,13}$/.test(s)) return new Date(Number(s)).toISOString();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', se = '0', tz] = m;
    if (tz && !/^(z|utc)$/i.test(tz)) {
      const t = Date.parse(`${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${se.padStart(2, '0')}${tz.length === 5 ? tz.slice(0, 3) + ':' + tz.slice(3) : tz}`);
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i.exec(s);
  if (m) {
    const [, a, b, y, h = '0', mi = '0', se = '0', ap] = m;
    let day: number, month: number;
    if (order === 'dmy') [day, month] = [+a, +b];
    else if (order === 'mdy') [month, day] = [+a, +b];
    else if (+a > 12) [day, month] = [+a, +b];
    else if (+b > 12) [month, day] = [+a, +b];
    else return null; // ambiguous
    let hour = +h;
    if (ap) hour = (hour % 12) + (ap.toLowerCase() === 'pm' ? 12 : 0);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(+y, month - 1, day, hour, +mi, +se)).toISOString();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function formatDate(iso: string | undefined, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit', timeZone: iso.length === 10 ? 'UTC' : undefined };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString(undefined, opts);
}

export type ExportDateFormat = 'iso' | 'dmy' | 'mdy';

export function formatExportDate(iso: string, fmt: ExportDateFormat): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (fmt === 'dmy') return `${day}/${m}/${y}`;
  if (fmt === 'mdy') return `${m}/${day}/${y}`;
  return d;
}
