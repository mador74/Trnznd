import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { ASSETS, can } from '../data/seed.js';
import { balances, priceOf } from '../lib/ledger.js';
import { amount, money } from '../lib/format.js';
import { deriveStatus, governingPolicies } from '../lib/policy.js';
import { planOf } from '../lib/plans.js';
import { cannotReleaseReason } from '../lib/send.js';
import { connectionConvertBlock, convertBlockReason, convertTargets, CONVERT_FEE, PAIR_LABELS, quote, QUOTE_SECONDS } from '../lib/convert.js';
import { Empty } from '../components/ui.jsx';
import { RequestCard, StepUp } from './Approvals.jsx';

export default function Convert() {
  const { state, dispatch, me } = useStore();
  const [params] = useSearchParams();
  const usable = state.connections.filter((c) => !connectionConvertBlock(c));
  const [connectionId, setConn] = useState(() => (usable.some((c) => c.id === params.get('connection')) ? params.get('connection') : usable[0]?.id || ''));
  const conn = state.connections.find((c) => c.id === connectionId);
  const bal = balances(state)[connectionId] || {};
  const held = conn ? conn.assets.filter((a) => (bal[a] || 0) > 0 && convertTargets(conn, a).length) : [];
  const [from, setFrom] = useState(held[0] || '');
  const fromOk = held.includes(from) ? from : held[0] || '';
  const targets = convertTargets(conn, fromOk);
  const [to, setTo] = useState('');
  const toOk = targets.includes(to) ? to : targets[0] || '';
  const [qty, setQty] = useState('');
  const [quotedAt, setQuotedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [stepUp, setStepUp] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const n = Number(qty);
  const available = bal[fromOk] || 0;
  const left = Math.min(QUOTE_SECONDS, Math.max(0, QUOTE_SECONDS - Math.floor((now - quotedAt) / 1000)));
  const q = fromOk && toOk && n > 0 ? quote(fromOk, toOk, n) : null;
  const request = q && {
    type: 'conversion', connectionId, asset: fromOk, toAsset: toOk, amount: n, usdValue: n * priceOf(fromOk),
    to: conn.name, toAddress: 'Internal', reference: `Convert ${fromOk} → ${toOk}`, quotedRate: q.rate,
  };
  const needsApproval = request && governingPolicies({ ...request, requestedBy: me.id }, state.policies, state.users).length > 0 && planOf(state).approvals;
  const releaseBlock = cannotReleaseReason(me);
  const error = !conn ? 'No connection can convert yet.'
    : convertBlockReason(conn, fromOk, toOk)
      || (!(n > 0) ? 'Enter an amount.' : n > available ? `That is more than you hold (${amount(available, fromOk)}).` : '');
  const reset = () => { setQty(''); setQuotedAt(Date.now()); };

  const conversions = state.requests
    .filter((r) => r.type === 'conversion')
    .map((r) => ({ ...r, status: deriveStatus(r, state.policies, state.users) }));
  const open = conversions.filter((r) => ['pending', 'approved', 'broadcast'].includes(r.status));
  const past = conversions.filter((r) => !['pending', 'approved', 'broadcast'].includes(r.status)).slice(0, 10);
  const blocked = state.connections.filter((c) => connectionConvertBlock(c));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Convert</h1>
          <p>Swap between fiat, stablecoins and crypto inside one of your accounts, for any pair that provider allows through its API. TRNZIT passes your instruction on, and the provider converts at its own rate. TRNZIT never holds your funds.</p>
        </div>
      </div>

      <div className="grid dash">
        <div className="card">
          <div className="card__head"><h2>New conversion</h2></div>
          <div className="card__body stack">
            <label className="field"><span>Account</span>
              <select id="cv-conn" value={connectionId} onChange={(e) => { setConn(e.target.value); setFrom(''); setTo(''); reset(); }}>
                {state.connections.map((c) => {
                  const why = connectionConvertBlock(c);
                  return <option key={c.id} value={c.id} disabled={!!why}>{c.name}{why ? ' (not available)' : ''}</option>;
                })}
              </select>
            </label>
            {conn && (
              <div className="small muted">
                Allowed by {conn.name}: {(conn.convertKinds || []).map((k) => PAIR_LABELS[k]).join(' · ')}
              </div>
            )}
            <div className="grid cols-2">
              <label className="field"><span>From <span className="muted">· you hold {amount(available, fromOk || '—')}</span></span>
                <select id="cv-from" value={fromOk} onChange={(e) => { setFrom(e.target.value); setTo(''); reset(); }}>
                  {held.map((a) => <option key={a} value={a}>{a} — {ASSETS[a].name}</option>)}
                </select>
              </label>
              <label className="field"><span>To</span>
                <select id="cv-to" value={toOk} onChange={(e) => { setTo(e.target.value); setQuotedAt(Date.now()); }}>
                  {targets.map((a) => <option key={a} value={a}>{a} — {ASSETS[a].name}</option>)}
                </select>
              </label>
            </div>
            <label className="field"><span>Amount of {fromOk}</span>
              <div className="row">
                <input id="cv-amount" type="number" min="0" step="any" value={qty} onChange={(e) => { setQty(e.target.value); setQuotedAt(Date.now()); }} />
                <button className="btn sm" type="button" onClick={() => { setQty(String(available)); setQuotedAt(Date.now()); }}>Max</button>
              </div>
            </label>

            {q && !error && (
              <div className="quote">
                <div className="row"><span className="muted">Rate</span><span className="spacer" /><span className="mono">1 {fromOk} = {q.rate.toLocaleString('en-US', { maximumSignificantDigits: 8 })} {toOk}</span></div>
                <div className="row"><span className="muted">Provider fee ({(CONVERT_FEE * 100).toFixed(2)}%)</span><span className="spacer" /><span className="mono">{amount(q.fee, toOk)}</span></div>
                <div className="row"><strong>You receive about</strong><span className="spacer" /><strong className="mono">{amount(q.receive, toOk)}</strong></div>
                <div className="row small muted"><span>Worth about {money(n * priceOf(fromOk))}</span><span className="spacer" />
                  {left > 0 ? <span>Quote refreshes in {left}s</span> : <button className="btn sm" onClick={() => setQuotedAt(Date.now())}>Refresh quote</button>}
                </div>
              </div>
            )}
            {error && qty !== '' && <div className="notice warn small">{error}</div>}
            {done && <div className="notice small">{done}</div>}

            <div className="row wrap">
              <span className="small muted" style={{ flex: 1, minWidth: 200 }}>
                {needsApproval ? 'An approval rule covers this conversion. It goes to Approvals first, then an authorised releaser releases it.'
                  : releaseBlock ? `${releaseBlock} You can still prepare it for a releaser.`
                    : 'You will confirm with your own 2-step code. The provider sets the final rate when it executes.'}
              </span>
              {needsApproval || releaseBlock ? (
                <button className="btn primary" disabled={!!error || left === 0 || !can(me, 'createRequest')}
                  onClick={() => { dispatch({ type: 'CREATE_REQUEST', request }); setDone(`Conversion of ${amount(n, fromOk)} sent for ${needsApproval ? 'approval' : 'release'}.`); reset(); }}>
                  {needsApproval ? 'Submit for approval' : 'Prepare for a releaser'}
                </button>
              ) : (
                <button className="btn primary" disabled={!!error || left === 0} onClick={() => setStepUp(true)}>Review & convert</button>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__head"><h2>Where you can convert</h2></div>
          {state.connections.map((c) => {
            const why = connectionConvertBlock(c);
            return (
              <div className="list-row" key={c.id}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="muted small">{why || (c.convertKinds || []).map((k) => PAIR_LABELS[k]).join(' · ')}</div>
                </div>
                <span className="spacer" />
                {why ? (
                  c.convertKinds?.length && !c.convertEnabled ? <Link className="small" to={`/connections/${c.id}`}>Switch on</Link> : <span className="badge">No</span>
                ) : <span className="badge pos">Yes</span>}
              </div>
            );
          })}
          {blocked.length > 0 && <div className="card__foot small muted">What each provider allows comes from its API. In the demo these are examples.</div>}
        </div>
      </div>

      <h2>In progress</h2>
      {open.length === 0 ? <div className="card"><Empty>No conversions waiting.</Empty></div> : open.map((r) => <RequestCard key={r.id} r={r} />)}

      <h2>Recent conversions</h2>
      <div className="card">
        {past.length === 0 ? <Empty>No conversions yet.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Account</th><th className="num">Converted</th><th className="num">Received</th><th>Status</th></tr></thead>
              <tbody>
                {past.map((r) => (
                  <tr key={r.id}>
                    <td>{state.connections.find((c) => c.id === r.connectionId)?.name || 'Removed connection'}</td>
                    <td className="num mono">{amount(r.amount, r.asset)}</td>
                    <td className="num mono">{r.received != null ? amount(r.received, r.toAsset) : `— ${r.toAsset}`}</td>
                    <td><span className={`badge ${r.status === 'executed' ? 'pos' : r.status === 'rejected' ? 'neg' : ''}`}>{r.status === 'executed' ? 'Completed' : r.status === 'rejected' ? 'Rejected' : 'Cancelled'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stepUp && request && (
        <StepUp
          title={`Convert ${amount(n, fromOk)} → ${toOk}`}
          provider={conn.name}
          irreversible="Conversions cannot be undone once the provider executes them. The provider sets the final rate."
          summary={<>In <strong>{conn.name}</strong>. You receive about <strong>{amount(q.receive, toOk)}</strong> after the provider’s fee.</>}
          onClose={() => setStepUp(false)}
          onConfirm={() => { dispatch({ type: 'CONVERT_NOW', request }); setStepUp(false); setDone(`Conversion released to ${conn.name}. It will show as completed when the provider confirms.`); reset(); }}
        />
      )}
    </div>
  );
}
