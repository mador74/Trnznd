import { useEffect, useState } from 'react';
import { ROLES } from '../data/seed.js';

export function Modal({ title, onClose, children, footer, wide, drawer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`overlay${drawer ? ' drawer' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

const STATUS = {
  draft: ['', 'Draft'],
  sent: ['warn', 'Awaiting payment'],
  overdue: ['neg', 'Overdue'],
  paid: ['pos', 'Paid'],
  void: ['', 'Void'],
  pending: ['warn', 'Awaiting approval'],
  approved: ['info', 'Approved — ready to execute'],
  executed: ['pos', 'Executed'],
  rejected: ['neg', 'Rejected'],
  cancelled: ['', 'Cancelled'],
  connected: ['pos', 'Connected'],
  active: ['pos', 'Active'],
  invited: ['warn', 'Invite sent'],
  suspended: ['neg', 'Suspended'],
  removed: ['', 'Removed'],
};
export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] || ['', status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export const RoleBadge = ({ role }) => <span className="badge">{ROLES[role]?.label || role}</span>;

export function Avatar({ user }) {
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  return <span className="avatar" title={user?.name}>{initials}</span>;
}

const ICON = { exchange: ['EX', '#0088ff'], custodian: ['CU', '#6c3aed'], wallet: ['W', '#00a88a'], otc: ['OT', '#06b6d4'], bank: ['BK', '#374151'], card: ['CC', '#b45309'] };
export function ConnIcon({ type }) {
  const [t, bg] = ICON[type] || ['?', '#6b7280'];
  return <span className="feed__icon" style={{ background: bg }} aria-hidden="true">{t}</span>;
}

export const Stat = ({ label, value, sub }) => (
  <div className="card card__body">
    <div className="stat__label">{label}</div>
    <div className="stat__value">{value}</div>
    {sub && <div className="stat__sub">{sub}</div>}
  </div>
);

export const Empty = ({ children }) => <div className="empty">{children}</div>;

export const SERIES = ['#00d4aa', '#0088ff', '#6c3aed', '#06b6d4', '#f59e0b', '#9ca3af'];

/** Two-step button: first click asks, second click within 4s confirms. Avoids window.confirm, which embedded viewers block. */
export function ConfirmButton({ onConfirm, children, prompt = 'Click again to confirm', className = 'btn' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? prompt : children}
    </button>
  );
}
