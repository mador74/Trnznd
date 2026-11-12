import { useEffect } from 'react';
import { useData, useHydrated, usePersistError } from '../lib/store';
import { updateSettings } from '../lib/store';
import { navigate, useModel, useRoute, useToasts } from './hooks';
import { Icon } from './kit';
import { needsReconciliation } from '../lib/status';
import { Dashboard } from './Dashboard';
import { Reconcile } from './Reconcile';
import { Requests, PrintRequest } from './Requests';
import { Transactions } from './Transactions';
import { Wallets } from './Wallets';
import { Reports } from './Reports';
import { SettingsPage } from './Settings';
import { runSync, useSyncState } from './syncing';
import { DialogHost } from './dialogs';
import { HOSTED } from '../lib/env';

const NAV = [
  { key: 'dashboard', label: 'Overview', icon: 'home' },
  { key: 'reconcile', label: 'Reconcile', icon: 'match' },
  { key: 'requests', label: 'Payment requests', icon: 'doc' },
  { key: 'transactions', label: 'Transactions', icon: 'list' },
  { key: 'wallets', label: 'Wallets & contacts', icon: 'wallet' },
  { key: 'reports', label: 'Reports & export', icon: 'report' },
  { key: 'settings', label: 'Settings', icon: 'gear' },
];

export function App() {
  const hydrated = useHydrated();
  const data = useData();
  const route = useRoute();
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);
  if (!hydrated) return <div className="empty">Loading…</div>;
  if (route[0] === 'requests' && route[2] === 'print')
    return (
      <>
        <PrintRequest id={route[1]} />
        <DialogHost />
      </>
    );
  return (
    <>
      <Shell route={route} />
      <DialogHost />
    </>
  );
}

function Shell({ route }: { route: string[] }) {
  const { data, d } = useModel();
  const page = NAV.some((n) => n.key === route[0]) ? route[0] : 'dashboard';
  const toasts = useToasts();
  const sync = useSyncState();
  const persistError = usePersistError();
  const toReconcile = data.transactions.filter((t) => needsReconciliation(t, d.txStatus.get(t.id) ?? 'unmatched')).length;
  const realWallets = data.wallets.filter((w) => !w.demo).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SL</div>
          <div>
            <div className="brand-name">Settlement Ledger</div>
            <div className="brand-sub">USDT · USDC reconciliation</div>
          </div>
        </div>
        {NAV.map((n) => (
          <a key={n.key} href={`#/${n.key}`} className={`nav-item ${page === n.key ? 'active' : ''}`}>
            <Icon name={n.icon} />
            {n.label}
            {n.key === 'reconcile' && toReconcile > 0 && <span className="nav-count">{toReconcile}</span>}
          </a>
        ))}
        <div className="sidebar-foot">
          Data is stored only in this browser. Back it up from Reports &amp; export.
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="grow">
            <div style={{ fontWeight: 650 }}>{data.settings.companyName}</div>
            <div className="small muted">
              {data.wallets.length} wallet{data.wallets.length === 1 ? '' : 's'} · Ethereum, Solana, Tron
            </div>
          </div>
          {sync.running && <span className="small muted">{sync.message}</span>}
          <button className="btn sm" onClick={() => runSync()} disabled={HOSTED || sync.running || !realWallets} title={HOSTED ? 'Sync is off in the hosted preview' : realWallets ? 'Fetch new USDT/USDC transfers for all wallets' : 'Add a real wallet to sync'}>
            <Icon name="sync" /> {sync.running ? 'Syncing…' : 'Sync wallets'}
          </button>
          <button className="btn sm ghost" onClick={() => updateSettings({ theme: data.settings.theme === 'dark' ? 'light' : 'dark' })} title="Toggle light / dark">
            <Icon name={data.settings.theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </header>
        <main className="content">
          {HOSTED && (
            <div className="notice warn small">
              <strong>Hosted preview.</strong> This copy runs inside claude.ai, which blocks calls to outside sites, so blockchain sync is off: use <em>Explore with demo data</em> or CSV import. Data is kept only in this browser and may not survive here, so use Reports &amp; export → Backup for anything you want to keep.
            </div>
          )}
          {persistError && <div className="notice error">{persistError}</div>}
          {page === 'dashboard' && <Dashboard />}
          {page === 'reconcile' && <Reconcile />}
          {page === 'requests' && <Requests openId={route[1]} />}
          {page === 'transactions' && <Transactions openId={route[1]} />}
          {page === 'wallets' && <Wallets />}
          {page === 'reports' && <Reports />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`} style={{ whiteSpace: 'pre-line' }}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export { navigate };
