import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useData } from '../lib/store';
import { derive, type Derived } from '../lib/status';
import { suggestAll, type Suggestion } from '../lib/match';
import type { AppData } from '../lib/types';

// ---------- hash router ----------
function readHash(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}
function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
let cachedHash = '';
let cachedParts: string[] = [];
export function useRoute(): string[] {
  return useSyncExternalStore(subscribeHash, () => {
    if (window.location.hash !== cachedHash) {
      cachedHash = window.location.hash;
      cachedParts = readHash();
    }
    return cachedParts;
  });
}
export function navigate(path: string) {
  window.location.hash = `#/${path.replace(/^\/+/, '')}`;
}

// ---------- derived data ----------
export interface Model {
  data: AppData;
  d: Derived;
  suggestions: Map<string, Suggestion[]>;
}
export function useModel(): Model {
  const data = useData();
  return useMemo(() => {
    const d = derive(data);
    return { data, d, suggestions: suggestAll(data, d) };
  }, [data]);
}

// ---------- toasts ----------
export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}
let toasts: Toast[] = [];
let toastId = 1;
const toastListeners = new Set<() => void>();
export function toast(text: string, kind: Toast['kind'] = 'ok', ms = 4200) {
  const t = { id: toastId++, text, kind };
  toasts = [...toasts, t].slice(-3);
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l());
  }, ms);
}
export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb);
      return () => toastListeners.delete(cb);
    },
    () => toasts,
  );
}

export function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
