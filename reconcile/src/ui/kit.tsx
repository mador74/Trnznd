import { type ReactNode, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import type { Chain, Direction, Token } from '../lib/types';
import { formatAmount } from '../lib/amount';
import { CHAIN_NAMES, explorerAddressUrl, explorerTxUrl, shortAddress } from '../lib/chains';
import { useEscape } from './hooks';
import type { RequestStatus, TxStatus } from '../lib/status';
import { REQUEST_STATUS_LABEL, TX_STATUS_LABEL } from '../lib/status';
import type { Confidence } from '../lib/match';

// ---------- icons (inline, stroke-based) ----------
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  match: 'M7 7h10M7 7l3-3M7 7l3 3M17 17H7m10 0-3-3m3 3-3 3',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  list: 'M4 6h16M4 12h16M4 18h10',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-3h11l2 3M16 13h2',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.8M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
  sync: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  x: 'M6 6l12 12M18 6 6 18',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
  bolt: 'M13 3 4 14h7l-1 7 9-11h-7z',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  report: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
};
export function Icon({ name, size }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}

export function Amount({ value, token, dir, sign = false }: { value: number; token?: Token; dir?: Direction | 'in' | 'out'; sign?: boolean }) {
  const signed = dir === 'out' ? -Math.abs(value) : dir === 'in' ? Math.abs(value) : value;
  return (
    <span className={`amt ${dir === 'in' ? 'in' : dir === 'out' ? 'out' : ''}`}>
      {formatAmount(sign || dir === 'in' || dir === 'out' ? signed : value, { sign: sign || dir === 'in' })}
      {token && <span className="unit">{token}</span>}
    </span>
  );
}

export function Net({ chain, token, long = false }: { chain: Chain; token?: Token; long?: boolean }) {
  return (
    <span className="net" title={`${CHAIN_NAMES[chain]}${token ? ' · ' + token : ''}`}>
      <span className={`net-dot net-${chain}`}>{chain === 'ETH' ? 'E' : chain === 'SOL' ? 'S' : 'T'}</span>
      {long ? CHAIN_NAMES[chain] : chain}
      {token && <span className="tok">{token}</span>}
    </span>
  );
}

export function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

export function Addr({ chain, address, label, link = true, full = false }: { chain: Chain; address: string; label?: string; link?: boolean; full?: boolean }) {
  if (!address) return <span className="faint">—</span>;
  return (
    <span className="addr" title={address}>
      {label ? <span style={{ fontFamily: 'var(--font)', fontSize: 13 }}>{label}&nbsp;</span> : null}
      <span className={label ? 'faint' : ''}>{full ? address : shortAddress(address)}</span>
      <button className="icon-btn" type="button" title="Copy address" onClick={(e) => (e.stopPropagation(), copyText(address))}>
        <Icon name="copy" />
      </button>
      {link && (
        <a className="icon-btn" href={explorerAddressUrl(chain, address)} target="_blank" rel="noreferrer" title="Open in block explorer" onClick={(e) => e.stopPropagation()}>
          <Icon name="ext" />
        </a>
      )}
    </span>
  );
}

export function TxLink({ chain, hash, demo }: { chain: Chain; hash: string; demo?: boolean }) {
  return (
    <span className="addr" title={hash}>
      {shortAddress(hash, 8, 6)}
      <button className="icon-btn" type="button" title="Copy hash" onClick={(e) => (e.stopPropagation(), copyText(hash))}>
        <Icon name="copy" />
      </button>
      {!demo && (
        <a className="icon-btn" href={explorerTxUrl(chain, hash)} target="_blank" rel="noreferrer" title="Open in block explorer" onClick={(e) => e.stopPropagation()}>
          <Icon name="ext" />
        </a>
      )}
    </span>
  );
}

const REQ_TONE: Record<RequestStatus, string> = { open: 'blue', overdue: 'red', partial: 'amber', paid: 'green', overpaid: 'violet', void: 'gray' };
export function RequestBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge tone-${REQ_TONE[status]}`}>{REQUEST_STATUS_LABEL[status]}</span>;
}
const TX_TONE: Record<TxStatus, string> = { unmatched: 'amber', partial: 'violet', matched: 'green', excluded: 'cyan' };
export function TxBadge({ status, internal }: { status: TxStatus; internal?: boolean }) {
  if (internal) return <span className="badge tone-gray">Internal</span>;
  return <span className={`badge tone-${TX_TONE[status]}`}>{TX_STATUS_LABEL[status]}</span>;
}
export function ConfidenceBadge({ c }: { c: Confidence }) {
  const tone = c === 'high' ? 'green' : c === 'medium' ? 'amber' : 'gray';
  return <span className={`badge tone-${tone}`}>{c === 'high' ? 'High' : c === 'medium' ? 'Medium' : 'Low'} confidence</span>;
}
export function DirIcon({ dir }: { dir: Direction }) {
  return (
    <span className={`dir ${dir}`} title={dir === 'in' ? 'Received' : dir === 'out' ? 'Sent' : 'Internal transfer'}>
      {dir === 'in' ? '↓' : dir === 'out' ? '↑' : '⇄'}
    </span>
  );
}

export function Modal({ title, onClose, children, footer, wide, drawer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; drawer?: boolean }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={drawer ? 'drawer' : `modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, style }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <label className="field" style={style}>
      <span>{label}</span>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="radio" aria-checked={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 520 }}>{children}</p>}
      {action}
    </div>
  );
}

export function QR({ text, size = 148 }: { text: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 0, width: size * 2, errorCorrectionLevel: 'M' })
      .then((u) => live && setSrc(u))
      .catch(() => live && setSrc(''));
    return () => {
      live = false;
    };
  }, [text, size]);
  return src ? <img className="qr" src={src} alt="QR code of the receiving address" style={{ width: size, height: size }} /> : <div className="qr" />;
}

/** Totals grouped by token, e.g. "12,500.00 USDT · 4,800.00 USDC". */
export function TokenTotals({ totals, empty = '0.00' }: { totals: Partial<Record<Token, number>>; empty?: string }) {
  const parts = (Object.entries(totals) as [Token, number][]).filter(([, v]) => v);
  if (!parts.length) return <span className="amt">{empty}</span>;
  return (
    <span className="stack tight">
      {parts.map(([t, v]) => (
        <Amount key={t} value={v} token={t} />
      ))}
    </span>
  );
}
