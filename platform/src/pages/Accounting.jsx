import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { can } from '../data/seed.js';
import { ACCOUNTS, incomeStatement, trialBalance } from '../lib/accounting.js';
import { amount, date, download, toCsv, usd } from '../lib/format.js';
import { ConfirmButton } from '../components/ui.jsx';

const TABS = [
  ['overview', 'Overview & close'],
  ['tb', 'Trial balance'],
  ['pl', 'Income statement'],
  ['roll', 'Digital asset rollforward'],
  ['journal', 'Journal'],
  ['coa', 'Chart of accounts'],
];

export default function Accounting() {
  const { books } = useStore();
  const [tab, setTab] = useState('overview');
  const tb = trialBalance(books);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Accounting</h1>
          <p>Every transaction is posted as a balanced double-entry journal, valued at fair value on its own date. Reports are in USD, your reporting currency.</p>
        </div>
        <span className="spacer" />
        <span className={`badge ${tb.balanced ? 'pos' : 'neg'}`}>{tb.balanced ? 'Books balance: debits = credits' : 'Out of balance'}</span>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'tb' && <TrialBalance tb={tb} />}
      {tab === 'pl' && <IncomeStatement />}
      {tab === 'roll' && <Rollforward />}
      {tab === 'journal' && <Journal />}
      {tab === 'coa' && <Coa />}
    </div>
  );
}

function Overview() {
  const { state, dispatch, me, books } = useStore();
  const lock = state.accounting?.lockDate;
  const [closeDate, setCloseDate] = useState(() => new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10));
  const blocking = state.transactions.filter((t) => t.date.slice(0, 10) <= closeDate && (!t.reconciled || t.category === 'Uncategorised'));
  const allowed = can(me, 'reconcile');
  return (
    <div className="grid cols-2">
      <div className="card">
        <div className="card__head"><h2>How TRNZIT keeps the books</h2></div>
        <div className="card__body stack small">
          <div><strong>Framework:</strong> {state.accounting.framework}. Digital assets in scope of ASC 350-60 (as amended by ASU 2023-08) are remeasured to fair value at each reporting date, with gains and losses in net income.</div>
          <div><strong>Double entry:</strong> every inflow, outflow, fee, transfer and conversion becomes a journal entry whose debits equal its credits.</div>
          <div><strong>Measurement:</strong> each entry uses the asset’s fair value on the transaction date. Today’s balances are remeasured to today’s fair value.</div>
          <div><strong>Cost basis:</strong> {state.accounting.costMethod} lots per asset across the whole business. Payments, fees and conversions out are disposals: cost comes off the books and the difference to fair value is a realised gain or loss.</div>
          <div><strong>Accrual:</strong> issuing an invoice books a receivable and revenue. The matched receipt clears the receivable.</div>
          <div><strong>Audit trail:</strong> amounts from providers are never edited. Closed periods are locked, and every change is in the <Link to="/audit">audit log</Link>.</div>
          <div className="notice warn">
            Policy decisions your accountant must confirm include:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Whether stablecoins and ZEND are in scope of ASU 2023-08, or treated as financial assets or cash equivalents. They are tracked separately here.</li>
              <li>The cost-basis method.</li>
              <li>Presentation and disclosures.</li>
              <li>Tax treatment.</li>
            </ul>
            If you report under IFRS instead, crypto is generally measured differently (cost or revaluation under IAS 38, or IAS 2 for traders). That option is not built yet.
          </div>
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card__head"><h2>Readiness</h2></div>
          <div className="card__body stack small">
            {books.warnings.length === 0 ? <div className="pos">No open issues.</div> : books.warnings.map((w) => <div key={w}>• {w}</div>)}
            <div className="row wrap">
              <Link className="btn sm" to="/transactions?status=unreconciled">Reconcile</Link>
              <Link className="btn sm" to="/transactions?q=Uncategorised">Classify uncategorised</Link>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h2>Period close</h2><span className="spacer" />{lock ? <span className="badge info">Locked to {date(lock)}</span> : <span className="badge">No closed periods</span>}</div>
          <div className="card__body stack small">
            <div>Closing a period locks every transaction up to that date, so reported figures can’t change afterwards. Any correction is posted in an open period.</div>
            {allowed ? (
              <>
                <div className="row wrap">
                  <label className="row">Close up to and including <input id="close-date" type="date" value={closeDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setCloseDate(e.target.value)} style={{ width: 'auto' }} /></label>
                  <button className="btn primary sm" disabled={blocking.length > 0 || (lock && closeDate <= lock)} onClick={() => dispatch({ type: 'CLOSE_PERIOD', date: closeDate })}>Close period</button>
                </div>
                {blocking.length > 0 && (
                  <div className="notice warn">{blocking.length} transaction(s) up to {date(closeDate)} are unreconciled or uncategorised. <Link to={`/transactions?to=${closeDate}&status=unreconciled`}>Fix them first</Link>.</div>
                )}
                {lock && me.role === 'owner' && (
                  <ConfirmButton className="btn sm ghost" prompt="Click again to reopen all periods" onConfirm={() => dispatch({ type: 'REOPEN_PERIOD' })}>Reopen periods (Owner only, audited)</ConfirmButton>
                )}
              </>
            ) : <div className="muted">Owners, Admins and Accountants can close periods.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrialBalance({ tb }) {
  const exportCsv = () => download('trnzit-trial-balance.csv', toCsv([['Account', 'Name', 'Type', 'Debit (USD)', 'Credit (USD)'], ...tb.rows.map((r) => [r.acct, r.name, r.type, r.dr.toFixed(2), r.cr.toFixed(2)]), ['', 'Total', '', tb.dr.toFixed(2), tb.cr.toFixed(2)]]));
  return (
    <div className="card">
      <div className="card__head"><h2>Trial balance as of today</h2><span className="spacer" /><button className="btn sm" onClick={exportCsv}>Export CSV</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Account</th><th>Name</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.acct}><td className="mono">{r.acct}</td><td>{r.name}</td><td className="muted small">{r.type}</td><td className="num">{r.dr ? usd(r.dr) : ''}</td><td className="num">{r.cr ? usd(r.cr) : ''}</td></tr>
            ))}
            <tr><td /><td><strong>Total</strong></td><td /><td className="num"><strong>{usd(tb.dr)}</strong></td><td className="num"><strong>{usd(tb.cr)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncomeStatement() {
  const { books } = useStore();
  const pl = incomeStatement(books);
  const section = (type) => pl.lines.filter((l) => l.type === type);
  return (
    <div className="card">
      <div className="card__head"><h2>Income statement, since opening balances</h2></div>
      <div className="table-wrap">
        <table>
          <tbody>
            <tr><th colSpan={2}>Income and gains</th></tr>
            {section('income').map((l) => <tr key={l.acct}><td>{l.acct} · {l.name}</td><td className={`num ${l.amount < 0 ? 'neg' : ''}`}>{usd(l.amount)}</td></tr>)}
            <tr><th colSpan={2}>Expenses</th></tr>
            {section('expense').map((l) => <tr key={l.acct}><td>{l.acct} · {l.name}</td><td className="num">{usd(-l.amount)}</td></tr>)}
            <tr><td><strong>Net income</strong></td><td className={`num ${pl.net < 0 ? 'neg' : 'pos'}`}><strong>{usd(pl.net)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div className="card__foot small muted">Unrealised gains and losses come from remeasuring digital assets to fair value (ASU 2023-08). Uncategorised items sit in Suspense on the balance sheet, not in this statement, until they are classified.</div>
    </div>
  );
}

function Rollforward() {
  const { books } = useStore();
  const exportCsv = () => download('trnzit-digital-asset-rollforward.csv', toCsv([
    ['Asset', 'Opening units', 'Opening cost (USD)', 'Acquired units', 'Acquired cost (USD)', 'Disposed units', 'Disposed cost (USD)', 'Realised gain/(loss)', 'Closing units', 'Closing cost (USD)', 'Fair value (USD)', 'Unrealised gain/(loss)'],
    ...books.rollforward.map((r) => [r.asset, r.openQty, r.openValue.toFixed(2), r.inQty, r.inValue.toFixed(2), r.outQty, r.outCost.toFixed(2), r.realised.toFixed(2), r.closeQty, r.closeCost.toFixed(2), r.fairValue.toFixed(2), r.unrealised.toFixed(2)]),
  ]));
  return (
    <div className="card">
      <div className="card__head"><h2>Digital asset rollforward</h2><span className="spacer" /><button className="btn sm" onClick={exportCsv}>Export CSV</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Asset</th><th className="num">Opening</th><th className="num col-in">Acquired</th><th className="num col-out">Disposed (at cost)</th><th className="num">Realised</th><th className="num">Closing units</th><th className="num">Cost</th><th className="num">Fair value</th><th className="num">Unrealised</th></tr></thead>
          <tbody>
            {books.rollforward.map((r) => (
              <tr key={r.asset}>
                <td><strong>{r.asset}</strong></td>
                <td className="num">{amount(r.openQty, '')}<div className="small muted">{usd(r.openValue)}</div></td>
                <td className="num col-in">{amount(r.inQty, '')}<div className="small muted">{usd(r.inValue)}</div></td>
                <td className="num col-out">{amount(r.outQty, '')}<div className="small muted">{usd(r.outCost)}</div></td>
                <td className={`num ${r.realised < 0 ? 'neg' : ''}`}>{usd(r.realised)}</td>
                <td className="num mono">{amount(r.closeQty, '')}</td>
                <td className="num">{usd(r.closeCost)}</td>
                <td className="num">{usd(r.fairValue)}</td>
                <td className={`num ${r.unrealised < 0 ? 'neg' : ''}`}>{usd(r.unrealised)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card__foot small muted">Units across all connections. Internal transfers between your own accounts move units without changing cost. This table supports the rollforward disclosure ASU 2023-08 asks for; your accountant decides the final disclosure.</div>
    </div>
  );
}

function Journal() {
  const { books } = useStore();
  const [limit, setLimit] = useState(40);
  const list = [...books.entries].sort((a, b) => b.date.localeCompare(a.date));
  const exportCsv = () => download('trnzit-journal.csv', toCsv([
    ['Entry', 'Date', 'Source', 'Memo', 'Account', 'Account name', 'Debit (USD)', 'Credit (USD)'],
    ...list.flatMap((e) => e.lines.map((l) => [e.id, e.date.slice(0, 10), e.source, e.memo, l.acct, ACCOUNTS[l.acct]?.name, l.dr ? l.dr.toFixed(2) : '', l.cr ? l.cr.toFixed(2) : ''])),
  ]));
  return (
    <div className="card">
      <div className="card__head"><h2>General journal</h2><span className="muted small">{list.length} entries</span><span className="spacer" /><button className="btn sm" onClick={exportCsv}>Export CSV (for your accounting software)</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Source</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
          <tbody>
            {list.slice(0, limit).map((e) => e.lines.map((l, i) => (
              <tr key={e.id + i} style={i === 0 ? { borderTop: '2px solid var(--border)' } : undefined}>
                <td>{i === 0 ? date(e.date) : ''}</td>
                <td className="small">{i === 0 ? <>{e.source}<div className="muted">{e.memo}</div></> : ''}</td>
                <td className="small" style={{ paddingLeft: l.cr ? 32 : 14 }}><span className="mono">{l.acct}</span> {ACCOUNTS[l.acct]?.name}</td>
                <td className="num">{l.dr ? usd(l.dr) : ''}</td>
                <td className="num">{l.cr ? usd(l.cr) : ''}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      {list.length > limit && <div className="card__foot"><button className="btn sm" onClick={() => setLimit((n) => n + 40)}>Show more</button></div>}
    </div>
  );
}

function Coa() {
  return (
    <div className="card">
      <div className="card__head"><h2>Chart of accounts</h2></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead>
          <tbody>{Object.entries(ACCOUNTS).map(([k, a]) => <tr key={k}><td className="mono">{k}</td><td>{a.name}</td><td className="muted">{a.type}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card__foot small muted">Transaction categories map to these accounts automatically. In production, map them to your own chart of accounts and accounting software.</div>
    </div>
  );
}
