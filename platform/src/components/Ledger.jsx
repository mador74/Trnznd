import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { TX_TYPES } from '../lib/ledger.js';
import { valueAt } from '../lib/prices.js';
import { ACCOUNTS } from '../lib/accounting.js';
import { amount, date, dateTime, displayCurrency, download, shortAddr, toCsv, money, usd } from '../lib/format.js';
import { fromUsd } from '../lib/fx.js';
import { ASSETS, CATEGORIES, can } from '../data/seed.js';
import { Empty, Modal } from './ui.jsx';

const PAGE = 50;

/** The transaction ledger: what, when, how much, who. `fixedConnection` locks the connection filter. */
export default function Ledger({ fixedConnection }) {
  const { state, dispatch, me, books } = useStore();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(PAGE);
  const f = {
    q: params.get('q') || '',
    connection: fixedConnection || params.get('connection') || '',
    asset: params.get('asset') || '',
    type: params.get('type') || '',
    status: params.get('status') || '',
    dir: params.get('dir') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
  };
  const set = (k, v) => {
    const p = new URLSearchParams(params);
    v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
    setSelected([]);
    setLimit(PAGE);
  };
  const connName = (id) => state.connections.find((c) => c.id === id)?.name || 'Removed connection';
  const canRec = can(me, 'reconcile');

  const rows = useMemo(() => {
    const q = f.q.toLowerCase();
    return state.transactions.filter(
      (t) =>
        (!f.connection || t.connectionId === f.connection) &&
        (!f.asset || t.asset === f.asset) &&
        (!f.type || t.type === f.type) &&
        (!f.dir || (f.dir === 'in') === (t.amount >= 0)) &&
        (!f.status || (f.status === 'reconciled') === t.reconciled) &&
        (!f.from || t.date.slice(0, 10) >= f.from) &&
        (!f.to || t.date.slice(0, 10) <= f.to) &&
        (!q || [t.counterparty, t.counterpartyAddress, t.txHash, t.memo, t.category].some((v) => v && v.toLowerCase().includes(q))),
    );
  }, [state.transactions, f.q, f.connection, f.asset, f.type, f.dir, f.status, f.from, f.to]);

  // Values are measured at each transaction's own date (fair value then), not at today's price.
  const anchor = state.priceAnchor;
  const v = (t) => valueAt(t, anchor);
  const inUsd = rows.reduce((s, t) => s + (t.amount > 0 ? v(t) : 0), 0);
  const outUsd = rows.reduce((s, t) => s + (t.amount < 0 ? -v(t) : 0), 0);
  const lock = state.accounting?.lockDate;
  const locked = (t) => !!lock && t.date.slice(0, 10) <= lock;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const visible = rows.slice(0, limit);
  const allChecked = visible.length > 0 && visible.every((t) => selected.includes(t.id));

  const exportCsv = () => {
    const header = ['Date (UTC)', 'Connection', 'Type', 'Asset', 'In', 'Out', 'Value at transaction date (USD)', `Value at transaction date (${displayCurrency()})`, 'Cost basis (USD)', 'Realised gain/(loss) (USD)', 'GL account', 'Counterparty', 'Counterparty address', 'Tx hash / ref', 'Category', 'Memo', 'Reconciled', 'Period locked'];
    const body = rows.map((t) => {
      const p = books.byTx[t.id];
      const counter = p?.entry.lines[t.amount >= 0 ? 1 : 0]?.acct;
      return [t.date, connName(t.connectionId), TX_TYPES[t.type], t.asset, t.amount > 0 ? t.amount : '', t.amount < 0 ? -t.amount : '',
        Math.abs(v(t)).toFixed(2), fromUsd(Math.abs(v(t)), displayCurrency()).toFixed(2), p?.cost ?? '', p?.cost != null ? p.gain : '',
        counter ? `${counter} ${ACCOUNTS[counter].name}` : '', t.counterparty, t.counterpartyAddress || '', t.txHash, t.category, t.memo, t.reconciled ? 'yes' : 'no', locked(t) ? 'yes' : 'no'];
    });
    download(`trnznd-ledger-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]));
  };

  const tx = open && state.transactions.find((t) => t.id === open);

  return (
    <div className="card">
      <div className="filters">
        <input type="search" placeholder="Search counterparty, address, hash, memo…" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search" />
        {!fixedConnection && (
          <select value={f.connection} onChange={(e) => set('connection', e.target.value)} aria-label="Connection">
            <option value="">All connections</option>
            {state.connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={f.asset} onChange={(e) => set('asset', e.target.value)} aria-label="Asset">
          <option value="">All assets</option>
          {Object.keys(ASSETS).map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={f.dir} onChange={(e) => set('dir', e.target.value)} aria-label="Direction">
          <option value="">In and out</option>
          <option value="in">In only</option>
          <option value="out">Out only</option>
        </select>
        <select value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Reconciliation status">
          <option value="">Any status</option>
          <option value="unreconciled">Unreconciled</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
        <input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
      </div>
      <div className="filters">
        <span className="small muted">
          {rows.length} transactions · in <strong className="pos">{money(inUsd)}</strong> · out <strong className="neg">{money(outUsd)}</strong> · net <strong className={inUsd - outUsd < 0 ? 'neg' : 'pos'}>{money(inUsd - outUsd)}</strong>
          <span className="muted"> (values at each transaction’s date)</span>
        </span>
        <span className="spacer" />
        {selected.length > 0 && canRec && (
          <>
            <span className="small">{selected.length} selected</span>
            <button className="btn sm primary" onClick={() => { dispatch({ type: 'UPDATE_TX', ids: selected, patch: { reconciled: true } }); setSelected([]); }}>Mark reconciled</button>
            <button className="btn sm" onClick={() => { dispatch({ type: 'UPDATE_TX', ids: selected, patch: { reconciled: false } }); setSelected([]); }}>Mark unreconciled</button>
          </>
        )}
        {can(me, 'export') && <button className="btn sm" onClick={exportCsv}>Export CSV</button>}
      </div>
      {rows.length === 0 ? (
        <Empty>No transactions match these filters.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {canRec && (
                  <th style={{ width: 32 }}>
                    <input type="checkbox" aria-label="Select all" checked={allChecked}
                      onChange={() => setSelected(allChecked ? [] : visible.map((t) => t.id))} />
                  </th>
                )}
                <th>When</th>
                {!fixedConnection && <th>Connection</th>}
                <th>What</th>
                <th>Who</th>
                <th className="num col-in">In</th>
                <th className="num col-out">Out</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setOpen(t.id)}>
                  {canRec && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Select" disabled={locked(t)} checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                  )}
                  <td style={{ whiteSpace: 'nowrap' }}>{date(t.date)}</td>
                  {!fixedConnection && <td>{connName(t.connectionId)}</td>}
                  <td>{TX_TYPES[t.type]}</td>
                  <td>
                    <div>{t.counterparty}</div>
                    <div className="mono muted">{shortAddr(t.counterpartyAddress)}</div>
                  </td>
                  <td className="num col-in">{t.amount > 0 && <><div className="mono pos">{amount(t.amount, t.asset)}</div><div className="small muted">{money(v(t))}</div></>}</td>
                  <td className="num col-out">{t.amount < 0 && <><div className="mono neg">{amount(-t.amount, t.asset)}</div><div className="small muted">{money(-v(t))}</div></>}</td>
                  <td><span className={`badge${t.category === 'Uncategorised' ? ' warn' : ''}`}>{t.category}</span></td>
                  <td>{t.reconciled ? <span className="badge pos">Reconciled</span> : <span className="badge">Unreconciled</span>}{locked(t) && <span className="badge" title="In a closed accounting period" style={{ marginLeft: 4 }}>🔒</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="card__foot"><button className="btn sm" onClick={() => setLimit((l) => l + PAGE)}>Show more ({rows.length - limit} remaining)</button></div>
          )}
        </div>
      )}
      {tx && <TxDrawer tx={tx} connName={connName(tx.connectionId)} canEdit={canRec && !locked(tx)} locked={locked(tx)} posting={books.byTx[tx.id]} value={v(tx)} onClose={() => setOpen(null)} dispatch={dispatch} requests={state.requests} invoices={state.invoices} />}
    </div>
  );
}

function TxDrawer({ tx, connName, canEdit, locked, posting, value, onClose, dispatch, requests, invoices }) {
  const [memo, setMemo] = useState(tx.memo);
  const update = (patch) => dispatch({ type: 'UPDATE_TX', ids: [tx.id], patch });
  const req = tx.requestId && requests.find((r) => r.id === tx.requestId);
  const inv = tx.invoiceId && invoices.find((i) => i.id === tx.invoiceId);
  return (
    <Modal title="Transaction" onClose={onClose} drawer>
      <div className={`stat__value ${tx.amount < 0 ? 'neg' : 'pos'}`}>{amount(tx.amount, tx.asset)}</div>
      <div className="muted">{tx.amount >= 0 ? 'In' : 'Out'} · {money(Math.abs(value))} at fair value on the transaction date</div>
      <dl className="kv">
        <dt>When</dt><dd>{dateTime(tx.date)} (UTC {tx.date.slice(11, 16)})</dd>
        <dt>What</dt><dd>{TX_TYPES[tx.type]} · {tx.asset}</dd>
        <dt>Connection</dt><dd>{connName}</dd>
        <dt>Who</dt><dd>{tx.counterparty}</dd>
        <dt>Address</dt><dd className="mono">{tx.counterpartyAddress || '—'}</dd>
        <dt>Tx hash / ref</dt><dd className="mono">{tx.txHash}</dd>
        {req && (<><dt>Approval</dt><dd>Linked to approved request “{req.reference}”</dd></>)}
        {inv && (<><dt>Invoice</dt><dd>Settles {inv.number}</dd></>)}
      </dl>
      <label className="field">
        <span>Category</span>
        <select disabled={!canEdit} value={tx.category} onChange={(e) => update({ category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Memo / reference</span>
        <textarea rows={2} disabled={!canEdit} value={memo} onChange={(e) => setMemo(e.target.value)} onBlur={() => memo !== tx.memo && update({ memo })} placeholder="e.g. invoice number" />
      </label>
      <div className="row">
        {tx.reconciled ? <span className="badge pos">Reconciled</span> : <span className="badge">Unreconciled</span>}
        <span className="spacer" />
        {canEdit && (
          <button className={`btn ${tx.reconciled ? '' : 'primary'}`} onClick={() => update({ reconciled: !tx.reconciled })}>
            {tx.reconciled ? 'Mark unreconciled' : 'Mark reconciled'}
          </button>
        )}
      </div>
      {locked && <div className="notice small">This transaction is in a closed accounting period, so it cannot be edited. Corrections are posted as adjusting entries in an open period.</div>}
      {!canEdit && !locked && <div className="notice small">Your role can view but not edit transactions.</div>}
      {posting && (
        <div>
          <div className="stat__label" style={{ marginBottom: 6 }}>Journal entry (USD)</div>
          <table className="journal">
            <tbody>
              {posting.entry.lines.map((l, i) => (
                <tr key={i}><td className="mono small">{l.acct}</td><td className="small">{ACCOUNTS[l.acct]?.name}</td><td className="num small">{l.dr ? usd(l.dr) : ''}</td><td className="num small">{l.cr ? usd(l.cr) : ''}</td></tr>
              ))}
            </tbody>
          </table>
          {posting.cost != null && <div className="small muted" style={{ marginTop: 6 }}>Disposal: FIFO cost {usd(posting.cost)}, realised {posting.gain >= 0 ? 'gain' : 'loss'} {usd(Math.abs(posting.gain))}.</div>}
        </div>
      )}
    </Modal>
  );
}
