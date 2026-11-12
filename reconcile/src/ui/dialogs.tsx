import { useState, useSyncExternalStore } from 'react';
import { Modal } from './kit';

/** In-page replacements for window.confirm / window.prompt (blocked in sandboxed hosts). */
interface Pending {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  input?: { value: string; label: string };
  resolve: (v: string | boolean | null) => void;
}

let pending: Pending | null = null;
let nextId = 1;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

function open(p: Omit<Pending, 'id'>) {
  if (pending) pending.resolve(p.input ? null : false);
  pending = { ...p, id: nextId++ };
  emit();
}

export function askConfirm(message: string, opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) =>
    open({
      title: opts.title ?? 'Please confirm',
      message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      danger: !!opts.danger,
      resolve: (v) => resolve(v === true),
    }),
  );
}

export function askText(message: string, opts: { title?: string; label?: string; defaultValue?: string; confirmLabel?: string } = {}): Promise<string | null> {
  return new Promise((resolve) =>
    open({
      title: opts.title ?? 'Details needed',
      message,
      confirmLabel: opts.confirmLabel ?? 'Save',
      cancelLabel: 'Cancel',
      danger: false,
      input: { value: opts.defaultValue ?? '', label: opts.label ?? '' },
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    }),
  );
}

export function DialogHost() {
  const p = useSyncExternalStore(
    (cb) => (ls.add(cb), () => ls.delete(cb)),
    () => pending,
  );
  if (!p) return null;
  return <DialogView key={p.id} p={p} />;
}

function DialogView({ p }: { p: Pending }) {
  const [value, setValue] = useState(p.input?.value ?? '');
  const close = (v: string | boolean | null) => {
    if (pending?.id === p.id) pending = null;
    p.resolve(v);
    emit();
  };
  const ok = () => close(p.input ? value.trim() || null : true);
  return (
    <Modal
      title={p.title}
      onClose={() => close(p.input ? null : false)}
      footer={
        <>
          <button className="btn" onClick={() => close(p.input ? null : false)}>
            {p.cancelLabel}
          </button>
          <button className={`btn ${p.danger ? 'danger' : 'primary'}`} onClick={ok} disabled={!!p.input && !value.trim()} autoFocus={!p.input}>
            {p.confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ whiteSpace: 'pre-line' }}>{p.message}</p>
      {p.input && (
        <label className="field">
          {p.input.label && <span>{p.input.label}</span>}
          <input value={value} autoFocus onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && value.trim() && ok()} />
        </label>
      )}
    </Modal>
  );
}
