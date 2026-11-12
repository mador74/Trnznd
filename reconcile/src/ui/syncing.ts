import { useSyncExternalStore } from 'react';
import { getState } from '../lib/store';
import { syncWallet } from '../chains/sync';
import { toast } from './hooks';

let running = false;
let message = '';
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
const set = (r: boolean, m: string) => {
  running = r;
  message = m;
  emit();
};

export function useSyncState(): { running: boolean; message: string } {
  const r = useSyncExternalStore((cb) => (ls.add(cb), () => ls.delete(cb)), () => running);
  const m = useSyncExternalStore((cb) => (ls.add(cb), () => ls.delete(cb)), () => message);
  return { running: r, message: m };
}

export async function runSync(walletIds?: string[]) {
  if (running) return;
  const wallets = getState().wallets.filter((w) => !w.demo && (!walletIds || walletIds.includes(w.id)));
  if (!wallets.length) {
    toast(getState().wallets.length ? 'Demo wallets are not synced. Add a real wallet address to fetch on-chain transfers.' : 'Add a wallet first.', 'error');
    return;
  }
  set(true, 'Starting sync…');
  let added = 0;
  const errors: string[] = [];
  let truncated = false;
  for (const w of wallets) {
    const res = await syncWallet(w.id, (m) => set(true, m));
    added += res.added;
    truncated ||= res.truncated;
    if (res.error) errors.push(`${w.label}: ${res.error}`);
  }
  set(false, '');
  toast(`Sync finished: ${added} new transaction${added === 1 ? '' : 's'}.${truncated ? ' More history remains; sync again to continue.' : ''}`, 'ok');
  if (errors.length) toast(errors.join('\n'), 'error', 9000);
}
