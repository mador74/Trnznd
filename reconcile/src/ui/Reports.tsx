import { useMemo, useState } from 'react';
import type { Chain, Token } from '../lib/types';
import { CHAINS, TOKENS } from '../lib/types';
import { replaceAll } from '../lib/store';
import { CHAIN_NAMES } from '../lib/chains';
import { type ExportDateFormat, formatDate, todayISO } from '../lib/dates';
import { backupJSON, filterTransactions, parseBackup, reconciliationCSV, requestsCSV, statementCSV, transactionHistoryCSV, type TxFilter } from '../lib/exports';
import { toast, useModel } from './hooks';
import { Field, Icon } from './kit';
import { FilePick } from './Requests';
import { saveFile } from './save';
import { askConfirm } from './dialogs';

export function Reports() {
  const { data, d } = useModel();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [status, setStatus] = useState<TxFilter['status']>('all');
  const [fmt, setFmt] = useState<ExportDateFormat>('iso');
  const [stmtWallet, setStmtWallet] = useState(data.wallets[0]?.id ?? '');
  const [stmtToken, setStmtToken] = useState<Token>('USDT');
  const [withKeys, setWithKeys] = useState(false);

  const filter: TxFilter = { from: from || undefined, to: to || undefined, walletIds, chains, tokens, status };
  const txs = useMemo(() => filterTransactions(data, d, filter), [data, d, from, to, walletIds, chains, tokens, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const stamp = todayISO();
  const slug = data.settings.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ledger';
  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; export</h1>
          <p>CSV files open in Excel, Google Sheets, Numbers, or can be imported into accounting software. Amounts are plain decimals in token units.</p>
        </div>
        <Field label="Date format in exports" style={{ width: 210 }}>
          <select value={fmt} onChange={(e) => setFmt(e.target.value as ExportDateFormat)}>
            <option value="iso">2026-11-30 (ISO)</option>
            <option value="dmy">30/11/2026 (day first)</option>
            <option value="mdy">11/30/2026 (month first)</option>
          </select>
        </Field>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Transaction history</h2>
            <p className="small muted">Every transfer with its reconciliation status, matched requests, explanation and explorer link.</p>
          </div>
          <button className="btn primary" disabled={!txs.length} onClick={() => void saveFile(`${slug}-transactions-${stamp}.csv`, transactionHistoryCSV(data, d, txs, fmt))}>
            <Icon name="download" /> Download {txs.length} row{txs.length === 1 ? '' : 's'}
          </button>
        </div>
        <div className="card-body stack">
          <div className="row wrap top">
            <Field label="From" style={{ width: 160 }}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To" style={{ width: 160 }}>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Status" style={{ width: 200 }}>
              <select value={status} onChange={(e) => setStatus(e.target.value as TxFilter['status'])}>
                <option value="all">All</option>
                <option value="reconciled">Reconciled, explained or internal</option>
                <option value="unreconciled">Not yet reconciled</option>
              </select>
            </Field>
          </div>
          <div className="row wrap" style={{ gap: 18 }}>
            <span className="small muted" style={{ fontWeight: 600 }}>
              Chains
            </span>
            {CHAINS.map((c) => (
              <label key={c} className="check">
                <input type="checkbox" checked={chains.includes(c)} onChange={() => toggle(chains, c, setChains)} /> {CHAIN_NAMES[c]}
              </label>
            ))}
            <span className="small muted" style={{ fontWeight: 600, marginLeft: 12 }}>
              Tokens
            </span>
            {TOKENS.map((t) => (
              <label key={t} className="check">
                <input type="checkbox" checked={tokens.includes(t)} onChange={() => toggle(tokens, t, setTokens)} /> {t}
              </label>
            ))}
          </div>
          {data.wallets.length > 0 && (
            <div className="row wrap" style={{ gap: 18 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>
                Wallets
              </span>
              {data.wallets.map((w) => (
                <label key={w.id} className="check">
                  <input type="checkbox" checked={walletIds.includes(w.id)} onChange={() => toggle(walletIds, w.id, setWalletIds)} /> {w.label}
                </label>
              ))}
            </div>
          )}
          <p className="small faint">Unticked groups mean “all”. Times are exported in UTC.</p>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Payment requests</h2>
              <p className="small muted">Amount, settled, outstanding, written off, status and settling transactions.</p>
            </div>
            <button className="btn" disabled={!data.requests.length} onClick={() => void saveFile(`${slug}-payment-requests-${stamp}.csv`, requestsCSV(data, d, fmt))}>
              <Icon name="download" /> CSV
            </button>
          </div>
          <div className="card-body small muted">{data.requests.length} requests.</div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Reconciliation audit trail</h2>
              <p className="small muted">One line per match and write-off: which transaction settled which request, how and when.</p>
            </div>
            <button className="btn" disabled={!data.allocations.length && !data.adjustments.length} onClick={() => void saveFile(`${slug}-reconciliation-${stamp}.csv`, reconciliationCSV(data, d, fmt))}>
              <Icon name="download" /> CSV
            </button>
          </div>
          <div className="card-body small muted">
            {data.allocations.length} matches · {data.adjustments.length} write-offs.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Statement for accounting import</h2>
            <p className="small muted">
              A bank-statement style file for one wallet and token (Date, Amount, Payee, Description, Reference), signed from that wallet’s point of view. Use it to bring a stablecoin wallet into your accounting package as a bank account. Column requirements differ between packages and change over time, so check your package’s statement-import help before the first import.
            </p>
          </div>
        </div>
        <div className="card-body row wrap top">
          <Field label="Wallet" style={{ width: 240 }}>
            <select value={stmtWallet} onChange={(e) => setStmtWallet(e.target.value)}>
              {data.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Token" style={{ width: 120 }}>
            <select value={stmtToken} onChange={(e) => setStmtToken(e.target.value as Token)}>
              {TOKENS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <span className="small muted" style={{ alignSelf: 'center' }}>
            Uses the From / To dates above{from || to ? ` (${from || '…'} → ${to || '…'})` : ''}.
          </span>
          <span className="grow" />
          <div className="field">
            <span>&nbsp;</span>
            <button
              className="btn"
              disabled={!stmtWallet}
              onClick={() => {
                const w = data.wallets.find((x) => x.id === stmtWallet)!;
                void saveFile(`${slug}-${w.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stmtToken}-statement-${stamp}.csv`, statementCSV(data, d, stmtWallet, stmtToken, fmt, { from: from || undefined, to: to || undefined }));
              }}
            >
              <Icon name="download" /> Statement CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Backup &amp; restore</h2>
            <p className="small muted">Everything lives in this browser only. Download a backup regularly, and use it to move the ledger to another computer.</p>
          </div>
        </div>
        <div className="card-body grid2">
          <div className="stack">
            <label className="check small">
              <input type="checkbox" checked={withKeys} onChange={(e) => setWithKeys(e.target.checked)} /> Include API keys in the file
            </label>
            <div>
              <button className="btn primary" onClick={() => void saveFile(`${slug}-backup-${stamp}.json`, backupJSON(data, withKeys), 'application/json')}>
                <Icon name="download" /> Download backup (.json)
              </button>
            </div>
          </div>
          <FilePick
            accept=".json,application/json"
            label="Restore from a backup file"
            onFile={async (f) => {
              try {
                const parsed = parseBackup(await f.text());
                if (!(await askConfirm(`Replace ALL current data with “${f.name}” (${parsed.requests.length} requests, ${parsed.transactions.length} transactions)? This cannot be undone.`, { title: 'Restore backup', confirmLabel: 'Replace data', danger: true }))) return;
                const keepKeys = { etherscanApiKey: data.settings.etherscanApiKey, trongridApiKey: data.settings.trongridApiKey };
                replaceAll({ ...parsed, settings: { ...keepKeys, ...parsed.settings } });
                toast('Backup restored.');
              } catch (e) {
                toast((e as Error).message, 'error');
              }
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Activity log</h2>
          <span className="small muted">Latest {Math.min(300, data.activity.length)} of {data.activity.length}</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.activity.slice(0, 300).map((a) => (
                <tr key={a.id}>
                  <td className="small nowrap muted">{formatDate(a.at, true)}</td>
                  <td style={{ fontWeight: 550 }}>{a.action}</td>
                  <td className="small muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
